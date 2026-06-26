from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request

from app.auth import GatewayUser, require_admin_gateway_user
from app.batch_sync import BatchScheduler
from app.connectors.sqlserver import (
    SqlServerConnector,
    SqlServerConnectorError,
    SqlServerReadOnlyViolation,
)
from app.config import (
    ETL_SCHEDULER_ENABLED,
    ETL_SCHEDULER_POLL_SECONDS,
    ETL_POOL_MAX_SIZE,
    ETL_POOL_MIN_SIZE,
    ETL_STORE_BACKEND,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.schemas import (
    EtlErrorCreate,
    EtlJobCreate,
    EtlLineageCreate,
    EtlRunCreate,
    EtlRunUpdate,
    EtlSourceCreate,
    SqlServerReadRequest,
)
from app.store import EtlNotFoundError, InMemoryEtlStore, PostgresEtlStore
from app.transform_load import AsyncpgTargetWriter, BatchLoadProcessor

SECRET_CONFIG_KEYS = {"password", "passwd", "pwd", "secret", "token", "api_key", "apikey"}


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def _resolve_store_backend() -> str:
    return ETL_STORE_BACKEND if ETL_STORE_BACKEND in {"memory", "postgres"} else "postgres"


@asynccontextmanager
async def lifespan(app: FastAPI):
    backend = _resolve_store_backend()
    app.state.sqlserver_connector = SqlServerConnector()
    app.state.scheduler_stop_event = None
    app.state.scheduler_task = None
    if backend == "memory":
        app.state.store = InMemoryEtlStore()
        app.state.store_backend = backend
        app.state.batch_scheduler = BatchScheduler(
            app.state.store,
            app.state.sqlserver_connector,
            ETL_SCHEDULER_POLL_SECONDS,
        )
        if ETL_SCHEDULER_ENABLED:
            app.state.scheduler_stop_event = asyncio.Event()
            app.state.scheduler_task = asyncio.create_task(
                app.state.batch_scheduler.run_loop(app.state.scheduler_stop_event)
            )
        try:
            yield
        finally:
            if app.state.scheduler_stop_event is not None:
                app.state.scheduler_stop_event.set()
            if app.state.scheduler_task is not None:
                await app.state.scheduler_task
            await app.state.batch_scheduler.shutdown()
        return

    import asyncpg

    pool = await asyncpg.create_pool(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        database=POSTGRES_DB,
        min_size=ETL_POOL_MIN_SIZE,
        max_size=ETL_POOL_MAX_SIZE,
    )
    app.state.pool = pool
    app.state.store = PostgresEtlStore(pool)
    app.state.store_backend = backend
    app.state.batch_scheduler = BatchScheduler(
        app.state.store,
        app.state.sqlserver_connector,
        ETL_SCHEDULER_POLL_SECONDS,
        load_processor=BatchLoadProcessor(postgres_writer=AsyncpgTargetWriter(pool)),
    )
    if ETL_SCHEDULER_ENABLED:
        app.state.scheduler_stop_event = asyncio.Event()
        app.state.scheduler_task = asyncio.create_task(
            app.state.batch_scheduler.run_loop(app.state.scheduler_stop_event)
        )
    try:
        yield
    finally:
        if app.state.scheduler_stop_event is not None:
            app.state.scheduler_stop_event.set()
        if app.state.scheduler_task is not None:
            await app.state.scheduler_task
        await app.state.batch_scheduler.shutdown()
        await pool.close()


app = FastAPI(title="ETL Sync", version="0.2.0", lifespan=lifespan)


def get_store(request: Request):
    return request.app.state.store


def get_sqlserver_connector(request: Request) -> SqlServerConnector:
    return request.app.state.sqlserver_connector


def _handle_store_error(exc: Exception) -> None:
    if isinstance(exc, EtlNotFoundError):
        raise HTTPException(404, str(exc)) from exc
    raise HTTPException(500, str(exc)) from exc


def _mask_secret(value: str) -> str:
    if len(value) <= 4:
        return "*" * len(value)
    return f"{value[:2]}***{value[-2:]}"


def _sanitize_source(source: dict) -> dict:
    payload = dict(source)
    config = dict(payload.get("connectionConfig") or {})
    for key, value in list(config.items()):
        if key.lower() in SECRET_CONFIG_KEYS and isinstance(value, str):
            config[key] = _mask_secret(value)
    payload["connectionConfig"] = config
    return payload


def _handle_connector_error(exc: Exception) -> None:
    if isinstance(exc, EtlNotFoundError):
        raise HTTPException(404, str(exc)) from exc
    if isinstance(exc, SqlServerReadOnlyViolation):
        raise HTTPException(403, str(exc)) from exc
    if isinstance(exc, SqlServerConnectorError):
        raise HTTPException(400, str(exc)) from exc
    raise HTTPException(500, str(exc)) from exc


@app.get("/health")
async def health(request: Request):
    store = request.app.state.store
    store_health = await store.ping()
    return {
        "status": "ok",
        "service": "etl-sync",
        "backend": request.app.state.store_backend,
        "store": store_health,
    }


@app.get("/v1/etl/overview")
async def etl_overview(
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    return await store.get_overview()


@app.post("/v1/etl/sources")
async def create_source(
    body: EtlSourceCreate,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    payload = body.model_dump()
    payload["sourceId"] = payload.get("sourceId") or _make_id("src")
    try:
        source = await store.create_source(payload)
        return _sanitize_source(source)
    except Exception as exc:
        _handle_store_error(exc)


@app.get("/v1/etl/sources")
async def list_sources(
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    sources = await store.list_sources()
    return [_sanitize_source(source) for source in sources]


@app.get("/v1/etl/sources/{source_id}")
async def get_source(
    source_id: str,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    try:
        source = await store.get_source(source_id)
        return _sanitize_source(source)
    except Exception as exc:
        _handle_store_error(exc)


@app.post("/v1/etl/jobs")
async def create_job(
    body: EtlJobCreate,
    user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    payload = body.model_dump()
    payload["jobId"] = payload.get("jobId") or _make_id("job")
    payload["createdBy"] = user.user_id
    try:
        return await store.create_job(payload)
    except Exception as exc:
        _handle_store_error(exc)


@app.get("/v1/etl/jobs")
async def list_jobs(
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    return await store.list_jobs()


@app.get("/v1/etl/jobs/{job_id}")
async def get_job(
    job_id: str,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    try:
        return await store.get_job(job_id)
    except Exception as exc:
        _handle_store_error(exc)


@app.post("/v1/etl/jobs/{job_id}/runs")
async def create_run(
    job_id: str,
    body: EtlRunCreate,
    user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    payload = body.model_dump()
    payload["runId"] = payload.get("runId") or _make_id("run")
    payload["triggeredBy"] = user.user_id
    try:
        return await store.create_run(job_id, payload)
    except Exception as exc:
        _handle_store_error(exc)


@app.get("/v1/etl/runs")
async def list_runs(
    jobId: str | None = None,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    return await store.list_runs(jobId)


@app.get("/v1/etl/runs/{run_id}")
async def get_run(
    run_id: str,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    try:
        return await store.get_run(run_id)
    except Exception as exc:
        _handle_store_error(exc)


@app.post("/v1/etl/runs/{run_id}/status")
async def update_run(
    run_id: str,
    body: EtlRunUpdate,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    try:
        return await store.update_run(run_id, body.model_dump(exclude_none=True))
    except Exception as exc:
        _handle_store_error(exc)


@app.post("/v1/etl/runs/{run_id}/lineage")
async def add_lineage(
    run_id: str,
    body: EtlLineageCreate,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    try:
        return await store.add_lineage(run_id, body.model_dump(exclude_none=True))
    except Exception as exc:
        _handle_store_error(exc)


@app.post("/v1/etl/runs/{run_id}/errors")
async def add_error(
    run_id: str,
    body: EtlErrorCreate,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
):
    try:
        return await store.add_error(run_id, body.model_dump(exclude_none=True))
    except Exception as exc:
        _handle_store_error(exc)


@app.post("/v1/etl/sources/{source_id}/sqlserver/ping")
async def sqlserver_ping(
    source_id: str,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
    connector: SqlServerConnector = Depends(get_sqlserver_connector),
):
    try:
        source = await store.get_source(source_id)
        return await connector.ping_source(source)
    except Exception as exc:
        _handle_connector_error(exc)


@app.get("/v1/etl/sources/{source_id}/sqlserver/tables")
async def sqlserver_tables(
    source_id: str,
    schemaName: str | None = None,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
    connector: SqlServerConnector = Depends(get_sqlserver_connector),
):
    try:
        source = await store.get_source(source_id)
        return await connector.list_tables(source, schemaName)
    except Exception as exc:
        _handle_connector_error(exc)


@app.get("/v1/etl/sources/{source_id}/sqlserver/tables/{table_name}/columns")
async def sqlserver_columns(
    source_id: str,
    table_name: str,
    schemaName: str = "dbo",
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
    connector: SqlServerConnector = Depends(get_sqlserver_connector),
):
    try:
        source = await store.get_source(source_id)
        return await connector.list_columns(source, schemaName, table_name)
    except Exception as exc:
        _handle_connector_error(exc)


@app.post("/v1/etl/sources/{source_id}/sqlserver/read")
async def sqlserver_read_rows(
    source_id: str,
    body: SqlServerReadRequest,
    _user: GatewayUser = Depends(require_admin_gateway_user),
    store=Depends(get_store),
    connector: SqlServerConnector = Depends(get_sqlserver_connector),
):
    try:
        source = await store.get_source(source_id)
        return await connector.read_rows(source, body.model_dump(exclude_none=True))
    except Exception as exc:
        _handle_connector_error(exc)

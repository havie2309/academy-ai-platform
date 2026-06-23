from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _json_value(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return {}
        if value.startswith("{") or value.startswith("["):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
    return value


def _row_dict(row: Any) -> dict[str, Any]:
    return {key: _json_value(value) for key, value in dict(row).items()}


class EtlStoreError(RuntimeError):
    """Base ETL store error."""


class EtlNotFoundError(EtlStoreError):
    """Raised when an ETL entity is missing."""


class BaseEtlStore(ABC):
    backend = "unknown"

    @abstractmethod
    async def ping(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def get_overview(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def create_source(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def list_sources(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    async def get_source(self, source_id: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def create_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def list_jobs(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    async def get_job(self, job_id: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def create_run(self, job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def list_runs(self, job_id: str | None = None) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    async def update_run(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def add_lineage(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def add_error(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def get_run(self, run_id: str) -> dict[str, Any]:
        raise NotImplementedError


class InMemoryEtlStore(BaseEtlStore):
    backend = "memory"

    def __init__(self):
        self.sources: dict[str, dict[str, Any]] = {}
        self.jobs: dict[str, dict[str, Any]] = {}
        self.runs: dict[str, dict[str, Any]] = {}
        self.lineage: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.errors: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._lineage_id = 0
        self._error_id = 0

    async def ping(self) -> dict[str, Any]:
        return {"backend": self.backend, "database": "in-memory", "ok": True}

    async def get_overview(self) -> dict[str, Any]:
        run_statuses = [run["status"] for run in self.runs.values()]
        return {
            "backend": self.backend,
            "sources": len(self.sources),
            "jobs": len(self.jobs),
            "runs": len(self.runs),
            "queuedRuns": run_statuses.count("queued"),
            "runningRuns": run_statuses.count("running"),
            "failedRuns": run_statuses.count("failed"),
        }

    async def create_source(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = _utcnow()
        source = {
            "sourceId": payload["sourceId"],
            "sourceSystem": payload["sourceSystem"],
            "displayName": payload["displayName"],
            "sourceKind": payload["sourceKind"],
            "connectionConfig": payload.get("connectionConfig", {}),
            "active": payload.get("active", True),
            "createdAt": now,
            "updatedAt": now,
        }
        self.sources[source["sourceId"]] = source
        return dict(source)

    async def list_sources(self) -> list[dict[str, Any]]:
        return sorted(self.sources.values(), key=lambda item: item["createdAt"], reverse=True)

    async def get_source(self, source_id: str) -> dict[str, Any]:
        source = self.sources.get(source_id)
        if not source:
            raise EtlNotFoundError(f"source not found: {source_id}")
        return dict(source)

    async def create_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload["sourceId"] not in self.sources:
            raise EtlNotFoundError(f"source not found: {payload['sourceId']}")
        now = _utcnow()
        job = {
            "jobId": payload["jobId"],
            "sourceId": payload["sourceId"],
            "domainCode": payload["domainCode"],
            "syncMode": payload["syncMode"],
            "targetTable": payload.get("targetTable"),
            "targetCollection": payload.get("targetCollection"),
            "scheduleCron": payload.get("scheduleCron"),
            "jobConfig": payload.get("jobConfig", {}),
            "status": payload.get("status", "draft"),
            "lastRunAt": None,
            "createdBy": payload.get("createdBy"),
            "createdAt": now,
            "updatedAt": now,
        }
        self.jobs[job["jobId"]] = job
        return dict(job)

    async def list_jobs(self) -> list[dict[str, Any]]:
        return sorted(self.jobs.values(), key=lambda item: item["createdAt"], reverse=True)

    async def get_job(self, job_id: str) -> dict[str, Any]:
        job = self.jobs.get(job_id)
        if not job:
            raise EtlNotFoundError(f"job not found: {job_id}")
        return dict(job)

    async def create_run(self, job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        job = self.jobs.get(job_id)
        if not job:
            raise EtlNotFoundError(f"job not found: {job_id}")
        source = self.sources.get(job["sourceId"])
        if not source:
            raise EtlNotFoundError(f"source not found: {job['sourceId']}")
        now = _utcnow()
        run = {
            "runId": payload["runId"],
            "jobId": job_id,
            "sourceSystem": source["sourceSystem"],
            "syncMode": job["syncMode"],
            "sourceRange": payload.get("sourceRange", {}),
            "status": "queued",
            "recordIn": 0,
            "recordOut": 0,
            "startedAt": None,
            "finishedAt": None,
            "errorSummary": None,
            "triggerType": payload.get("triggerType", "manual"),
            "triggeredBy": payload.get("triggeredBy"),
            "createdAt": now,
            "updatedAt": now,
        }
        self.runs[run["runId"]] = run
        job["lastRunAt"] = now
        job["updatedAt"] = now
        return dict(run)

    async def list_runs(self, job_id: str | None = None) -> list[dict[str, Any]]:
        runs = list(self.runs.values())
        if job_id:
            runs = [run for run in runs if run["jobId"] == job_id]
        return sorted(runs, key=lambda item: item["createdAt"], reverse=True)

    async def update_run(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        run = self.runs.get(run_id)
        if not run:
            raise EtlNotFoundError(f"run not found: {run_id}")
        run["status"] = payload["status"]
        if payload.get("recordIn") is not None:
            run["recordIn"] = payload["recordIn"]
        if payload.get("recordOut") is not None:
            run["recordOut"] = payload["recordOut"]
        if payload.get("errorSummary") is not None:
            run["errorSummary"] = payload["errorSummary"]
        if payload.get("sourceRange") is not None:
            run["sourceRange"] = payload["sourceRange"]
        if run["status"] == "running" and run["startedAt"] is None:
            run["startedAt"] = _utcnow()
        if run["status"] in {"completed", "failed", "cancelled"}:
            run["finishedAt"] = _utcnow()
        run["updatedAt"] = _utcnow()
        return dict(run)

    async def add_lineage(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if run_id not in self.runs:
            raise EtlNotFoundError(f"run not found: {run_id}")
        self._lineage_id += 1
        lineage = {
            "lineageId": self._lineage_id,
            "runId": run_id,
            "sourceSystem": payload["sourceSystem"],
            "sourceTable": payload.get("sourceTable"),
            "sourcePk": payload.get("sourcePk"),
            "targetTable": payload.get("targetTable"),
            "targetPk": payload.get("targetPk"),
            "targetCollection": payload.get("targetCollection"),
            "targetDocumentId": payload.get("targetDocumentId"),
            "operation": payload.get("operation", "upsert"),
            "status": payload.get("status", "applied"),
            "payloadHash": payload.get("payloadHash"),
            "note": payload.get("note"),
            "createdAt": _utcnow(),
        }
        self.lineage[run_id].append(lineage)
        self.runs[run_id]["updatedAt"] = _utcnow()
        return dict(lineage)

    async def add_error(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if run_id not in self.runs:
            raise EtlNotFoundError(f"run not found: {run_id}")
        self._error_id += 1
        error = {
            "errorId": self._error_id,
            "runId": run_id,
            "sourceSystem": payload["sourceSystem"],
            "stage": payload["stage"],
            "errorCode": payload.get("errorCode"),
            "errorMessage": payload["errorMessage"],
            "detail": payload.get("detail", {}),
            "retryable": payload.get("retryable", False),
            "createdAt": _utcnow(),
        }
        self.errors[run_id].append(error)
        self.runs[run_id]["updatedAt"] = _utcnow()
        return dict(error)

    async def get_run(self, run_id: str) -> dict[str, Any]:
        run = self.runs.get(run_id)
        if not run:
            raise EtlNotFoundError(f"run not found: {run_id}")
        return {
            **dict(run),
            "lineage": [dict(item) for item in self.lineage.get(run_id, [])],
            "errors": [dict(item) for item in self.errors.get(run_id, [])],
        }


class PostgresEtlStore(BaseEtlStore):
    backend = "postgres"

    def __init__(self, pool: Any):
        self.pool = pool

    async def _source_exists(self, source_id: str) -> bool:
        async with self.pool.acquire() as conn:
            return bool(
                await conn.fetchval(
                    "SELECT 1 FROM etl_sources WHERE source_id = $1",
                    source_id,
                )
            )

    async def _run_exists(self, run_id: str) -> bool:
        async with self.pool.acquire() as conn:
            return bool(
                await conn.fetchval(
                    "SELECT 1 FROM etl_runs WHERE run_id = $1",
                    run_id,
                )
            )

    async def ping(self) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            await conn.execute("SELECT 1")
        return {"backend": self.backend, "database": "postgres", "ok": True}

    async def get_overview(self) -> dict[str, Any]:
        query = """
        SELECT
            (SELECT COUNT(*) FROM etl_sources) AS "sources",
            (SELECT COUNT(*) FROM etl_jobs) AS "jobs",
            (SELECT COUNT(*) FROM etl_runs) AS "runs",
            (SELECT COUNT(*) FROM etl_runs WHERE status = 'queued') AS "queuedRuns",
            (SELECT COUNT(*) FROM etl_runs WHERE status = 'running') AS "runningRuns",
            (SELECT COUNT(*) FROM etl_runs WHERE status = 'failed') AS "failedRuns"
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query)
        overview = _row_dict(row)
        overview["backend"] = self.backend
        return overview

    async def create_source(self, payload: dict[str, Any]) -> dict[str, Any]:
        query = """
        INSERT INTO etl_sources (
            source_id, source_system, display_name, source_kind, connection_config, active
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        RETURNING
            source_id AS "sourceId",
            source_system AS "sourceSystem",
            display_name AS "displayName",
            source_kind AS "sourceKind",
            connection_config AS "connectionConfig",
            active,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                payload["sourceId"],
                payload["sourceSystem"],
                payload["displayName"],
                payload["sourceKind"],
                json.dumps(payload.get("connectionConfig", {}), ensure_ascii=False),
                payload.get("active", True),
            )
        return _row_dict(row)

    async def list_sources(self) -> list[dict[str, Any]]:
        query = """
        SELECT
            source_id AS "sourceId",
            source_system AS "sourceSystem",
            display_name AS "displayName",
            source_kind AS "sourceKind",
            connection_config AS "connectionConfig",
            active,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM etl_sources
        ORDER BY created_at DESC
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [_row_dict(row) for row in rows]

    async def get_source(self, source_id: str) -> dict[str, Any]:
        query = """
        SELECT
            source_id AS "sourceId",
            source_system AS "sourceSystem",
            display_name AS "displayName",
            source_kind AS "sourceKind",
            connection_config AS "connectionConfig",
            active,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM etl_sources
        WHERE source_id = $1
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, source_id)
        if row is None:
            raise EtlNotFoundError(f"source not found: {source_id}")
        return _row_dict(row)

    async def create_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not await self._source_exists(payload["sourceId"]):
            raise EtlNotFoundError(f"source not found: {payload['sourceId']}")
        query = """
        INSERT INTO etl_jobs (
            job_id, source_id, domain_code, sync_mode, target_table,
            target_collection, schedule_cron, job_config, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
        RETURNING
            job_id AS "jobId",
            source_id AS "sourceId",
            domain_code AS "domainCode",
            sync_mode AS "syncMode",
            target_table AS "targetTable",
            target_collection AS "targetCollection",
            schedule_cron AS "scheduleCron",
            job_config AS "jobConfig",
            status,
            last_run_at AS "lastRunAt",
            created_by AS "createdBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                payload["jobId"],
                payload["sourceId"],
                payload["domainCode"],
                payload["syncMode"],
                payload.get("targetTable"),
                payload.get("targetCollection"),
                payload.get("scheduleCron"),
                json.dumps(payload.get("jobConfig", {}), ensure_ascii=False),
                payload.get("status", "draft"),
                payload.get("createdBy"),
            )
        if row is None:
            raise EtlStoreError("unable to create job")
        return _row_dict(row)

    async def list_jobs(self) -> list[dict[str, Any]]:
        query = """
        SELECT
            job_id AS "jobId",
            source_id AS "sourceId",
            domain_code AS "domainCode",
            sync_mode AS "syncMode",
            target_table AS "targetTable",
            target_collection AS "targetCollection",
            schedule_cron AS "scheduleCron",
            job_config AS "jobConfig",
            status,
            last_run_at AS "lastRunAt",
            created_by AS "createdBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM etl_jobs
        ORDER BY created_at DESC
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [_row_dict(row) for row in rows]

    async def get_job(self, job_id: str) -> dict[str, Any]:
        query = """
        SELECT
            job_id AS "jobId",
            source_id AS "sourceId",
            domain_code AS "domainCode",
            sync_mode AS "syncMode",
            target_table AS "targetTable",
            target_collection AS "targetCollection",
            schedule_cron AS "scheduleCron",
            job_config AS "jobConfig",
            status,
            last_run_at AS "lastRunAt",
            created_by AS "createdBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM etl_jobs
        WHERE job_id = $1
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, job_id)
        if row is None:
            raise EtlNotFoundError(f"job not found: {job_id}")
        return _row_dict(row)

    async def create_run(self, job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        job_query = """
        SELECT
            j.job_id AS "jobId",
            j.sync_mode AS "syncMode",
            s.source_system AS "sourceSystem"
        FROM etl_jobs j
        JOIN etl_sources s ON s.source_id = j.source_id
        WHERE j.job_id = $1
        """
        run_query = """
        INSERT INTO etl_runs (
            run_id, job_id, source_system, sync_mode, source_range, trigger_type, triggered_by
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        RETURNING
            run_id AS "runId",
            job_id AS "jobId",
            source_system AS "sourceSystem",
            sync_mode AS "syncMode",
            source_range AS "sourceRange",
            status,
            record_in AS "recordIn",
            record_out AS "recordOut",
            started_at AS "startedAt",
            finished_at AS "finishedAt",
            error_summary AS "errorSummary",
            trigger_type AS "triggerType",
            triggered_by AS "triggeredBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        """
        async with self.pool.acquire() as conn:
            job = await conn.fetchrow(job_query, job_id)
            if job is None:
                raise EtlNotFoundError(f"job not found: {job_id}")
            row = await conn.fetchrow(
                run_query,
                payload["runId"],
                job_id,
                job["sourceSystem"],
                job["syncMode"],
                json.dumps(payload.get("sourceRange", {}), ensure_ascii=False),
                payload.get("triggerType", "manual"),
                payload.get("triggeredBy"),
            )
            await conn.execute(
                "UPDATE etl_jobs SET last_run_at = NOW(), updated_at = NOW() WHERE job_id = $1",
                job_id,
            )
        return _row_dict(row)

    async def list_runs(self, job_id: str | None = None) -> list[dict[str, Any]]:
        query = """
        SELECT
            run_id AS "runId",
            job_id AS "jobId",
            source_system AS "sourceSystem",
            sync_mode AS "syncMode",
            source_range AS "sourceRange",
            status,
            record_in AS "recordIn",
            record_out AS "recordOut",
            started_at AS "startedAt",
            finished_at AS "finishedAt",
            error_summary AS "errorSummary",
            trigger_type AS "triggerType",
            triggered_by AS "triggeredBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM etl_runs
        WHERE ($1::varchar IS NULL OR job_id = $1)
        ORDER BY created_at DESC
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, job_id)
        return [_row_dict(row) for row in rows]

    async def update_run(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        query = """
        UPDATE etl_runs
        SET
            status = $2,
            record_in = COALESCE($3, record_in),
            record_out = COALESCE($4, record_out),
            error_summary = COALESCE($5, error_summary),
            source_range = COALESCE($6::jsonb, source_range),
            started_at = CASE
                WHEN $2 = 'running' AND started_at IS NULL THEN NOW()
                ELSE started_at
            END,
            finished_at = CASE
                WHEN $2 IN ('completed', 'failed', 'cancelled') THEN NOW()
                ELSE finished_at
            END,
            updated_at = NOW()
        WHERE run_id = $1
        RETURNING
            run_id AS "runId",
            job_id AS "jobId",
            source_system AS "sourceSystem",
            sync_mode AS "syncMode",
            source_range AS "sourceRange",
            status,
            record_in AS "recordIn",
            record_out AS "recordOut",
            started_at AS "startedAt",
            finished_at AS "finishedAt",
            error_summary AS "errorSummary",
            trigger_type AS "triggerType",
            triggered_by AS "triggeredBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                run_id,
                payload["status"],
                payload.get("recordIn"),
                payload.get("recordOut"),
                payload.get("errorSummary"),
                json.dumps(payload.get("sourceRange"), ensure_ascii=False)
                if payload.get("sourceRange") is not None
                else None,
            )
        if row is None:
            raise EtlNotFoundError(f"run not found: {run_id}")
        return _row_dict(row)

    async def add_lineage(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not await self._run_exists(run_id):
            raise EtlNotFoundError(f"run not found: {run_id}")
        query = """
        INSERT INTO etl_lineage (
            run_id, source_system, source_table, source_pk, target_table, target_pk,
            target_collection, target_document_id, operation, status, payload_hash, note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING
            lineage_id AS "lineageId",
            run_id AS "runId",
            source_system AS "sourceSystem",
            source_table AS "sourceTable",
            source_pk AS "sourcePk",
            target_table AS "targetTable",
            target_pk AS "targetPk",
            target_collection AS "targetCollection",
            target_document_id AS "targetDocumentId",
            operation,
            status,
            payload_hash AS "payloadHash",
            note,
            created_at AS "createdAt"
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                run_id,
                payload["sourceSystem"],
                payload.get("sourceTable"),
                payload.get("sourcePk"),
                payload.get("targetTable"),
                payload.get("targetPk"),
                payload.get("targetCollection"),
                payload.get("targetDocumentId"),
                payload.get("operation", "upsert"),
                payload.get("status", "applied"),
                payload.get("payloadHash"),
                payload.get("note"),
            )
            await conn.execute("UPDATE etl_runs SET updated_at = NOW() WHERE run_id = $1", run_id)
        if row is None:
            raise EtlNotFoundError(f"run not found: {run_id}")
        return _row_dict(row)

    async def add_error(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not await self._run_exists(run_id):
            raise EtlNotFoundError(f"run not found: {run_id}")
        query = """
        INSERT INTO etl_error_logs (
            run_id, source_system, stage, error_code, error_message, detail, retryable
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        RETURNING
            error_id AS "errorId",
            run_id AS "runId",
            source_system AS "sourceSystem",
            stage,
            error_code AS "errorCode",
            error_message AS "errorMessage",
            detail,
            retryable,
            created_at AS "createdAt"
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                run_id,
                payload["sourceSystem"],
                payload["stage"],
                payload.get("errorCode"),
                payload["errorMessage"],
                json.dumps(payload.get("detail", {}), ensure_ascii=False),
                payload.get("retryable", False),
            )
            await conn.execute("UPDATE etl_runs SET updated_at = NOW() WHERE run_id = $1", run_id)
        if row is None:
            raise EtlNotFoundError(f"run not found: {run_id}")
        return _row_dict(row)

    async def get_run(self, run_id: str) -> dict[str, Any]:
        run_query = """
        SELECT
            run_id AS "runId",
            job_id AS "jobId",
            source_system AS "sourceSystem",
            sync_mode AS "syncMode",
            source_range AS "sourceRange",
            status,
            record_in AS "recordIn",
            record_out AS "recordOut",
            started_at AS "startedAt",
            finished_at AS "finishedAt",
            error_summary AS "errorSummary",
            trigger_type AS "triggerType",
            triggered_by AS "triggeredBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM etl_runs
        WHERE run_id = $1
        """
        lineage_query = """
        SELECT
            lineage_id AS "lineageId",
            run_id AS "runId",
            source_system AS "sourceSystem",
            source_table AS "sourceTable",
            source_pk AS "sourcePk",
            target_table AS "targetTable",
            target_pk AS "targetPk",
            target_collection AS "targetCollection",
            target_document_id AS "targetDocumentId",
            operation,
            status,
            payload_hash AS "payloadHash",
            note,
            created_at AS "createdAt"
        FROM etl_lineage
        WHERE run_id = $1
        ORDER BY created_at DESC
        """
        error_query = """
        SELECT
            error_id AS "errorId",
            run_id AS "runId",
            source_system AS "sourceSystem",
            stage,
            error_code AS "errorCode",
            error_message AS "errorMessage",
            detail,
            retryable,
            created_at AS "createdAt"
        FROM etl_error_logs
        WHERE run_id = $1
        ORDER BY created_at DESC
        """
        async with self.pool.acquire() as conn:
            run = await conn.fetchrow(run_query, run_id)
            if run is None:
                raise EtlNotFoundError(f"run not found: {run_id}")
            lineage = await conn.fetch(lineage_query, run_id)
            errors = await conn.fetch(error_query, run_id)
        payload = _row_dict(run)
        payload["lineage"] = [_row_dict(row) for row in lineage]
        payload["errors"] = [_row_dict(row) for row in errors]
        return payload

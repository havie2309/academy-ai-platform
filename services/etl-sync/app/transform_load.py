from __future__ import annotations

import asyncio
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Protocol

from app.config import (
    MONGO_DB,
    MONGO_URI,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)

IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_@$#]*$")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        raise ValueError("expected a list or string")
    items: list[str] = []
    seen: set[str] = set()
    for item in value:
        text = str(item or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        items.append(text)
    return items


def _identifier(value: object, label: str) -> str:
    text = str(value or "").strip()
    if not IDENTIFIER_RE.fullmatch(text):
        raise ValueError(f"invalid {label}: {value!r}")
    return text


def _quoted(identifier: str) -> str:
    return f'"{identifier}"'


@dataclass(frozen=True)
class TableRef:
    schema: str
    table: str

    @property
    def sql(self) -> str:
        return f'{_quoted(self.schema)}.{_quoted(self.table)}'


def _parse_table_ref(value: str) -> TableRef:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("target table is required")
    parts = [part.strip() for part in raw.split(".") if part.strip()]
    if len(parts) == 1:
        return TableRef("public", _identifier(parts[0], "targetTable"))
    if len(parts) == 2:
        return TableRef(
            _identifier(parts[0], "targetTable schema"),
            _identifier(parts[1], "targetTable name"),
        )
    raise ValueError(f"invalid targetTable: {value!r}")


def _normalize_value(
    value: Any,
    *,
    trim_strings: bool,
    empty_string_as_none: bool,
) -> Any:
    if isinstance(value, dict):
        return {
            str(key): _normalize_value(
                item,
                trim_strings=trim_strings,
                empty_string_as_none=empty_string_as_none,
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [
            _normalize_value(
                item,
                trim_strings=trim_strings,
                empty_string_as_none=empty_string_as_none,
            )
            for item in value
        ]
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, str):
        text = value.strip() if trim_strings else value
        if empty_string_as_none and text == "":
            return None
        return text
    return value


def _payload_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class BatchLoadError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        stage: str,
        code: str | None = None,
        detail: dict[str, Any] | None = None,
        retryable: bool = False,
    ):
        super().__init__(message)
        self.stage = stage
        self.code = code or self.__class__.__name__
        self.detail = detail or {}
        self.retryable = retryable


class RowValidationError(BatchLoadError):
    def __init__(self, message: str, *, detail: dict[str, Any] | None = None):
        super().__init__(
            message,
            stage="validate",
            code="ROW_VALIDATION_ERROR",
            detail=detail,
            retryable=False,
        )


class PostgresTargetWriterProtocol(Protocol):
    async def upsert_rows(
        self,
        target_table: str,
        rows: list[dict[str, Any]],
        key_fields: list[str],
    ) -> list[str]:
        ...

    async def close(self) -> None:
        ...


class MongoTargetWriterProtocol(Protocol):
    async def upsert_rows(
        self,
        target_collection: str,
        rows: list[dict[str, Any]],
        key_fields: list[str],
        metadata: dict[str, Any],
    ) -> list[str]:
        ...

    async def close(self) -> None:
        ...


class AsyncpgTargetWriter:
    def __init__(self, pool: Any | None = None):
        self._pool = pool
        self._owns_pool = pool is None

    async def _ensure_pool(self):
        if self._pool is None:
            import asyncpg

            self._pool = await asyncpg.create_pool(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                database=POSTGRES_DB,
                min_size=1,
                max_size=2,
            )
        return self._pool

    async def close(self) -> None:
        if self._owns_pool and self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def upsert_rows(
        self,
        target_table: str,
        rows: list[dict[str, Any]],
        key_fields: list[str],
    ) -> list[str]:
        if not rows:
            return []
        if not key_fields:
            raise BatchLoadError(
                "jobConfig.targetKeyColumns hoặc primaryKeyColumn là bắt buộc cho Postgres load.",
                stage="validate",
                code="TARGET_KEY_REQUIRED",
                retryable=False,
            )
        ref = _parse_table_ref(target_table)
        available_columns = await self._load_columns(ref)
        for key_field in key_fields:
            if key_field not in available_columns:
                raise BatchLoadError(
                    f"target key column not found: {key_field}",
                    stage="validate",
                    code="TARGET_KEY_NOT_FOUND",
                    detail={"targetTable": target_table, "targetKey": key_field},
                    retryable=False,
                )

        pool = await self._ensure_pool()
        target_pks: list[str] = []
        async with pool.acquire() as conn:
            async with conn.transaction():
                for row in rows:
                    filtered = {
                        key: value for key, value in row.items() if key in available_columns
                    }
                    if not filtered:
                        raise BatchLoadError(
                            f"Không có cột nào khớp với bảng đích {target_table}.",
                            stage="validate",
                            code="TARGET_COLUMNS_EMPTY",
                            detail={"targetTable": target_table},
                            retryable=False,
                        )
                    missing_keys = [
                        key
                        for key in key_fields
                        if filtered.get(key) in (None, "", [])
                    ]
                    if missing_keys:
                        raise BatchLoadError(
                            f"Thiếu target key cho bảng đích: {', '.join(missing_keys)}",
                            stage="validate",
                            code="TARGET_KEY_VALUE_MISSING",
                            detail={"targetTable": target_table, "targetKeys": missing_keys},
                            retryable=False,
                        )

                    columns = list(filtered.keys())
                    values = [filtered[column] for column in columns]
                    insert_columns = ", ".join(_quoted(column) for column in columns)
                    placeholders = ", ".join(f"${index}" for index in range(1, len(columns) + 1))
                    conflict = ", ".join(_quoted(column) for column in key_fields)
                    update_columns = [column for column in columns if column not in key_fields]
                    if update_columns:
                        updates = ", ".join(
                            f'{_quoted(column)} = EXCLUDED.{_quoted(column)}'
                            for column in update_columns
                        )
                        query = (
                            f"INSERT INTO {ref.sql} ({insert_columns}) VALUES ({placeholders}) "
                            f"ON CONFLICT ({conflict}) DO UPDATE SET {updates}"
                        )
                    else:
                        query = (
                            f"INSERT INTO {ref.sql} ({insert_columns}) VALUES ({placeholders}) "
                            f"ON CONFLICT ({conflict}) DO NOTHING"
                        )
                    await conn.execute(query, *values)
                    target_pks.append("|".join(str(filtered[key]) for key in key_fields))
        return target_pks

    async def _load_columns(self, ref: TableRef) -> set[str]:
        pool = await self._ensure_pool()
        query = """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, ref.schema, ref.table)
        return {str(row["column_name"]) for row in rows}


class PymongoTargetWriter:
    def __init__(self, uri: str | None = None, database: str | None = None, client=None):
        self._uri = uri or MONGO_URI
        self._database = database or MONGO_DB
        self._client = client
        self._owns_client = client is None

    def _ensure_client(self):
        if self._client is None:
            from pymongo import MongoClient

            self._client = MongoClient(self._uri)
        return self._client

    async def close(self) -> None:
        if self._owns_client and self._client is not None:
            await asyncio.to_thread(self._client.close)
            self._client = None

    async def upsert_rows(
        self,
        target_collection: str,
        rows: list[dict[str, Any]],
        key_fields: list[str],
        metadata: dict[str, Any],
    ) -> list[str]:
        if not rows:
            return []
        name = str(target_collection or "").strip()
        if not name or "\x00" in name:
            raise BatchLoadError(
                f"invalid targetCollection: {target_collection!r}",
                stage="validate",
                code="TARGET_COLLECTION_INVALID",
                retryable=False,
            )
        client = self._ensure_client()
        collection = client[self._database][name]
        return await asyncio.to_thread(
            self._upsert_sync,
            collection,
            rows,
            key_fields,
            metadata,
        )

    def _upsert_sync(self, collection, rows, key_fields, metadata) -> list[str]:
        target_ids: list[str] = []
        for row in rows:
            payload_hash = _payload_hash(row)
            updated_at = _utcnow().isoformat()
            document = dict(row)
            document["_etl"] = {
                **metadata,
                "payloadHash": payload_hash,
                "loadedAt": updated_at,
            }
            document["updatedAt"] = updated_at

            if document.get("_id") not in (None, "", []):
                selector = {"_id": document["_id"]}
                target_id = str(document["_id"])
            elif key_fields and all(document.get(key) not in (None, "", []) for key in key_fields):
                selector = {key: document[key] for key in key_fields}
                target_id = "|".join(str(document[key]) for key in key_fields)
            else:
                selector = {"_etl.payloadHash": payload_hash}
                target_id = payload_hash[:16]

            collection.update_one(
                selector,
                {"$set": document, "$setOnInsert": {"createdAt": updated_at}},
                upsert=True,
            )
            target_ids.append(target_id)
        return target_ids


def _field_mapping(job_config: dict[str, Any]) -> dict[str, str]:
    raw = job_config.get("fieldMappings") or job_config.get("columnMappings") or {}
    if not isinstance(raw, dict):
        raise ValueError("jobConfig.fieldMappings must be an object")
    mapping: dict[str, str] = {}
    for source_field, target_field in raw.items():
        source_name = _identifier(source_field, "fieldMappings source")
        target_name = _identifier(target_field, "fieldMappings target")
        mapping[source_name] = target_name
    return mapping


def _resolve_key_fields(job_config: dict[str, Any], mapping: dict[str, str]) -> list[str]:
    configured = job_config.get("targetKeyColumns")
    if configured is None:
        configured = job_config.get("targetKeyColumn")
    if configured is not None:
        return [_identifier(value, "targetKeyColumns") for value in _string_list(configured)]
    primary_key = str(job_config.get("primaryKeyColumn") or "").strip()
    if not primary_key:
        return []
    normalized = _identifier(primary_key, "primaryKeyColumn")
    return [mapping.get(normalized, normalized)]


def _resolve_mongo_key_fields(
    job_config: dict[str, Any],
    mapping: dict[str, str],
    fallback: list[str],
) -> list[str]:
    configured = job_config.get("mongoKeyFields")
    if configured is not None:
        return [_identifier(value, "mongoKeyFields") for value in _string_list(configured)]
    mongo_document_id = str(job_config.get("mongoDocumentIdField") or "").strip()
    if mongo_document_id:
        normalized = _identifier(mongo_document_id, "mongoDocumentIdField")
        return [mapping.get(normalized, normalized)]
    return list(fallback)


def _resolve_required_fields(job_config: dict[str, Any], mapping: dict[str, str]) -> list[str]:
    required = []
    for field in _string_list(job_config.get("requiredFields")):
        normalized = _identifier(field, "requiredFields")
        required.append(mapping.get(normalized, normalized))
    return required


def transform_row(
    row: dict[str, Any],
    job: dict[str, Any],
) -> tuple[dict[str, Any], str | None]:
    job_config = dict(job.get("jobConfig") or {})
    mapping = _field_mapping(job_config)
    drop_fields = set(_string_list(job_config.get("dropFields")))
    trim_strings = job_config.get("trimStrings", True) is not False
    empty_string_as_none = job_config.get("emptyStringAsNull", True) is not False

    target: dict[str, Any] = {}
    for source_field, raw_value in row.items():
        source_name = _identifier(source_field, "source field")
        if source_name in drop_fields:
            continue
        target_field = mapping.get(source_name, source_name)
        if target_field in drop_fields:
            continue
        target[target_field] = _normalize_value(
            raw_value,
            trim_strings=trim_strings,
            empty_string_as_none=empty_string_as_none,
        )

    static_fields = job_config.get("staticFields") or {}
    if static_fields and not isinstance(static_fields, dict):
        raise RowValidationError("jobConfig.staticFields must be an object")
    for key, value in dict(static_fields).items():
        target[_identifier(key, "staticFields key")] = _normalize_value(
            value,
            trim_strings=trim_strings,
            empty_string_as_none=empty_string_as_none,
        )

    required_fields = _resolve_required_fields(job_config, mapping)
    missing = [field for field in required_fields if target.get(field) in (None, "", [])]
    primary_key = str(job_config.get("primaryKeyColumn") or "").strip()
    source_pk = row.get(primary_key) if primary_key else None

    if missing:
        raise RowValidationError(
            f"Thiếu trường bắt buộc sau transform: {', '.join(missing)}",
            detail={"missingFields": missing, "sourcePk": source_pk},
        )

    return target, str(source_pk) if source_pk not in (None, "") else None


class BatchLoadProcessor:
    def __init__(
        self,
        postgres_writer: PostgresTargetWriterProtocol | None = None,
        mongo_writer: MongoTargetWriterProtocol | None = None,
    ):
        self.postgres_writer = postgres_writer or AsyncpgTargetWriter()
        self.mongo_writer = mongo_writer or PymongoTargetWriter()

    async def close(self) -> None:
        if hasattr(self.postgres_writer, "close"):
            await self.postgres_writer.close()
        if hasattr(self.mongo_writer, "close"):
            await self.mongo_writer.close()

    async def process(
        self,
        job: dict[str, Any],
        run: dict[str, Any],
        source: dict[str, Any],
        extract_result: dict[str, Any],
        store,
    ) -> dict[str, Any]:
        rows = list(extract_result.get("rows") or [])
        if not rows:
            return {
                "recordOut": 0,
                "validRows": 0,
                "skippedRows": 0,
                "loadedTargets": [],
                "validationErrors": 0,
            }

        job_config = dict(job.get("jobConfig") or {})
        mapping = _field_mapping(job_config)
        source_system = str(source.get("sourceSystem") or job.get("sourceSystem") or "etl")
        source_table = str(extract_result.get("tableName") or job_config.get("sourceTable") or "")
        schema_name = str(extract_result.get("schemaName") or job_config.get("sourceSchema") or "dbo")
        target_table = str(job.get("targetTable") or "").strip()
        target_collection = str(job.get("targetCollection") or "").strip()
        track_lineage = job_config.get("trackLineage", True) is not False

        if not target_table and not target_collection:
            raise BatchLoadError(
                "Job cần ít nhất một đích load: targetTable hoặc targetCollection.",
                stage="validate",
                code="TARGET_REQUIRED",
                detail={"jobId": job.get("jobId")},
                retryable=False,
            )

        prepared: list[dict[str, Any]] = []
        validation_errors: list[dict[str, Any]] = []

        for index, row in enumerate(rows):
            try:
                transformed, source_pk = transform_row(row, job)
                prepared.append(
                    {
                        "rowIndex": index,
                        "sourcePk": source_pk,
                        "transformed": transformed,
                        "payloadHash": _payload_hash(transformed),
                    }
                )
            except RowValidationError as exc:
                detail = {
                    "jobId": job.get("jobId"),
                    "runId": run.get("runId"),
                    "rowIndex": index,
                    "sourceTable": source_table,
                    **exc.detail,
                }
                validation_errors.append(
                    {
                        "sourceSystem": source_system,
                        "stage": exc.stage,
                        "errorCode": exc.code,
                        "errorMessage": str(exc),
                        "detail": detail,
                        "retryable": exc.retryable,
                        "sourcePk": exc.detail.get("sourcePk"),
                    }
                )

        for item in validation_errors:
            await store.add_error(
                run["runId"],
                {
                    "sourceSystem": item["sourceSystem"],
                    "stage": item["stage"],
                    "errorCode": item["errorCode"],
                    "errorMessage": item["errorMessage"],
                    "detail": item["detail"],
                    "retryable": item["retryable"],
                },
            )
            if track_lineage:
                await store.add_lineage(
                    run["runId"],
                    {
                        "sourceSystem": source_system,
                        "sourceTable": source_table,
                        "sourcePk": item.get("sourcePk"),
                        "targetTable": target_table or None,
                        "targetCollection": target_collection or None,
                        "operation": "skip",
                        "status": "skipped",
                        "note": item["errorMessage"],
                    },
                )

        if not prepared:
            return {
                "recordOut": 0,
                "validRows": 0,
                "skippedRows": len(validation_errors),
                "loadedTargets": [],
                "validationErrors": len(validation_errors),
            }

        target_key_fields = _resolve_key_fields(job_config, mapping)
        mongo_key_fields = _resolve_mongo_key_fields(job_config, mapping, target_key_fields)
        loaded_targets: list[str] = []

        try:
            postgres_target_pks = [None] * len(prepared)
            if target_table:
                postgres_target_pks = await self.postgres_writer.upsert_rows(
                    target_table,
                    [item["transformed"] for item in prepared],
                    target_key_fields,
                )
                loaded_targets.append("postgres")

            mongo_target_ids = [None] * len(prepared)
            if target_collection:
                mongo_target_ids = await self.mongo_writer.upsert_rows(
                    target_collection,
                    [item["transformed"] for item in prepared],
                    mongo_key_fields,
                    {
                        "jobId": job.get("jobId"),
                        "runId": run.get("runId"),
                        "sourceSystem": source_system,
                        "sourceTable": f"{schema_name}.{source_table}" if source_table else schema_name,
                    },
                )
                loaded_targets.append("mongodb")
        except BatchLoadError:
            raise
        except Exception as exc:
            raise BatchLoadError(
                str(exc),
                stage="load",
                code=exc.__class__.__name__,
                detail={"jobId": job.get("jobId"), "runId": run.get("runId")},
                retryable=True,
            ) from exc

        if track_lineage:
            for index, item in enumerate(prepared):
                await store.add_lineage(
                    run["runId"],
                    {
                        "sourceSystem": source_system,
                        "sourceTable": source_table,
                        "sourcePk": item["sourcePk"],
                        "targetTable": target_table or None,
                        "targetPk": postgres_target_pks[index],
                        "targetCollection": target_collection or None,
                        "targetDocumentId": mongo_target_ids[index],
                        "operation": "upsert",
                        "status": "applied",
                        "payloadHash": item["payloadHash"],
                        "note": "transform/load applied",
                    },
                )

        return {
            "recordOut": len(prepared),
            "validRows": len(prepared),
            "skippedRows": len(validation_errors),
            "loadedTargets": loaded_targets,
            "validationErrors": len(validation_errors),
        }

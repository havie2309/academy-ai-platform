from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from typing import Any, Protocol, Sequence

from pydantic import BaseModel, Field, ValidationError, field_validator

IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_@$#]*$")


class SqlServerConnectorError(RuntimeError):
    """Base SQL Server connector error."""


class SqlServerReadOnlyViolation(SqlServerConnectorError):
    """Raised when a request exceeds read-only connector policy."""


class SqlServerConnectionConfig(BaseModel):
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(default=1433, ge=1, le=65535)
    database: str = Field(..., min_length=1, max_length=255)
    username: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)
    appName: str = Field(default="etl-sync", min_length=1, max_length=100)
    connectTimeout: int = Field(default=10, ge=1, le=60)
    queryTimeout: int = Field(default=30, ge=1, le=300)
    schemaAllowlist: list[str] = Field(default_factory=list)
    tableAllowlist: list[str] = Field(default_factory=list)

    @field_validator("schemaAllowlist", "tableAllowlist", mode="before")
    @classmethod
    def _normalize_lists(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list):
            raise ValueError("must be a list or string")
        seen: list[str] = []
        for item in value:
            text = str(item or "").strip().lower()
            if text and text not in seen:
                seen.append(text)
        return seen

    @classmethod
    def from_source(cls, source: dict[str, Any]) -> "SqlServerConnectionConfig":
        if source.get("sourceKind") != "sqlserver":
            raise SqlServerConnectorError("source is not a sqlserver connector")
        try:
            return cls.model_validate(source.get("connectionConfig") or {})
        except ValidationError as exc:
            raise SqlServerConnectorError(f"invalid sqlserver connectionConfig: {exc}") from exc

    def allows_schema(self, schema_name: str) -> bool:
        if not self.schemaAllowlist:
            return True
        return schema_name.strip().lower() in self.schemaAllowlist

    def allows_table(self, schema_name: str, table_name: str) -> bool:
        if not self.tableAllowlist:
            return True
        schema = schema_name.strip().lower()
        table = table_name.strip().lower()
        return table in self.tableAllowlist or f"{schema}.{table}" in self.tableAllowlist


class SqlServerAdapter(Protocol):
    def fetch_all(
        self,
        config: SqlServerConnectionConfig,
        query: str,
        params: Sequence[Any],
    ) -> list[dict[str, Any]]:
        ...


class PytdsSqlServerAdapter:
    """Default SQL Server adapter using the pure-Python python-tds driver."""

    def fetch_all(
        self,
        config: SqlServerConnectionConfig,
        query: str,
        params: Sequence[Any],
    ) -> list[dict[str, Any]]:
        try:
            import pytds
        except ImportError as exc:
            raise SqlServerConnectorError(
                "python-tds is not installed. Run pip install -r services/etl-sync/requirements.txt."
            ) from exc

        connect_kwargs = {
            "server": config.host,
            "port": config.port,
            "database": config.database,
            "user": config.username,
            "password": config.password,
            "appname": config.appName,
            "login_timeout": config.connectTimeout,
            "timeout": config.queryTimeout,
            "as_dict": True,
        }
        try:
            with pytds.connect(**connect_kwargs) as conn:
                with conn.cursor() as cursor:
                    cursor.execute(query, tuple(params))
                    rows = cursor.fetchall()
                    if rows and isinstance(rows[0], dict):
                        return [dict(row) for row in rows]
                    columns = [col[0] for col in cursor.description or []]
                    return [dict(zip(columns, row)) for row in rows]
        except Exception as exc:
            raise SqlServerConnectorError(str(exc)) from exc


def _identifier(value: str, label: str) -> str:
    text = str(value or "").strip()
    if not IDENTIFIER_RE.fullmatch(text):
        raise SqlServerConnectorError(f"invalid {label}: {value!r}")
    return text


def _quoted(identifier: str) -> str:
    return f"[{identifier}]"


@dataclass
class SqlServerReadPlan:
    schema_name: str
    table_name: str
    columns: list[str]
    limit: int
    cursor_column: str | None
    cursor_value: str | int | float | None
    order_by: str
    descending: bool


class SqlServerConnector:
    def __init__(self, adapter: SqlServerAdapter | None = None):
        self.adapter = adapter or PytdsSqlServerAdapter()

    async def ping_source(self, source: dict[str, Any]) -> dict[str, Any]:
        config = SqlServerConnectionConfig.from_source(source)
        rows = await self._run_query(
            config,
            """
            SELECT
                DB_NAME() AS database_name,
                @@SERVERNAME AS server_name,
                SYSTEM_USER AS login_name,
                CAST(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'SELECT') AS INT) AS can_select,
                CAST(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'INSERT') AS INT) AS can_insert,
                CAST(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'UPDATE') AS INT) AS can_update,
                CAST(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'DELETE') AS INT) AS can_delete
            """,
            (),
        )
        row = rows[0] if rows else {}
        permissions = {
            "canSelect": bool(int(row.get("can_select", 0) or 0)),
            "canInsert": bool(int(row.get("can_insert", 0) or 0)),
            "canUpdate": bool(int(row.get("can_update", 0) or 0)),
            "canDelete": bool(int(row.get("can_delete", 0) or 0)),
        }
        return {
            "sourceSystem": source.get("sourceSystem"),
            "databaseName": row.get("database_name", config.database),
            "serverName": row.get("server_name", config.host),
            "loginName": row.get("login_name", config.username),
            "connectorMode": "read-only",
            "readOnlyPolicy": {
                "application": "select-only",
                "dbWritePermissionsDetected": any(
                    [permissions["canInsert"], permissions["canUpdate"], permissions["canDelete"]]
                ),
            },
            "permissions": permissions,
        }

    async def list_tables(
        self,
        source: dict[str, Any],
        schema_name: str | None = None,
    ) -> list[dict[str, Any]]:
        config = SqlServerConnectionConfig.from_source(source)
        schema = _identifier(schema_name, "schemaName") if schema_name else None
        if schema and not config.allows_schema(schema):
            raise SqlServerReadOnlyViolation(f"schema not allowed: {schema}")
        rows = await self._run_query(
            config,
            """
            SELECT
                TABLE_SCHEMA AS schema_name,
                TABLE_NAME AS table_name
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
              AND (%s IS NULL OR TABLE_SCHEMA = %s)
            ORDER BY TABLE_SCHEMA, TABLE_NAME
            """,
            (schema, schema),
        )
        return [
            {
                "schemaName": row["schema_name"],
                "tableName": row["table_name"],
            }
            for row in rows
            if config.allows_schema(row["schema_name"])
            and config.allows_table(row["schema_name"], row["table_name"])
        ]

    async def list_columns(
        self,
        source: dict[str, Any],
        schema_name: str,
        table_name: str,
    ) -> list[dict[str, Any]]:
        config = SqlServerConnectionConfig.from_source(source)
        schema = _identifier(schema_name, "schemaName")
        table = _identifier(table_name, "tableName")
        self._ensure_allowed(config, schema, table)
        rows = await self._run_query(
            config,
            """
            SELECT
                COLUMN_NAME AS column_name,
                DATA_TYPE AS data_type,
                IS_NULLABLE AS is_nullable,
                CHARACTER_MAXIMUM_LENGTH AS max_length,
                NUMERIC_PRECISION AS numeric_precision,
                NUMERIC_SCALE AS numeric_scale,
                ORDINAL_POSITION AS ordinal_position
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s
              AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
            """,
            (schema, table),
        )
        return [
            {
                "columnName": row["column_name"],
                "dataType": row["data_type"],
                "nullable": str(row["is_nullable"]).upper() == "YES",
                "maxLength": row.get("max_length"),
                "numericPrecision": row.get("numeric_precision"),
                "numericScale": row.get("numeric_scale"),
                "ordinalPosition": row.get("ordinal_position"),
            }
            for row in rows
        ]

    async def read_rows(
        self,
        source: dict[str, Any],
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        config = SqlServerConnectionConfig.from_source(source)
        plan = await self._build_read_plan(source, payload)
        query = (
            f"SELECT TOP ({plan.limit}) "
            + ", ".join(_quoted(column) for column in plan.columns)
            + f" FROM {_quoted(plan.schema_name)}.{_quoted(plan.table_name)}"
        )
        params: list[Any] = []
        if plan.cursor_column and plan.cursor_value is not None:
            query += f" WHERE {_quoted(plan.cursor_column)} > %s"
            params.append(plan.cursor_value)
        direction = "DESC" if plan.descending else "ASC"
        query += f" ORDER BY {_quoted(plan.order_by)} {direction}"

        rows = await self._run_query(config, query, tuple(params))
        next_cursor = None
        if rows and plan.cursor_column:
            next_cursor = rows[-1].get(plan.cursor_column)
        return {
            "schemaName": plan.schema_name,
            "tableName": plan.table_name,
            "columns": plan.columns,
            "count": len(rows),
            "nextCursor": next_cursor,
            "rows": rows,
            "readOnlyPolicy": "structured-select-only",
        }

    async def _build_read_plan(
        self,
        source: dict[str, Any],
        payload: dict[str, Any],
    ) -> SqlServerReadPlan:
        config = SqlServerConnectionConfig.from_source(source)
        schema = _identifier(payload.get("schemaName", "dbo"), "schemaName")
        table = _identifier(payload["tableName"], "tableName")
        self._ensure_allowed(config, schema, table)

        columns = [_identifier(column, "column") for column in payload.get("columns", [])]
        if not columns:
            column_defs = await self.list_columns(source, schema, table)
            columns = [column["columnName"] for column in column_defs]
        if not columns:
            raise SqlServerConnectorError("no columns available for the requested table")

        cursor_column = payload.get("cursorColumn")
        if cursor_column:
            cursor_column = _identifier(cursor_column, "cursorColumn")

        order_by = payload.get("orderBy") or cursor_column or columns[0]
        order_by = _identifier(order_by, "orderBy")
        return SqlServerReadPlan(
            schema_name=schema,
            table_name=table,
            columns=columns,
            limit=int(payload.get("limit", 100)),
            cursor_column=cursor_column,
            cursor_value=payload.get("cursorValue"),
            order_by=order_by,
            descending=bool(payload.get("descending", False)),
        )

    def _ensure_allowed(
        self,
        config: SqlServerConnectionConfig,
        schema_name: str,
        table_name: str,
    ) -> None:
        if not config.allows_schema(schema_name):
            raise SqlServerReadOnlyViolation(f"schema not allowed: {schema_name}")
        if not config.allows_table(schema_name, table_name):
            raise SqlServerReadOnlyViolation(f"table not allowed: {schema_name}.{table_name}")

    async def _run_query(
        self,
        config: SqlServerConnectionConfig,
        query: str,
        params: Sequence[Any],
    ) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self.adapter.fetch_all, config, query, params)

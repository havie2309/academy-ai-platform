"""Execute guarded SQL via read-only Postgres account."""

from __future__ import annotations

import asyncpg

from app.config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PORT,
    SQL_READONLY_PASSWORD,
    SQL_READONLY_USER,
    SQL_STATEMENT_TIMEOUT_MS,
)


async def execute_sql(sql: str) -> tuple[list[str], list[tuple]]:
    conn = await asyncpg.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        user=SQL_READONLY_USER,
        password=SQL_READONLY_PASSWORD,
        database=POSTGRES_DB,
    )
    try:
        await conn.execute(f"SET statement_timeout = {SQL_STATEMENT_TIMEOUT_MS}")
        await conn.execute("SET default_transaction_read_only = on")
        await conn.execute("SET search_path TO sql_curated")
        async with conn.transaction(readonly=True):
            stmt = await conn.prepare(sql)
            columns = [attr.name for attr in stmt.get_attributes()]
            rows = await conn.fetch(sql)
        return columns, [tuple(row.values()) for row in rows]
    finally:
        await conn.close()

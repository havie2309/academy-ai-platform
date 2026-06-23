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

_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    # Chạy một lần khi connection được tạo mới trong pool.
    # SET (không có LOCAL) → session-level, tồn tại suốt vòng đời connection.
    await conn.execute("SET default_transaction_read_only = on")
    await conn.execute("SET search_path TO sql_curated")


async def init_pool(min_size: int = 2, max_size: int = 10) -> None:
    """Gọi một lần lúc app startup."""
    global _pool
    _pool = await asyncpg.create_pool(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        user=SQL_READONLY_USER,
        password=SQL_READONLY_PASSWORD,
        database=POSTGRES_DB,
        min_size=min_size,
        max_size=max_size,
        init=_init_connection,
    )


async def close_pool() -> None:
    """Gọi một lần lúc app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def execute_sql(sql: str) -> tuple[list[str], list[tuple]]:
    if _pool is None:
        raise RuntimeError("Connection pool chưa được khởi tạo. Gọi init_pool() trước.")
    async with _pool.acquire() as conn:
        async with conn.transaction(readonly=True):
            # SET LOCAL → chỉ có hiệu lực trong transaction này, tự reset sau khi kết thúc.
            await conn.execute(f"SET LOCAL statement_timeout = {SQL_STATEMENT_TIMEOUT_MS}")
            stmt = await conn.prepare(sql)
            columns = [attr.name for attr in stmt.get_attributes()]
            rows = await conn.fetch(sql)
    return columns, [tuple(row.values()) for row in rows]

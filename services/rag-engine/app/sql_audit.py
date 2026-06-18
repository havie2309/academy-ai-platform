"""Persist Text-to-SQL audit rows (F-07)."""

from __future__ import annotations

import asyncpg

from app.config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
    SQL_AUDIT_ENABLED,
)


async def log_sql_audit(
    *,
    user: dict,
    question: str,
    generated_sql: str | None,
    guarded_sql: str | None,
    status: str,
    deny_reason: str | None = None,
    row_count: int | None = None,
    latency_ms: int | None = None,
) -> None:
    if not SQL_AUDIT_ENABLED:
        return

    roles = ",".join(user.get("roles") or [])
    conn = await asyncpg.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        database=POSTGRES_DB,
    )
    try:
        await conn.execute(
            """
            INSERT INTO sql_query_audit (
              user_id, username, roles, question,
              generated_sql, guarded_sql, status, deny_reason,
              row_count, latency_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            user.get("userId"),
            user.get("username"),
            roles,
            question,
            generated_sql,
            guarded_sql,
            status,
            deny_reason,
            row_count,
            latency_ms,
        )
    finally:
        await conn.close()

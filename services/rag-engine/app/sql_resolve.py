"""Resolve ma_hv / ma_gv for row-level SQL scope."""

from __future__ import annotations

import re

import asyncpg

from app.config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.sql_roles import is_lecturer_role, is_student_role

_MA_HV_RE = re.compile(r"^\d{5,8}$")
_MA_GV_RE = re.compile(r"^GV\d+$", re.I)
_SCOPE_BINDINGS_READY = False


async def ensure_scope_binding_support(conn: asyncpg.Connection) -> None:
    global _SCOPE_BINDINGS_READY
    if _SCOPE_BINDINGS_READY:
        return

    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_scope_bindings (
          user_id VARCHAR(20) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
          profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('hoc_vien', 'giang_vien')),
          profile_code VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
        """
    )
    await conn.execute(
        """
        INSERT INTO user_scope_bindings (user_id, profile_type, profile_code)
        SELECT u.user_id, 'hoc_vien', hv.ma_hv
        FROM users u
        CROSS JOIN LATERAL (
          SELECT ma_hv
          FROM hoc_vien
          WHERE active = true
          ORDER BY ma_hv
          LIMIT 1
        ) hv
        WHERE u.username = 'hv001'
        ON CONFLICT (user_id) DO NOTHING
        """
    )
    await conn.execute(
        """
        INSERT INTO user_scope_bindings (user_id, profile_type, profile_code)
        SELECT u.user_id, 'giang_vien', gv.ma_gv
        FROM users u
        CROSS JOIN LATERAL (
          SELECT ma_gv
          FROM giang_vien
          WHERE active = true
          ORDER BY ma_gv
          LIMIT 1
        ) gv
        WHERE lower(u.username) = 'gv001'
        ON CONFLICT (user_id) DO NOTHING
        """
    )
    _SCOPE_BINDINGS_READY = True


async def resolve_student_ma_hv(user: dict) -> str | None:
    username = str(user.get("username") or "").strip()
    if _MA_HV_RE.match(username):
        return username

    user_id = str(user.get("userId") or "").strip()
    if not user_id:
        return None

    conn = await asyncpg.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        database=POSTGRES_DB,
    )
    try:
        await ensure_scope_binding_support(conn)
        row = await conn.fetchrow(
            """
            SELECT COALESCE(
              (
                SELECT b.profile_code
                FROM user_scope_bindings b
                WHERE b.user_id = u.user_id
                  AND b.profile_type = 'hoc_vien'
                LIMIT 1
              ),
              h.ma_hv
            ) AS ma_hv
            FROM users u
            LEFT JOIN hoc_vien h ON (
              h.ma_hv = u.username
              OR lower(coalesce(h.email, '')) = lower(coalesce(u.email, ''))
              OR h.ho_ten = u.fullname
            )
            WHERE u.user_id = $1
            LIMIT 1
            """,
            user_id,
        )
        if row and row["ma_hv"]:
            return str(row["ma_hv"])
    finally:
        await conn.close()
    return None


async def resolve_lecturer_ma_gv(user: dict) -> str | None:
    username = str(user.get("username") or "").strip()
    if _MA_GV_RE.match(username):
        return username.upper() if username.upper().startswith("GV") else username

    user_id = str(user.get("userId") or "").strip()
    if not user_id:
        return None

    conn = await asyncpg.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        database=POSTGRES_DB,
    )
    try:
        await ensure_scope_binding_support(conn)
        row = await conn.fetchrow(
            """
            SELECT COALESCE(
              (
                SELECT b.profile_code
                FROM user_scope_bindings b
                WHERE b.user_id = u.user_id
                  AND b.profile_type = 'giang_vien'
                LIMIT 1
              ),
              g.ma_gv
            ) AS ma_gv
            FROM users u
            LEFT JOIN giang_vien g ON (
              upper(g.ma_gv) = upper(u.username)
              OR lower(coalesce(g.email, '')) = lower(coalesce(u.email, ''))
              OR g.ho_ten = u.fullname
            )
            WHERE u.user_id = $1
            LIMIT 1
            """,
            user_id,
        )
        if row and row["ma_gv"]:
            return str(row["ma_gv"])
    finally:
        await conn.close()
    return None


async def resolve_scope_user(user: dict) -> dict:
    """Best-effort enrich user context with concrete scope identifiers."""
    enriched = dict(user or {})
    roles = enriched.get("roles") or []

    if is_student_role(roles) and not str(enriched.get("scopeMaHv") or "").strip():
        ma_hv = await resolve_student_ma_hv(enriched)
        if ma_hv:
            enriched["scopeMaHv"] = ma_hv

    if is_lecturer_role(roles) and not str(enriched.get("scopeMaGv") or "").strip():
        ma_gv = await resolve_lecturer_ma_gv(enriched)
        if ma_gv:
            enriched["scopeMaGv"] = ma_gv

    return enriched

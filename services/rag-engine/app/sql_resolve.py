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

_MA_HV_RE = re.compile(r"^\d{5,8}$")
_MA_GV_RE = re.compile(r"^GV\d+$", re.I)


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
        row = await conn.fetchrow(
            """
            SELECT h.ma_hv
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
        row = await conn.fetchrow(
            """
            SELECT g.ma_gv
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

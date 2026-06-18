"""Row-level scope injection for self-service roles (F-05 v1)."""

from __future__ import annotations

import re

from app.sql_roles import (
    is_lecturer_role,
    is_staff_role,
    is_student_role,
    normalized_roles,
)
from app.sql_catalog import VIEW_SCOPE_COLUMN

SCOPE_LITERAL_RE = re.compile(r"^[a-zA-Z0-9_.-]+$")
_SCOPE_FILTER_RE = re.compile(
    r"\b(?:ma_hv|ma_gv)\s*=\s*'[^']*'",
    flags=re.I,
)


class SqlScopeError(PermissionError):
    pass


def _escape_literal(value: str) -> str:
    cleaned = value.strip()
    if not cleaned or not SCOPE_LITERAL_RE.match(cleaned):
        raise SqlScopeError("Username không hợp lệ cho lọc dữ liệu.")
    return cleaned.replace("'", "''")


def _referenced_views(sql: str) -> set[str]:
    found: set[str] = set()
    for view in VIEW_SCOPE_COLUMN:
        if re.search(rf"\b{view}\b", sql, flags=re.I):
            found.add(view)
        if re.search(rf"\bsql_curated\.{view}\b", sql, flags=re.I):
            found.add(view)
    return found


def _strip_existing_scope_filters(sql: str) -> str:
    sql = _SCOPE_FILTER_RE.sub("", sql)
    sql = re.sub(r"\bWHERE\s+AND\b", "WHERE", sql, flags=re.I)
    sql = re.sub(r"\bWHERE\s+(GROUP BY|ORDER BY|LIMIT|HAVING)\b", r"\1", sql, flags=re.I)
    sql = re.sub(r"\s{2,}", " ", sql)
    return sql.strip()


def _inject_condition(sql: str, condition: str) -> str:
    upper = sql.upper()
    if re.search(r"\bWHERE\b", upper):
        return re.sub(
            r"\bWHERE\b",
            f"WHERE ({condition}) AND ",
            sql,
            count=1,
            flags=re.I,
        )
    for keyword in ("GROUP BY", "ORDER BY", "LIMIT", "HAVING"):
        if re.search(rf"\b{keyword}\b", upper):
            return re.sub(
                rf"\b{keyword}\b",
                f"WHERE {condition} {keyword}",
                sql,
                count=1,
                flags=re.I,
            )
    return f"{sql} WHERE {condition}"


def apply_scope(sql: str, user: dict) -> str:
    roles = user.get("roles") or []
    if is_staff_role(roles):
        return sql

    username = str(user.get("username") or "").strip()
    scope_literal = str(user.get("scopeMaHv") or user.get("scopeMaGv") or "").strip()
    if not scope_literal:
        scope_literal = username
    if not scope_literal:
        raise SqlScopeError("Thiếu username để lọc dữ liệu cá nhân.")

    if is_student_role(roles):
        column = "ma_hv"
        literal = _escape_literal(scope_literal)
    elif is_lecturer_role(roles):
        column = "ma_gv"
        literal = _escape_literal(scope_literal)
    elif normalized_roles(roles) & {"HOC_VIEN", "GIANG_VIEN"}:
        raise SqlScopeError("Vai trò chưa được hỗ trợ cho Text-to-SQL.")
    else:
        raise SqlScopeError("Tài khoản không có quyền truy vấn SQL.")

    sql = _strip_existing_scope_filters(sql)
    views = _referenced_views(sql)
    if not views:
        raise SqlScopeError("Không xác định được view để áp dụng phạm vi dữ liệu.")

    conditions: list[str] = []
    for view in views:
        scope_col = VIEW_SCOPE_COLUMN.get(view)
        if scope_col is None:
            if is_lecturer_role(roles):
                raise SqlScopeError("Giảng viên không được truy vấn lịch thi tổng quan.")
            continue
        if scope_col != column:
            raise SqlScopeError(f"View {view} không thuộc phạm vi vai trò hiện tại.")
        conditions.append(f"{scope_col} = '{literal}'")

    if not conditions:
        raise SqlScopeError("Không thể áp dụng phạm vi dữ liệu cho câu truy vấn.")

    merged = " AND ".join(f"({c})" for c in conditions)
    return _inject_condition(sql, merged)

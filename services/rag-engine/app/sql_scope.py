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
    r"\b(?:[a-zA-Z_][\w$]*\.)?(?:ma_hv|ma_gv)\s*=\s*'[^']*'",
    flags=re.I,
)
_RELATION_RE = re.compile(
    r"\b(?:FROM|JOIN)\s+((?:sql_curated\.)?(v_[a-z_][\w$]*))"
    r"(?:\s+(?:AS\s+)?([a-zA-Z_][\w$]*))?",
    flags=re.I,
)
_RESERVED_ALIASES = {
    "where",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "full",
    "cross",
    "group",
    "order",
    "limit",
    "having",
    "offset",
    "on",
}


class SqlScopeError(PermissionError):
    pass


def _escape_literal(value: str) -> str:
    cleaned = value.strip()
    if not cleaned or not SCOPE_LITERAL_RE.match(cleaned):
        raise SqlScopeError("Username không hợp lệ cho lọc dữ liệu.")
    return cleaned.replace("'", "''")


def _relation_targets(sql: str) -> list[tuple[str, str]]:
    targets: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for relation, raw_view, raw_alias in _RELATION_RE.findall(sql):
        del relation  # already captured as raw_view + raw_alias
        view = raw_view.split(".")[-1].lower()
        alias = (raw_alias or "").strip()
        if alias.lower() in _RESERVED_ALIASES:
            alias = ""
        qualifier = alias or view
        target = (view, qualifier)
        if target in seen:
            continue
        seen.add(target)
        targets.append(target)
    return targets


def _strip_existing_scope_filters(sql: str) -> str:
    sql = _SCOPE_FILTER_RE.sub("", sql)
    sql = re.sub(r"\(\s*(?:AND\s*)+\)", "", sql, flags=re.I)
    sql = re.sub(r"\(\s*\)", "", sql)
    sql = re.sub(r"\bAND\s+AND\b", "AND", sql, flags=re.I)
    sql = re.sub(r"\bOR\s+OR\b", "OR", sql, flags=re.I)
    sql = re.sub(r"\bWHERE\s+AND\b", "WHERE", sql, flags=re.I)
    sql = re.sub(r"\bAND\s+(GROUP BY|ORDER BY|LIMIT|HAVING|OFFSET)\b", r" \1", sql, flags=re.I)
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
    for keyword in ("GROUP BY", "ORDER BY", "LIMIT", "HAVING", "OFFSET"):
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

    scope_literal = str(user.get("scopeMaHv") or user.get("scopeMaGv") or "").strip()
    if not scope_literal:
        raise SqlScopeError("Thiếu mã định danh để lọc dữ liệu cá nhân.")

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
    relation_targets = _relation_targets(sql)
    if not relation_targets:
        raise SqlScopeError("Không xác định được view để áp dụng phạm vi dữ liệu.")

    conditions: list[str] = []
    for view, qualifier in relation_targets:
        scope_col = VIEW_SCOPE_COLUMN.get(view)
        if scope_col is None:
            if is_lecturer_role(roles):
                raise SqlScopeError("Giảng viên không được truy vấn lịch thi tổng quan.")
            continue
        if scope_col != column:
            raise SqlScopeError(f"View {view} không thuộc phạm vi vai trò hiện tại.")
        conditions.append(f"{qualifier}.{scope_col} = '{literal}'")

    if not conditions:
        raise SqlScopeError("Không thể áp dụng phạm vi dữ liệu cho câu truy vấn.")

    merged = " AND ".join(f"({c})" for c in conditions)
    return _inject_condition(sql, merged)

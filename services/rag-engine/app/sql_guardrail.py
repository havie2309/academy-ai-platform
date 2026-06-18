"""SQL guardrail: SELECT-only, single statement, LIMIT, curated views whitelist."""

from __future__ import annotations

import re

import sqlparse
from sqlparse.tokens import Comment

from app.config import SQL_DEFAULT_LIMIT, SQL_MAX_LIMIT
from app.sql_catalog import SQL_SCHEMA, allowed_view_names, fully_qualified_view

FORBIDDEN_KEYWORDS = {
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "COPY",
    "EXECUTE",
    "CALL",
    "MERGE",
    "REPLACE",
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "VACUUM",
    "ANALYZE",
    "SET",
    "RESET",
    "SHOW",
    "PREPARE",
    "DEALLOCATE",
    "INTO",
}

FORBIDDEN_FUNCTIONS = {
    "pg_read_file",
    "pg_write_file",
    "pg_ls_dir",
    "lo_import",
    "lo_export",
    "dblink",
    "pg_sleep",
}


class SqlGuardrailError(ValueError):
    pass


def _strip_comments(sql: str) -> str:
    if "--" in sql or "/*" in sql:
        raise SqlGuardrailError("Không cho phép comment trong SQL.")
    parsed = sqlparse.parse(sql)
    for stmt in parsed:
        for token in stmt.flatten():
            if token.ttype in Comment:
                raise SqlGuardrailError("Không cho phép comment trong SQL.")
    return sql


def _ensure_single_select(sql: str) -> str:
    statements = [s for s in sqlparse.parse(sql) if str(s).strip()]
    if len(statements) != 1:
        raise SqlGuardrailError("Chỉ cho phép đúng một câu lệnh SQL.")
    stmt = statements[0]
    first_keyword = stmt.token_first(skip_cm=True)
    if not first_keyword or first_keyword.normalized != "SELECT":
        raise SqlGuardrailError("Chỉ cho phép câu lệnh SELECT.")
    return str(stmt).strip().rstrip(";")


def _scan_forbidden_tokens(sql: str) -> None:
    upper = sql.upper()
    if ";" in sql.rstrip().rstrip(";"):
        raise SqlGuardrailError("Không cho phép nhiều câu lệnh (dấu ;).")
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{kw}\b", upper):
            if kw == "INTO" and re.search(r"\bSELECT\b", upper):
                raise SqlGuardrailError("Không cho phép SELECT ... INTO.")
            if kw != "INTO":
                raise SqlGuardrailError(f"Từ khóa không được phép: {kw}")
    for fn in FORBIDDEN_FUNCTIONS:
        if fn.lower() in sql.lower():
            raise SqlGuardrailError(f"Function không được phép: {fn}")


def _collect_relation_names(stmt) -> set[str]:
    """Extract table/view names from FROM and JOIN clauses only."""
    sql = str(stmt)
    names: set[str] = set()
    for match in re.finditer(
        r"\b(?:FROM|JOIN)\s+([a-zA-Z_][\w$]*(?:\.[a-zA-Z_][\w$]*)?)",
        sql,
        flags=re.I,
    ):
        names.add(match.group(1).lower())
    return names


def _validate_views_only(sql: str, stmt) -> None:
    allowed = allowed_view_names()
    allowed_fq = {fully_qualified_view(v).lower() for v in allowed}
    allowed_fq |= {v.lower() for v in allowed}

    relations = _collect_relation_names(stmt)
    if not relations:
        raise SqlGuardrailError("Không xác định được view nguồn.")

    for rel in relations:
        if rel in allowed_fq:
            continue
        if rel.startswith(f"{SQL_SCHEMA.lower()}."):
            view = rel.split(".", 1)[1]
            if view in allowed:
                continue
        if rel in allowed:
            continue
        raise SqlGuardrailError(f"View/tables không được phép: {rel}")


def _ensure_limit(sql: str) -> str:
    if re.search(r"\bLIMIT\s+\d+\b", sql, flags=re.I):
        match = re.search(r"\bLIMIT\s+(\d+)\b", sql, flags=re.I)
        if match and int(match.group(1)) > SQL_MAX_LIMIT:
            sql = re.sub(
                r"\bLIMIT\s+\d+\b",
                f"LIMIT {SQL_MAX_LIMIT}",
                sql,
                count=1,
                flags=re.I,
            )
        return sql
    return f"{sql.rstrip()} LIMIT {SQL_DEFAULT_LIMIT}"


def apply_guardrail(sql: str) -> str:
    cleaned = _strip_comments(sql.strip())
    _scan_forbidden_tokens(cleaned)
    single = _ensure_single_select(cleaned)
    statements = sqlparse.parse(single)
    _validate_views_only(single, statements[0])
    return _ensure_limit(single)

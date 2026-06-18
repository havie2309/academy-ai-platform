"""Normalize IAM role codes from JWT/seed into SQL scope buckets."""

from __future__ import annotations

from app.config import SELF_SCOPE_ROLES, STAFF_SQL_ROLES

_ROLE_ALIASES: dict[str, str] = {
    "ADMIN": "ADMIN",
    "ADMINISTRATOR": "ADMIN",
    "BGD": "BGD",
    "P2": "P2",
    "P7": "P2",
    "KHAO_THI": "P2",
    "HOC_VIEN": "HOC_VIEN",
    "HOCIEN": "HOC_VIEN",
    "HOCVIEN": "HOC_VIEN",
    "SINH_VIEN": "HOC_VIEN",
    "GIANG_VIEN": "GIANG_VIEN",
    "GIANGVIEN": "GIANG_VIEN",
    "GV": "GIANG_VIEN",
}


def normalize_role_code(role: str) -> str:
    folded = role.strip().upper().replace("-", "_").replace(" ", "_")
    if folded in _ROLE_ALIASES:
        return _ROLE_ALIASES[folded]
    compact = folded.replace("_", "")
    return _ROLE_ALIASES.get(compact, folded)


def normalized_roles(roles: list[str] | None) -> set[str]:
    return {normalize_role_code(str(role)) for role in (roles or []) if str(role).strip()}


def is_staff_role(roles: list[str] | None) -> bool:
    return bool(normalized_roles(roles) & STAFF_SQL_ROLES)


def is_student_role(roles: list[str] | None) -> bool:
    return "HOC_VIEN" in normalized_roles(roles)


def is_lecturer_role(roles: list[str] | None) -> bool:
    return "GIANG_VIEN" in normalized_roles(roles)


def has_self_scope_role(roles: list[str] | None) -> bool:
    return bool(normalized_roles(roles) & SELF_SCOPE_ROLES)

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from fastapi import HTTPException, Request

ADMIN_ETL_ROLES = {"ADMIN", "BGD", "P2", "P7"}
ROLE_ALIASES = {
    "HOCVIEN": "HOC_VIEN",
    "HOC_VIEN": "HOC_VIEN",
    "SINHVIEN": "HOC_VIEN",
    "SINH_VIEN": "HOC_VIEN",
    "GIANGVIEN": "GIANG_VIEN",
    "GIANG_VIEN": "GIANG_VIEN",
    "GV": "GIANG_VIEN",
}
UNAUTHORIZED_MESSAGE = "gateway-authenticated user required"
FORBIDDEN_MESSAGE = "etl access requires admin role"


def _fold_role(role: str) -> str:
    return (
        unicodedata.normalize("NFD", str(role or ""))
        .encode("ascii", "ignore")
        .decode("ascii")
        .replace("-", "_")
        .replace(" ", "_")
        .strip("_")
        .upper()
    )


def _normalize_roles(raw: str | None) -> list[str]:
    if not raw:
        return []
    seen: set[str] = set()
    normalized: list[str] = []
    for item in raw.split(","):
        folded = _fold_role(item)
        canonical = ROLE_ALIASES.get(folded, folded)
        if not canonical or canonical in seen:
            continue
        seen.add(canonical)
        normalized.append(canonical)
    return normalized


@dataclass(frozen=True)
class GatewayUser:
    user_id: str
    username: str
    normalized_roles: list[str]
    department: str | None
    max_security_level: int


def get_gateway_user(request: Request) -> GatewayUser:
    headers = request.headers
    user_id = str(headers.get("x-gateway-user-id", "")).strip()
    if not user_id or user_id.lower() == "anonymous":
        raise HTTPException(401, UNAUTHORIZED_MESSAGE)

    normalized_roles = _normalize_roles(
        headers.get("x-gateway-normalized-roles") or headers.get("x-gateway-roles")
    )
    if "ANONYMOUS" in normalized_roles:
        raise HTTPException(401, UNAUTHORIZED_MESSAGE)

    max_security_level_raw = str(headers.get("x-gateway-max-security-level", "1")).strip()
    try:
        max_security_level = int(max_security_level_raw or "1")
    except ValueError:
        max_security_level = 1

    department = str(headers.get("x-gateway-department", "")).strip() or None
    username = str(headers.get("x-gateway-username", "")).strip() or user_id
    return GatewayUser(
        user_id=user_id,
        username=username,
        normalized_roles=normalized_roles,
        department=department,
        max_security_level=max_security_level,
    )


def require_admin_gateway_user(request: Request) -> GatewayUser:
    user = get_gateway_user(request)
    if not any(role in ADMIN_ETL_ROLES for role in user.normalized_roles):
        raise HTTPException(403, FORBIDDEN_MESSAGE)
    return user

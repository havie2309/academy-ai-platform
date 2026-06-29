from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, Request

ETL_ADMIN_ROLES = {"ADMIN"}
ETL_OPERATOR_ROLES = {"ADMIN", "BGD", "P2", "P7"}
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
OPERATOR_FORBIDDEN_MESSAGE = "etl access requires operator role"
ADMIN_FORBIDDEN_MESSAGE = "etl configuration requires admin role"
JOB_SCOPE_FORBIDDEN_MESSAGE = "etl job is outside your scope"
DOMAIN_ROLE_DEFAULTS = (
    (("DAO_TAO", "TRAINING", "HOC_VIEN", "GIANG_VIEN"), {"ADMIN", "BGD", "P2"}),
    (("KHAO_THI", "EXAM", "NGAN_HANG_DE", "PHO_DIEM", "TUYEN_SINH"), {"ADMIN", "BGD", "P7"}),
)


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


@dataclass(frozen=True)
class JobAccessPolicy:
    view_roles: set[str]
    run_roles: set[str]
    allowed_user_ids: set[str]


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


def is_etl_admin(user: GatewayUser) -> bool:
    return any(role in ETL_ADMIN_ROLES for role in user.normalized_roles)


def is_etl_operator(user: GatewayUser) -> bool:
    return any(role in ETL_OPERATOR_ROLES for role in user.normalized_roles)


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        items = value.split(",")
    elif isinstance(value, (list, tuple, set)):
        items = list(value)
    else:
        return []
    values: list[str] = []
    for item in items:
        raw = str(item or "").strip()
        if raw:
            values.append(raw)
    return values


def _default_roles_for_domain(domain_code: str | None) -> set[str]:
    folded = _fold_role(domain_code or "")
    for keywords, roles in DOMAIN_ROLE_DEFAULTS:
        if any(keyword in folded for keyword in keywords):
            return set(roles)
    return {"ADMIN"}


def resolve_job_access_policy(job: dict[str, Any]) -> JobAccessPolicy:
    job_config = job.get("jobConfig")
    if not isinstance(job_config, dict):
        job_config = {}
    raw_policy = job_config.get("accessPolicy")
    policy = raw_policy if isinstance(raw_policy, dict) else {}

    default_roles = _default_roles_for_domain(job.get("domainCode"))
    explicit_view = "viewRoles" in policy
    explicit_run = "runRoles" in policy

    view_roles = (
        set(_normalize_roles(",".join(_string_list(policy.get("viewRoles")))))
        if explicit_view
        else set(default_roles)
    )
    run_roles = (
        set(_normalize_roles(",".join(_string_list(policy.get("runRoles")))))
        if explicit_run
        else set(default_roles)
    )
    allowed_user_ids = {value for value in _string_list(policy.get("allowedUserIds"))}

    return JobAccessPolicy(
        view_roles=view_roles,
        run_roles=run_roles,
        allowed_user_ids=allowed_user_ids,
    )


def can_view_job(user: GatewayUser, job: dict[str, Any]) -> bool:
    if is_etl_admin(user):
        return True
    if not is_etl_operator(user):
        return False
    policy = resolve_job_access_policy(job)
    if policy.allowed_user_ids and user.user_id not in policy.allowed_user_ids:
        return False
    return any(role in policy.view_roles for role in user.normalized_roles)


def can_run_job(user: GatewayUser, job: dict[str, Any]) -> bool:
    if is_etl_admin(user):
        return True
    if not is_etl_operator(user):
        return False
    policy = resolve_job_access_policy(job)
    if policy.allowed_user_ids and user.user_id not in policy.allowed_user_ids:
        return False
    return any(role in policy.run_roles for role in user.normalized_roles)


def require_etl_operator_user(request: Request) -> GatewayUser:
    user = get_gateway_user(request)
    if not is_etl_operator(user):
        raise HTTPException(403, OPERATOR_FORBIDDEN_MESSAGE)
    return user


def require_etl_admin_user(request: Request) -> GatewayUser:
    user = get_gateway_user(request)
    if not is_etl_admin(user):
        raise HTTPException(403, ADMIN_FORBIDDEN_MESSAGE)
    return user


def ensure_can_view_job(user: GatewayUser, job: dict[str, Any]) -> None:
    if not can_view_job(user, job):
        raise HTTPException(403, JOB_SCOPE_FORBIDDEN_MESSAGE)


def ensure_can_run_job(user: GatewayUser, job: dict[str, Any]) -> None:
    if not can_run_job(user, job):
        raise HTTPException(403, JOB_SCOPE_FORBIDDEN_MESSAGE)


def sanitize_run_detail_for_user(user: GatewayUser, run_payload: dict[str, Any]) -> dict[str, Any]:
    if is_etl_admin(user):
        return run_payload
    payload = dict(run_payload)
    payload.pop("lineage", None)
    payload.pop("errors", None)
    return payload


def summarize_visible_workloads(
    backend: str,
    jobs: list[dict[str, Any]],
    runs: list[dict[str, Any]],
) -> dict[str, Any]:
    statuses = [str(run.get("status") or "") for run in runs]
    return {
        "backend": backend,
        "sources": len({str(job.get("sourceId") or "") for job in jobs if job.get("sourceId")}),
        "jobs": len(jobs),
        "runs": len(runs),
        "queuedRuns": statuses.count("queued"),
        "runningRuns": statuses.count("running"),
        "failedRuns": statuses.count("failed"),
    }


def filter_visible_jobs(user: GatewayUser, jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [job for job in jobs if can_view_job(user, job)]


def filter_visible_runs(
    job_ids: set[str],
    runs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return [run for run in runs if str(run.get("jobId") or "") in job_ids]


def require_admin_gateway_user(request: Request) -> GatewayUser:
    user = require_etl_admin_user(request)
    if not any(role in ETL_ADMIN_ROLES for role in user.normalized_roles):
        raise HTTPException(403, ADMIN_FORBIDDEN_MESSAGE)
    return user

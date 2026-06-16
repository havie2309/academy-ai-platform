from app.config import ADMIN_ROLES, SECURITY_RANK


def security_rank(level: str) -> int:
    return SECURITY_RANK.get(level, SECURITY_RANK["internal"])


def is_privileged(roles: list[str]) -> bool:
    return any(r in ADMIN_ROLES for r in roles)


def can_view_chunk(meta: dict, user: dict) -> bool:
    if meta.get("uploadedById") == user.get("userId"):
        return True
    if is_privileged(user.get("roles", [])):
        return True

    level = meta.get("securityLevel", "internal")
    if security_rank(level) > int(user.get("maxSecurityLevel", 1)):
        return False

    scope = meta.get("scopeType", "all")
    if scope == "all":
        return True
    if scope == "role":
        user_roles = set(user.get("roles", []))
        allowed = set(meta.get("accessRoleCodes", []))
        return bool(user_roles & allowed)
    if scope == "department":
        dept = user.get("department")
        return bool(dept and dept in meta.get("accessDepartmentCodes", []))
    if scope == "custom":
        return user.get("userId") in meta.get("accessUserIds", [])
    return False

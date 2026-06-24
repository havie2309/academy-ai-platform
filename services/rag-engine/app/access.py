from app.config import ADMIN_ROLES, SECURITY_RANK


def security_rank(level: str) -> int:
    return SECURITY_RANK.get(level, SECURITY_RANK["internal"])


def is_privileged(roles: list[str] | None) -> bool:
    return any(r in ADMIN_ROLES for r in (roles or []))


def _clean_str(value: object) -> str:
    return str(value or "").strip()


def _clean_list(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = _clean_str(value)
        if not item or item in seen:
            continue
        seen.add(item)
        cleaned.append(item)
    return cleaned


def build_document_access_query(
    user: dict,
    *,
    allow_adversarial: bool = False,
) -> dict:
    query: dict = {}
    if not allow_adversarial:
        query["isAdversarial"] = {"$ne": True}

    if is_privileged(user.get("roles", [])):
        return query

    user_id = _clean_str(user.get("userId"))
    department = _clean_str(user.get("department"))
    roles = _clean_list(user.get("roles"))
    try:
        max_security_level = int(user.get("maxSecurityLevel", 1))
    except (TypeError, ValueError):
        max_security_level = 1

    allowed_levels = [
        level
        for level, rank in SECURITY_RANK.items()
        if rank <= max(1, max_security_level)
    ]

    scope_clauses: list[dict] = [{"scopeType": "all"}]
    if roles:
        scope_clauses.append(
            {"scopeType": "role", "accessRoleCodes": {"$in": roles}}
        )
    if department:
        scope_clauses.append(
            {
                "scopeType": "department",
                "accessDepartmentCodes": {"$in": [department]},
            }
        )
    if user_id:
        scope_clauses.append(
            {"scopeType": "custom", "accessUserIds": {"$in": [user_id]}}
        )

    acl_clause = {
        "securityLevel": {"$in": allowed_levels},
        "$or": scope_clauses,
    }
    if user_id:
        query["$or"] = [{"uploadedById": user_id}, acl_clause]
    else:
        query.update(acl_clause)
    return query


def resolve_accessible_document_ids(
    db,
    user: dict,
    *,
    allow_adversarial: bool = False,
) -> list[str]:
    query = build_document_access_query(user, allow_adversarial=allow_adversarial)
    rows = list(db.documents.find(query))
    doc_ids: list[str] = []
    seen: set[str] = set()
    for row in rows:
        doc_id = _clean_str(row.get("docId"))
        if not doc_id or doc_id in seen:
            continue
        seen.add(doc_id)
        doc_ids.append(doc_id)
    return doc_ids


def build_milvus_document_expr(document_ids: list[str] | None) -> str | None:
    if not document_ids:
        return None
    quoted = ", ".join(
        f'"{str(document_id).replace(chr(34), "\\\"")}"'
        for document_id in document_ids
        if str(document_id).strip()
    )
    if not quoted:
        return None
    return f"document_id in [{quoted}]"


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

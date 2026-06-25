import unicodedata

from app.config import ADMIN_ROLES, SECURITY_RANK

ROLE_ALIASES: dict[str, str] = {
    "ADMIN": "ADMIN",
    "ADMINISTRATOR": "ADMIN",
    "BGD": "BGD",
    "P2": "P2",
    "P7": "P7",
    "HOC_VIEN": "HOC_VIEN",
    "HOCVIEN": "HOC_VIEN",
    "SINH_VIEN": "HOC_VIEN",
    "SINHVIEN": "HOC_VIEN",
    "HV": "HOC_VIEN",
    "GIANG_VIEN": "GIANG_VIEN",
    "GIANGVIEN": "GIANG_VIEN",
    "GV": "GIANG_VIEN",
}

ROLE_MATCH_TOKENS: dict[str, set[str]] = {
    "ADMIN": {"ADMIN", "Admin"},
    "BGD": {"BGD"},
    "P2": {"P2"},
    "P7": {"P7"},
    "HOC_VIEN": {"HOC_VIEN", "HOCVIEN", "SINH_VIEN", "SINHVIEN", "HV"},
    "GIANG_VIEN": {"GIANG_VIEN", "GIANGVIEN", "GV"},
}

ADMIN_NORMALIZED_ROLES = {
    ROLE_ALIASES.get(str(role).strip().upper(), str(role).strip().upper())
    for role in ADMIN_ROLES
}


def security_rank(level: str) -> int:
    return SECURITY_RANK.get(level, SECURITY_RANK["internal"])


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


def _fold_token(value: object) -> str:
    normalized = unicodedata.normalize("NFD", _clean_str(value))
    stripped = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return (
        stripped.replace("-", "_")
        .replace(" ", "_")
        .replace("/", "_")
        .upper()
    )


def normalize_role_code(role: object) -> str:
    folded = _fold_token(role)
    if folded in ROLE_ALIASES:
        return ROLE_ALIASES[folded]
    compact = folded.replace("_", "")
    return ROLE_ALIASES.get(compact, folded)


def normalize_roles(roles: object) -> set[str]:
    return {
        normalize_role_code(role)
        for role in _clean_list(roles)
        if _clean_str(role)
    }


def _role_inputs(user: dict) -> list[str]:
    inputs = []
    inputs.extend(_clean_list(user.get("normalizedRoles")))
    inputs.extend(_clean_list(user.get("roles")))
    return inputs


def _expanded_role_match_tokens(roles: list[str]) -> list[str]:
    seen: set[str] = set()
    tokens: list[str] = []
    for role in roles:
        raw = _clean_str(role)
        if raw and raw not in seen:
            seen.add(raw)
            tokens.append(raw)

        normalized = normalize_role_code(role)
        for alias in ROLE_MATCH_TOKENS.get(normalized, {normalized}):
            for candidate in {alias, alias.lower(), alias.upper()}:
                if candidate and candidate not in seen:
                    seen.add(candidate)
                    tokens.append(candidate)
    return tokens


def _department_match_tokens(value: object) -> list[str]:
    raw = _clean_str(value)
    if not raw:
        return []
    folded = _fold_token(raw)
    compact = folded.replace("_", "")
    seen: set[str] = set()
    tokens: list[str] = []
    for candidate in [raw, raw.lower(), raw.upper(), folded, compact]:
        if candidate and candidate not in seen:
            seen.add(candidate)
            tokens.append(candidate)
    return tokens


def _department_matches(user_department: object, allowed_values: object) -> bool:
    if not _clean_str(user_department):
        return False
    user_tokens = {_fold_token(token) for token in _department_match_tokens(user_department)}
    allowed_tokens = {
        _fold_token(value) for value in _clean_list(allowed_values) if _clean_str(value)
    }
    return bool(user_tokens & allowed_tokens)


def is_privileged(roles: object) -> bool:
    return bool(normalize_roles(roles) & ADMIN_NORMALIZED_ROLES)


def build_document_access_query(
    user: dict,
    *,
    allow_adversarial: bool = False,
) -> dict:
    query: dict = {}
    if not allow_adversarial:
        query["isAdversarial"] = {"$ne": True}

    role_inputs = _role_inputs(user)
    if is_privileged(role_inputs):
        return query

    user_id = _clean_str(user.get("userId"))
    department = _clean_str(user.get("department"))
    roles = _expanded_role_match_tokens(role_inputs)
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
                "accessDepartmentCodes": {"$in": _department_match_tokens(department)},
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
    role_inputs = _role_inputs(user)
    if is_privileged(role_inputs):
        return True

    level = meta.get("securityLevel", "internal")
    if security_rank(level) > int(user.get("maxSecurityLevel", 1)):
        return False

    scope = meta.get("scopeType", "all")
    if scope == "all":
        return True
    if scope == "role":
        user_roles = normalize_roles(role_inputs)
        allowed = normalize_roles(meta.get("accessRoleCodes", []))
        return bool(user_roles & allowed)
    if scope == "department":
        return _department_matches(
            user.get("department"),
            meta.get("accessDepartmentCodes", []),
        )
    if scope == "custom":
        return user.get("userId") in meta.get("accessUserIds", [])
    return False

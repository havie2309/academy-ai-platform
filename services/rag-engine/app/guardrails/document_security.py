from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from app.access import can_view_chunk

logger = logging.getLogger(__name__)

DOCUMENT_SECURITY_REFUSAL_MESSAGE = (
    "Tôi tìm thấy tài liệu liên quan nhưng không được phép sử dụng "
    "cho câu trả lời AI theo chính sách bảo mật của học viện."
)

VALID_SECURITY_LEVELS = frozenset({"public", "internal", "restricted", "confidential"})
VALID_PUBLICATION_STATUSES = frozenset(
    {"public", "internal", "confidential", "embargoed"}
)
VALID_AI_ACCESS_POLICIES = frozenset(
    {"allow", "deny", "restricted", "review_required"}
)

SENSITIVE_DOMAINS = frozenset({"exam", "credential", "payroll"})
EXAM_PRACTICE_TYPES = frozenset({"practice", "study_guide", "mock", "drill"})
EXAM_OFFICIAL_TYPES = frozenset({"official", "final", "midterm"})
EXAM_ANSWER_TYPES = frozenset({"answer_key", "answer", "solution", "dap_an"})
EXAM_UPCOMING_STATUSES = frozenset({"upcoming", "active", "scheduled", "in_progress"})
EXAM_SAFE_STATUSES = frozenset({"completed", "archived", "published", "past"})

CATEGORY_SECURITY_DEFAULTS: dict[str, dict[str, str]] = {
    "lịch thi": {"domain": "exam", "documentType": "exam"},
    "lich thi": {"domain": "exam", "documentType": "exam"},
    "tài liệu môn học": {"domain": "academic", "documentType": "course_material"},
    "tai lieu mon hoc": {"domain": "academic", "documentType": "course_material"},
    "quy chế": {"domain": "regulation", "documentType": "regulation"},
    "quy che": {"domain": "regulation", "documentType": "regulation"},
}


@dataclass
class DocumentSecurityMeta:
    document_type: str = "document"
    domain: str = "general"
    security_level: str = "internal"
    publication_status: str = "internal"
    ai_access_policy: str = "allow"
    owner_unit: str = ""
    allowed_roles: list[str] = field(default_factory=list)
    allowed_departments: list[str] = field(default_factory=list)
    allowed_user_ids: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    domain_metadata: dict[str, Any] = field(default_factory=dict)
    scope_type: str = "all"
    access_role_codes: list[str] = field(default_factory=list)
    access_department_codes: list[str] = field(default_factory=list)
    access_user_ids: list[str] = field(default_factory=list)
    uploaded_by_id: str = ""
    title: str = ""
    category: str = ""


@dataclass
class DocumentSecurityDecision:
    allowed: bool
    reason: str
    matched_rule_id: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def audit_payload(self) -> dict[str, Any]:
        return {
            "denyReason": None if self.allowed else self.reason,
            "matchedRuleId": self.matched_rule_id,
            "reason": self.reason,
            **self.details,
        }


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


def _pick(meta: dict, *keys: str, default: object = "") -> object:
    for key in keys:
        if key in meta and meta[key] not in (None, "", [], {}):
            return meta[key]
    return default


def _fold_category(value: object) -> str:
    text = _clean_str(value).lower()
    return text


def _category_defaults(category: str) -> dict[str, str]:
    folded = _fold_category(category)
    if folded in CATEGORY_SECURITY_DEFAULTS:
        return dict(CATEGORY_SECURITY_DEFAULTS[folded])
    return {"domain": "general", "documentType": "document"}


def _default_publication_status(security_level: str) -> str:
    if security_level == "public":
        return "public"
    if security_level == "confidential":
        return "confidential"
    return "internal"


def _default_ai_access_policy(security_level: str) -> str:
    if security_level == "confidential":
        return "deny"
    if security_level == "restricted":
        return "restricted"
    return "allow"


def document_row_to_security_meta(doc: dict | None) -> dict[str, Any]:
    if not doc:
        return {}
    category = _clean_str(doc.get("category"))
    defaults = _category_defaults(category)
    security_level = _clean_str(doc.get("securityLevel") or "internal").lower()
    publication_status = _clean_str(doc.get("publicationStatus") or "")
    ai_access_policy = _clean_str(doc.get("aiAccessPolicy") or "")
    domain_metadata = doc.get("domainMetadata") or {}
    if not isinstance(domain_metadata, dict):
        domain_metadata = {}

    return {
        "documentType": _clean_str(doc.get("documentType")) or defaults["documentType"],
        "domain": _clean_str(doc.get("domain")).lower() or defaults["domain"],
        "category": category,
        "securityLevel": security_level or "internal",
        "publicationStatus": publication_status
        or _default_publication_status(security_level or "internal"),
        "aiAccessPolicy": ai_access_policy
        or _default_ai_access_policy(security_level or "internal"),
        "ownerUnit": _clean_str(doc.get("ownerUnit")),
        "allowedRoles": _clean_list(doc.get("accessRoleCodes")),
        "allowedDepartments": _clean_list(doc.get("accessDepartmentCodes")),
        "allowedUserIds": _clean_list(doc.get("accessUserIds")),
        "tags": _clean_list(doc.get("tags")),
        "domainMetadata": domain_metadata,
        "scopeType": _clean_str(doc.get("scopeType") or "all") or "all",
        "accessRoleCodes": _clean_list(doc.get("accessRoleCodes")),
        "accessDepartmentCodes": _clean_list(doc.get("accessDepartmentCodes")),
        "accessUserIds": _clean_list(doc.get("accessUserIds")),
        "uploadedById": _clean_str(doc.get("uploadedById")),
        "title": _clean_str(doc.get("title")),
    }


def merge_chunk_and_document_metadata(
    chunk_meta: dict | None,
    document_meta: dict | None,
) -> dict[str, Any]:
    doc_fields = document_row_to_security_meta(document_meta or {})
    chunk = dict(chunk_meta or {})
    merged: dict[str, Any] = {**doc_fields}

    for key, value in chunk.items():
        if value in (None, "", [], {}):
            continue
        merged[key] = value

    category = _clean_str(merged.get("category") or doc_fields.get("category"))
    if category:
        merged["category"] = category
        defaults = _category_defaults(category)
        domain = _clean_str(merged.get("domain")).lower()
        if domain in ("", "general"):
            merged["domain"] = defaults["domain"]
            merged["documentType"] = (
                _clean_str(merged.get("documentType")) or defaults["documentType"]
            )

    if merged.get("domain") == "exam":
        tags = {_clean_str(tag).lower() for tag in _clean_list(merged.get("tags")) if tag}
        tags.add("exam")
        merged["tags"] = sorted(tags)

    return merged


def parse_document_security_meta(raw: dict | None) -> DocumentSecurityMeta:
    meta = raw or {}
    security_level = _clean_str(
        _pick(meta, "securityLevel", "security_level", default="internal")
    ).lower()
    if security_level not in VALID_SECURITY_LEVELS:
        security_level = "internal"

    publication_status = _clean_str(
        _pick(meta, "publicationStatus", "publication_status", default="")
    ).lower()
    if publication_status not in VALID_PUBLICATION_STATUSES:
        publication_status = _default_publication_status(security_level)

    ai_access_policy = _clean_str(
        _pick(meta, "aiAccessPolicy", "ai_access_policy", default="")
    ).lower()
    if ai_access_policy not in VALID_AI_ACCESS_POLICIES:
        ai_access_policy = _default_ai_access_policy(security_level)

    access_roles = _clean_list(
        _pick(meta, "allowedRoles", "allowed_roles", "accessRoleCodes", default=[])
    )
    access_departments = _clean_list(
        _pick(
            meta,
            "allowedDepartments",
            "allowed_departments",
            "accessDepartmentCodes",
            default=[],
        )
    )
    access_users = _clean_list(
        _pick(meta, "allowedUserIds", "allowed_user_ids", "accessUserIds", default=[])
    )

    domain_metadata = _pick(meta, "domainMetadata", "domain_metadata", default={})
    if not isinstance(domain_metadata, dict):
        domain_metadata = {}

    category = _clean_str(_pick(meta, "category", default=""))
    domain = _clean_str(_pick(meta, "domain", default="general")).lower() or "general"
    document_type = _clean_str(
        _pick(meta, "documentType", "document_type", default="document")
    ) or "document"

    if domain in ("", "general") and category:
        defaults = _category_defaults(category)
        domain = defaults["domain"]
        if document_type == "document":
            document_type = defaults["documentType"]

    return DocumentSecurityMeta(
        document_type=document_type,
        domain=domain,
        security_level=security_level,
        publication_status=publication_status,
        ai_access_policy=ai_access_policy,
        owner_unit=_clean_str(_pick(meta, "ownerUnit", "owner_unit", default="")),
        allowed_roles=access_roles,
        allowed_departments=access_departments,
        allowed_user_ids=access_users,
        tags=[tag.lower() for tag in _clean_list(_pick(meta, "tags", default=[]))],
        domain_metadata=domain_metadata,
        scope_type=_clean_str(_pick(meta, "scopeType", "scope_type", default="all"))
        or "all",
        access_role_codes=access_roles,
        access_department_codes=access_departments,
        access_user_ids=access_users,
        uploaded_by_id=_clean_str(_pick(meta, "uploadedById", "uploaded_by_id", default="")),
        title=_clean_str(_pick(meta, "title", default="")),
        category=category,
    )


def _decision_details(meta: DocumentSecurityMeta) -> dict[str, Any]:
    return {
        "securityLevel": meta.security_level,
        "publicationStatus": meta.publication_status,
        "aiAccessPolicy": meta.ai_access_policy,
        "domain": meta.domain,
        "domainMetadata": meta.domain_metadata,
        "documentType": meta.document_type,
        "tags": meta.tags,
        "category": meta.category,
    }


def _deny(
    rule_id: str,
    reason: str,
    meta: DocumentSecurityMeta,
) -> DocumentSecurityDecision:
    return DocumentSecurityDecision(
        allowed=False,
        reason=reason,
        matched_rule_id=rule_id,
        details=_decision_details(meta),
    )


def _allow(meta: DocumentSecurityMeta) -> DocumentSecurityDecision:
    return DocumentSecurityDecision(
        allowed=True,
        reason="allowed",
        matched_rule_id=None,
        details=_decision_details(meta),
    )


def _tag_set(meta: DocumentSecurityMeta) -> set[str]:
    return {tag.lower() for tag in meta.tags if tag}


def is_sensitive_document(meta: DocumentSecurityMeta) -> bool:
    if meta.domain in SENSITIVE_DOMAINS:
        return True
    if meta.document_type in {"exam", "answer_key", "credential"}:
        return True
    if _category_defaults(meta.category).get("domain") in SENSITIVE_DOMAINS:
        return True
    tags = _tag_set(meta)
    return bool(
        tags
        & {
            "exam",
            "answer_key",
            "confidential",
            "embargoed",
            "credential",
            "leak",
            "dap_an",
        }
    )


def _exam_field(meta: DocumentSecurityMeta, *keys: str) -> str:
    dm = meta.domain_metadata or {}
    for key in keys:
        value = _clean_str(dm.get(key))
        if value:
            return value.lower()
    return ""


def _check_answer_leak(meta: DocumentSecurityMeta) -> DocumentSecurityDecision | None:
    exam_type = _exam_field(meta, "examType", "exam_type")
    tags = _tag_set(meta)
    if meta.document_type == "answer_key":
        exam_type = exam_type or "answer_key"
    if exam_type in EXAM_ANSWER_TYPES or "answer_key" in tags or "dap_an" in tags:
        return _deny(
            "exam-answer-leak",
            "Exam answer or solution content is not allowed for AI retrieval.",
            meta,
        )
    return None


def _evaluate_exam_domain(meta: DocumentSecurityMeta) -> DocumentSecurityDecision | None:
    exam_type = _exam_field(meta, "examType", "exam_type")
    exam_status = _exam_field(meta, "examStatus", "exam_status")

    leak = _check_answer_leak(meta)
    if leak is not None:
        return leak

    if exam_type in EXAM_OFFICIAL_TYPES and exam_status in EXAM_UPCOMING_STATUSES:
        if meta.publication_status in {"embargoed", "confidential"}:
            return _deny(
                "exam-official-embargoed",
                "Official upcoming exam with embargoed publication status.",
                meta,
            )
        if meta.publication_status != "public":
            return _deny(
                "exam-official-unpublished",
                "Official upcoming exam is not publicly published.",
                meta,
            )
        if meta.ai_access_policy in {"deny", "review_required"}:
            return _deny(
                "exam-official-ai-deny",
                "Official upcoming exam is blocked by aiAccessPolicy.",
                meta,
            )

    if exam_type in EXAM_PRACTICE_TYPES or exam_type == "study_guide":
        if meta.publication_status in {"embargoed", "confidential"}:
            return _deny(
                "exam-practice-unpublished",
                "Practice material is not published for AI access.",
                meta,
            )
        if meta.ai_access_policy == "deny":
            return _deny(
                "exam-practice-ai-deny",
                "Practice material blocked by aiAccessPolicy.",
                meta,
            )
        return None

    if exam_type in EXAM_OFFICIAL_TYPES and exam_status in EXAM_SAFE_STATUSES:
        if meta.publication_status in {"embargoed", "confidential"}:
            return _deny(
                "exam-archive-embargoed",
                "Archived exam remains embargoed.",
                meta,
            )
        return None

    if not exam_type or not exam_status:
        return _deny(
            "metadata-missing-exam",
            "Exam domain requires domainMetadata.examType and examStatus.",
            meta,
        )

    if meta.publication_status in {"embargoed", "confidential"}:
        return _deny(
            "exam-embargoed",
            "Exam document publication status blocks AI access.",
            meta,
        )

    if meta.ai_access_policy in {"deny", "review_required"}:
        return _deny(
            "exam-unknown-ai-deny",
            "Unknown exam metadata with restrictive AI policy.",
            meta,
        )
    return _deny(
        "exam-unknown-type",
        "Exam document type/status is not approved for AI retrieval.",
        meta,
    )


def evaluate_document_security(
    raw_meta: dict,
    user: dict,
    *,
    query: str | None = None,
) -> DocumentSecurityDecision:
    meta = parse_document_security_meta(raw_meta)

    acl_meta = {
        "securityLevel": meta.security_level,
        "scopeType": meta.scope_type,
        "accessRoleCodes": meta.access_role_codes or meta.allowed_roles,
        "accessDepartmentCodes": meta.access_department_codes
        or meta.allowed_departments,
        "accessUserIds": meta.access_user_ids or meta.allowed_user_ids,
        "uploadedById": meta.uploaded_by_id,
    }
    if not can_view_chunk(acl_meta, user):
        return _deny(
            "acl-insufficient",
            "User lacks permission for document security level or scope.",
            meta,
        )

    _ = query
    return _allow(meta)


def filter_rows_by_document_security(
    rows: list[dict],
    user: dict,
    *,
    query: str = "",
    documents_by_id: dict[str, dict] | None = None,
) -> tuple[list[dict], list[tuple[dict, DocumentSecurityDecision]]]:
    allowed_rows: list[dict] = []
    blocked: list[tuple[dict, DocumentSecurityDecision]] = []
    docs = documents_by_id or {}

    for row in rows:
        doc_id = _clean_str(row.get("documentId"))
        chunk_meta = row.get("metadata", {})
        effective_meta = merge_chunk_and_document_metadata(
            chunk_meta,
            docs.get(doc_id),
        )
        decision = evaluate_document_security(effective_meta, user, query=query)
        if decision.allowed:
            allowed_rows.append(row)
            continue
        blocked.append((row, decision))
        log_document_security_block(
            query=query,
            user=user,
            doc_id=doc_id,
            chunk_id=_clean_str(row.get("chunkId")),
            decision=decision,
        )

    return allowed_rows, blocked


def log_document_security_block(
    *,
    query: str,
    user: dict | None,
    doc_id: str,
    chunk_id: str,
    decision: DocumentSecurityDecision,
) -> None:
    payload = {
        "event": "document_security_blocked",
        "query": query[:500],
        "userId": (user or {}).get("userId"),
        "docId": doc_id,
        "chunkId": chunk_id,
        **decision.audit_payload(),
    }
    logger.info("document_security_blocked %s", json.dumps(payload, ensure_ascii=False))


async def persist_document_security_audit(
    *,
    query: str,
    user: dict | None,
    doc_id: str,
    chunk_id: str,
    decision: DocumentSecurityDecision,
) -> None:
    from app.safe_refusal import log_policy_event

    audit = {
        "event": "document_security_blocked",
        "docId": doc_id,
        "chunkId": chunk_id,
        **decision.audit_payload(),
    }
    await log_policy_event(
        user=user,
        question=query,
        matched_rule_id=decision.matched_rule_id or "document-security",
        matched_keyword=chunk_id or doc_id,
        status="doc_blocked",
        audit_reason=json.dumps(audit, ensure_ascii=False),
    )


def build_document_security_refusal(
    decision: DocumentSecurityDecision | None = None,
    *,
    message: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "answer": message or DOCUMENT_SECURITY_REFUSAL_MESSAGE,
        "citations": [],
        "route": "refusal",
        "refusal_type": "document_security",
        "blocked_rule_id": (decision.matched_rule_id if decision else "document-security-all-denied"),
        "deny_reason": (
            decision.reason
            if decision
            else "All retrieved chunks were blocked by document security policy."
        ),
    }
    if decision:
        payload.update(decision.audit_payload())
    return payload

import asyncio
import json
import uuid
from datetime import datetime, timezone

import httpx
from ai_clients import ResilienceOptions, create_embeddings
from pymongo import MongoClient

from app.chunker import chunk_document_parent_child
from app.config import (
    CHUNK_MAX_CHILD_SIZE,
    CHUNK_MAX_PARENT_SIZE,
    CHUNK_OVERLAP,
    EMBEDDING_BASE_URL,
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_MAX_RETRIES,
    EMBEDDING_RETRY_BACKOFF_MS,
    MONGO_DB,
    MONGO_URI,
    SECURITY_RANK,
)
from app.extract import extract_text
from app.milvus_store import delete_chunk_ids, delete_document_except, insert_vectors

VALID_SCOPE_TYPES = {"all", "role", "department", "custom"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


_mongo_client: MongoClient | None = None


def _get_mongo() -> MongoClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(MONGO_URI)
    return _mongo_client


def _mongo() -> MongoClient:
    return _get_mongo()


def _compact_ws(text: object) -> str:
    return " ".join(str(text or "").split())


def _with_section_prefix(
    text: str,
    *,
    section_path: str = "",
    parent_preview: str = "",
) -> str:
    parts: list[str] = []
    section = _compact_ws(section_path)
    preview = _compact_ws(parent_preview)
    body = text.strip()

    if section:
        parts.append(section)
    if preview and preview not in body:
        parts.append(preview)
    parts.append(body)
    return "\n\n".join(part for part in parts if part)


def _child_embedding_text(child: dict, *, title: str = "") -> str:
    meta = child.get("metadata", {})
    body = _with_section_prefix(
        child.get("text", ""),
        section_path=meta.get("section_path") or meta.get("sectionPath") or "",
        parent_preview=meta.get("parent_preview") or meta.get("parentPreview") or "",
    )
    title_text = _compact_ws(title)
    if not title_text:
        return body
    return f"Van ban: {title_text}\n\n{body}"


def _cleanup_partial_parent_child_index(
    db,
    document_id: str,
    parent_ids: list[str],
    child_ids: list[str],
) -> None:
    if parent_ids:
        db.document_chunks.delete_many(
            {
                "documentId": document_id,
                "chunkType": "parent",
                "chunkId": {"$in": parent_ids},
            }
        )
    if child_ids:
        db.document_chunks.delete_many(
            {
                "documentId": document_id,
                "chunkType": "child",
                "chunkId": {"$in": child_ids},
            }
        )
        delete_chunk_ids(child_ids)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    batch_size = max(1, min(EMBEDDING_BATCH_SIZE, 64))
    vectors: list[list[float]] = []
    resilience_options = ResilienceOptions(
        max_attempts=max(1, EMBEDDING_MAX_RETRIES),
        backoff_ms=max(0, EMBEDDING_RETRY_BACKOFF_MS),
    )
    async with httpx.AsyncClient(timeout=120) as client:
        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            data = await create_embeddings(
                base_url=EMBEDDING_BASE_URL,
                inputs=chunk,
                client=client,
                resilience_options=resilience_options,
            )
            if len(data) != len(chunk):
                raise ValueError("Embedding response count mismatch.")
            vectors.extend(data)
    return vectors


def _clean_list(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = str(value).strip()
        if not item:
            continue
        if item in seen:
            continue
        seen.add(item)
        cleaned.append(item)
    return cleaned


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


def _parse_domain_metadata(raw: object) -> dict:
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {}
    return {}


def _build_document_security_metadata(job: dict) -> dict:
    security_level = str(job.get("securityLevel") or "internal").strip().lower()
    scope_type = str(job.get("scopeType") or "all").strip().lower()
    access_role_codes = _clean_list(job.get("accessRoleCodes"))
    access_department_codes = _clean_list(job.get("accessDepartmentCodes"))
    access_user_ids = _clean_list(job.get("accessUserIds"))
    tags = _clean_list(job.get("tags"))
    domain_metadata = _parse_domain_metadata(
        job.get("domainMetadata") or job.get("domain_metadata")
    )

    document_type = str(job.get("documentType") or job.get("document_type") or "document").strip()
    domain = str(job.get("domain") or "general").strip().lower() or "general"
    publication_status = str(
        job.get("publicationStatus") or job.get("publication_status") or ""
    ).strip().lower()
    if publication_status not in {"public", "internal", "confidential", "embargoed"}:
        publication_status = _default_publication_status(security_level)

    ai_access_policy = str(
        job.get("aiAccessPolicy") or job.get("ai_access_policy") or ""
    ).strip().lower()
    if ai_access_policy not in {"allow", "deny", "restricted", "review_required"}:
        ai_access_policy = _default_ai_access_policy(security_level)

    owner_unit = str(job.get("ownerUnit") or job.get("owner_unit") or "").strip()

    return {
        "documentType": document_type or "document",
        "domain": domain,
        "securityLevel": security_level,
        "publicationStatus": publication_status,
        "aiAccessPolicy": ai_access_policy,
        "ownerUnit": owner_unit,
        "allowedRoles": access_role_codes,
        "allowedDepartments": access_department_codes,
        "allowedUserIds": access_user_ids,
        "tags": tags,
        "domainMetadata": domain_metadata,
        "scopeType": scope_type,
        "accessRoleCodes": access_role_codes,
        "accessDepartmentCodes": access_department_codes,
        "accessUserIds": access_user_ids,
        "uploadedById": str(job.get("uploadedById") or "").strip(),
    }


def _validate_job(job: dict) -> dict:
    normalized = dict(job)
    document_id = str(normalized.get("documentId") or "").strip()
    storage_path = str(normalized.get("storagePath") or "").strip()
    if not document_id or not storage_path:
        raise ValueError("Thiếu documentId hoặc storagePath cho job ingest.")

    security_level = str(normalized.get("securityLevel") or "internal").strip().lower()
    if security_level not in SECURITY_RANK:
        raise ValueError(f"Mức mật không hợp lệ: {security_level}")

    scope_type = str(normalized.get("scopeType") or "all").strip().lower()
    if scope_type not in VALID_SCOPE_TYPES:
        raise ValueError(f"Phạm vi truy cập không hợp lệ: {scope_type}")

    access_role_codes = _clean_list(normalized.get("accessRoleCodes"))
    access_department_codes = _clean_list(normalized.get("accessDepartmentCodes"))
    access_user_ids = _clean_list(normalized.get("accessUserIds"))

    if scope_type == "role" and not access_role_codes:
        raise ValueError("scopeType=role yêu cầu accessRoleCodes không rỗng.")
    if scope_type == "department" and not access_department_codes:
        raise ValueError(
            "scopeType=department yêu cầu accessDepartmentCodes không rỗng."
        )
    if scope_type == "custom" and not access_user_ids:
        raise ValueError("scopeType=custom yêu cầu accessUserIds không rỗng.")

    normalized["documentId"] = document_id
    normalized["storagePath"] = storage_path
    normalized["securityLevel"] = security_level
    normalized["scopeType"] = scope_type
    normalized["accessRoleCodes"] = access_role_codes if scope_type == "role" else []
    normalized["accessDepartmentCodes"] = (
        access_department_codes if scope_type == "department" else []
    )
    normalized["accessUserIds"] = access_user_ids if scope_type == "custom" else []
    normalized["uploadedById"] = str(normalized.get("uploadedById") or "").strip()
    normalized["title"] = str(normalized.get("title") or document_id).strip()
    normalized["mimeType"] = str(normalized.get("mimeType") or "").strip()
    normalized["documentType"] = str(
        normalized.get("documentType") or normalized.get("document_type") or "document"
    ).strip()
    normalized["domain"] = str(normalized.get("domain") or "general").strip().lower()
    normalized["publicationStatus"] = str(
        normalized.get("publicationStatus") or normalized.get("publication_status") or ""
    ).strip().lower()
    normalized["aiAccessPolicy"] = str(
        normalized.get("aiAccessPolicy") or normalized.get("ai_access_policy") or ""
    ).strip().lower()
    normalized["ownerUnit"] = str(
        normalized.get("ownerUnit") or normalized.get("owner_unit") or ""
    ).strip()
    normalized["tags"] = _clean_list(normalized.get("tags"))
    normalized["domainMetadata"] = _parse_domain_metadata(
        normalized.get("domainMetadata") or normalized.get("domain_metadata")
    )
    return normalized


def _update_job(
    db,
    document_id: str,
    *,
    status: str,
    stage: str | None = None,
    chunk_count: int | None = None,
    error: str | None = None,
) -> None:
    now = _utcnow()
    db.processing_jobs.update_one(
        {"documentId": document_id},
        {
            "$set": {
                "status": status,
                **({"stage": stage} if stage else {}),
                **({"chunkCount": chunk_count} if chunk_count is not None else {}),
                **({"errorMessage": error} if error else {}),
                "updatedAt": now,
            },
            "$setOnInsert": {"jobId": str(uuid.uuid4()), "createdAt": now},
        },
        upsert=True,
    )
    doc_set: dict = {
        "ingestStatus": status,
        "ingestUpdatedAt": now,
        "updatedAt": now,
    }
    if stage:
        doc_set["ingestStage"] = stage
    if chunk_count is not None:
        doc_set["chunkCount"] = chunk_count
    if error:
        doc_set["ingestError"] = error
    elif status == "completed":
        doc_set["ingestError"] = None

    db.documents.update_one({"docId": document_id}, {"$set": doc_set})

    # When a document finishes (completed or failed), sync status back to document_requests.
    # The documents record carries requestId + requestFileId so we can do this without extra lookups.
    if status in ("completed", "failed"):
        doc = db.documents.find_one(
            {"docId": document_id},
            {"requestId": 1, "requestFileId": 1},
        )
        if doc and doc.get("requestId"):
            request_id = doc["requestId"]
            file_id = doc.get("requestFileId")
            # documents uses 'completed', but document_requests.files uses 'done'
            file_status = "done" if status == "completed" else "failed"
            db.document_requests.update_one(
                {"requestId": request_id, "files.fileId": file_id},
                {"$set": {"files.$.ingestStatus": file_status}},
            )
            # If every file is now terminal (done or failed), close the request
            request = db.document_requests.find_one(
                {"requestId": request_id, "status": "processing"},
                {"files": 1},
            )
            if request:
                files = request.get("files", [])
                if files and all(
                    f.get("ingestStatus") in ("done", "failed") for f in files
                ):
                    db.document_requests.update_one(
                        {"requestId": request_id},
                        {"$set": {"status": "done"}},
                    )


async def process_document(job: dict) -> dict:
    job = _validate_job(job)
    document_id = job["documentId"]
    storage_path = job["storagePath"]
    title = job.get("title", document_id)
    mime_type = job.get("mimeType", "")

    db = _mongo()[MONGO_DB]
    parent_ids: list[str] = []
    chunk_ids: list[str] = []

    try:
        _update_job(db, document_id, status="processing", stage="extract")

        raw_text = extract_text(storage_path, mime_type)
        if not raw_text.strip():
            raise ValueError("Không trích xuất được nội dung từ file.")

        _update_job(db, document_id, status="processing", stage="chunk")
        chunk_result = chunk_document_parent_child(
            raw_text,
            max_child_size=CHUNK_MAX_CHILD_SIZE,
            max_parent_size=CHUNK_MAX_PARENT_SIZE,
            overlap=CHUNK_OVERLAP,
        )

        parent_nodes = chunk_result["parent_nodes"]
        child_nodes = chunk_result["child_nodes"]

        if not child_nodes:
            raise ValueError("Không tạo được chunk từ nội dung.")

        _update_job(db, document_id, status="processing", stage="embed")
        vectors = await embed_texts(
            [_child_embedding_text(child, title=title) for child in child_nodes]
        )

        if len(vectors) != len(child_nodes):
            raise ValueError(
                f"Embedding lệch số lượng: {len(vectors)} vector vs {len(child_nodes)} chunk."
            )

        security_level = job.get("securityLevel", "internal")
        security_rank = SECURITY_RANK.get(security_level, 2)
        security_metadata = _build_document_security_metadata(job)

        _update_job(db, document_id, status="processing", stage="index")

        parent_ids = [parent["id"] for parent in parent_nodes]
        chunk_ids = [child["id"] for child in child_nodes]

        parent_docs = []
        for p_idx, parent in enumerate(parent_nodes):
            parent_docs.append(
                {
                    "chunkId": parent["id"],
                    "documentId": document_id,
                    "chunkType": "parent",
                    "chunkText": parent["text"],
                    "chunkIndex": -p_idx - 1,
                    "metadata": {
                        **parent["metadata"],
                        **security_metadata,
                        "title": title,
                        "childIds": parent.get("child_ids", []),
                    },
                    "createdAt": _utcnow(),
                }
            )
        if parent_docs:
            db.document_chunks.insert_many(parent_docs)

        milvus_ids = insert_vectors(
            chunk_ids,
            [document_id] * len(child_nodes),
            [security_rank] * len(child_nodes),
            vectors,
        )

        child_docs = []
        for c_idx, (child, mid) in enumerate(zip(child_nodes, milvus_ids)):
            child_docs.append(
                {
                    "chunkId": child["id"],
                    "documentId": document_id,
                    "parentId": child["parent_id"],
                    "chunkType": "child",
                    "chunkText": child["text"],
                    "chunkIndex": c_idx,
                    "milvusVectorId": str(mid),
                    "metadata": {
                        **child["metadata"],
                        **security_metadata,
                        "title": title,
                    },
                    "createdAt": _utcnow(),
                }
            )
        if child_docs:
            db.document_chunks.insert_many(child_docs)

        db.document_chunks.delete_many(
            {
                "documentId": document_id,
                "chunkType": "child",
                "chunkId": {"$nin": chunk_ids},
            }
        )
        db.document_chunks.delete_many(
            {
                "documentId": document_id,
                "chunkType": "parent",
                "chunkId": {"$nin": parent_ids},
            }
        )
        delete_document_except(document_id, chunk_ids)

        _update_job(
            db,
            document_id,
            status="completed",
            stage="done",
            chunk_count=len(child_nodes),
        )

        return {
            "documentId": document_id,
            "chunkCount": len(child_nodes),
            "parentCount": len(parent_nodes),
            "status": "completed",
        }

    except Exception as exc:
        _cleanup_partial_parent_child_index(db, document_id, parent_ids, chunk_ids)
        _update_job(
            db,
            document_id,
            status="failed",
            stage="error",
            error=str(exc)[:500],
        )
        raise

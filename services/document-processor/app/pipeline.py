import asyncio
import uuid
from datetime import datetime, timezone

import httpx
from pymongo import MongoClient

from app.chunker import chunk_document
from app.config import (
    CHUNK_MAX_SIZE,
    CHUNK_OVERLAP,
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_BASE_URL,
    EMBEDDING_MAX_RETRIES,
    EMBEDDING_RETRY_BACKOFF_MS,
    MONGO_DB,
    MONGO_URI,
    SECURITY_RANK,
)
from app.extract import extract_text
from app.milvus_store import delete_document_except, insert_vectors

VALID_SCOPE_TYPES = {"all", "role", "department", "custom"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _mongo() -> MongoClient:
    return MongoClient(MONGO_URI)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    batch_size = max(1, min(EMBEDDING_BATCH_SIZE, 64))
    vectors: list[list[float]] = []
    async with httpx.AsyncClient(timeout=120) as client:
        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            data = None
            last_error: Exception | None = None
            for attempt in range(1, max(1, EMBEDDING_MAX_RETRIES) + 1):
                try:
                    res = await client.post(
                        f"{EMBEDDING_BASE_URL.rstrip('/')}/v1/embeddings",
                        json={"input": chunk},
                    )
                    res.raise_for_status()
                    data = res.json()["data"]
                    if len(data) != len(chunk):
                        raise ValueError("Embedding response count mismatch.")
                    break
                except Exception as exc:
                    last_error = exc
                    if attempt >= max(1, EMBEDDING_MAX_RETRIES):
                        raise
                    await asyncio.sleep(EMBEDDING_RETRY_BACKOFF_MS / 1000 * attempt)
            if data is None:
                raise RuntimeError(f"Embedding batch failed: {last_error}")
            vectors.extend(item["embedding"] for item in data)
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


async def process_document(job: dict) -> dict:
    job = _validate_job(job)
    document_id = job["documentId"]
    storage_path = job["storagePath"]
    title = job.get("title", document_id)
    mime_type = job.get("mimeType", "")

    client = _mongo()
    db = client[MONGO_DB]

    try:
        _update_job(db, document_id, status="processing", stage="extract")

        raw_text = extract_text(storage_path, mime_type)
        if not raw_text.strip():
            raise ValueError("Không trích xuất được nội dung từ file.")

        _update_job(db, document_id, status="processing", stage="chunk")
        chunks = chunk_document(raw_text, CHUNK_MAX_SIZE, CHUNK_OVERLAP)
        if not chunks:
            raise ValueError("Không tạo được chunk từ nội dung.")

        _update_job(db, document_id, status="processing", stage="embed")
        vectors = await embed_texts([c.text for c in chunks])

        if len(vectors) != len(chunks):
            raise ValueError(
                f"Embedding lệch số lượng: {len(vectors)} vector vs {len(chunks)} chunk."
            )

        security_level = job.get("securityLevel", "internal")
        security_rank = SECURITY_RANK.get(security_level, 2)

        _update_job(db, document_id, status="processing", stage="index")
        chunk_ids: list[str] = []
        document_ids: list[str] = []
        security_ranks: list[int] = []
        mongo_docs: list[dict] = []

        for idx, chunk in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            chunk_ids.append(chunk_id)
            document_ids.append(document_id)
            security_ranks.append(security_rank)
            metadata = {
                "title": title,
                "securityLevel": security_level,
                "scopeType": job.get("scopeType", "all"),
                "accessRoleCodes": job.get("accessRoleCodes", []),
                "accessDepartmentCodes": job.get("accessDepartmentCodes", []),
                "accessUserIds": job.get("accessUserIds", []),
                "uploadedById": job.get("uploadedById", ""),
                "accessPolicy": {
                    "securityLevel": security_level,
                    "scopeType": job.get("scopeType", "all"),
                    "roleCodes": job.get("accessRoleCodes", []),
                    "departmentCodes": job.get("accessDepartmentCodes", []),
                    "userIds": job.get("accessUserIds", []),
                },
            }
            if chunk.section_path:
                metadata["sectionPath"] = chunk.section_path
            mongo_docs.append(
                {
                    "chunkId": chunk_id,
                    "documentId": document_id,
                    "chunkIndex": idx,
                    "chunkText": chunk.text,
                    "metadata": metadata,
                    "createdAt": _utcnow(),
                }
            )

        milvus_ids = insert_vectors(chunk_ids, document_ids, security_ranks, vectors)
        for i, mid in enumerate(milvus_ids):
            mongo_docs[i]["milvusVectorId"] = str(mid)

        if mongo_docs:
            db.document_chunks.insert_many(mongo_docs)

        # Bản mới đã ghi xong → xóa phần cũ (và vector/chunk mồ côi từ lần ingest lỗi trước).
        db.document_chunks.delete_many(
            {"documentId": document_id, "chunkId": {"$nin": chunk_ids}}
        )
        delete_document_except(document_id, chunk_ids)

        _update_job(
            db,
            document_id,
            status="completed",
            stage="done",
            chunk_count=len(chunks),
        )
        return {"documentId": document_id, "chunkCount": len(chunks), "status": "completed"}

    except Exception as exc:
        _update_job(
            db,
            document_id,
            status="failed",
            stage="error",
            error=str(exc)[:500],
        )
        raise
    finally:
        client.close()

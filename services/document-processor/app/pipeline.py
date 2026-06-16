import uuid
from datetime import datetime, timezone

import httpx
from pymongo import MongoClient

from app.chunker import chunk_text
from app.config import (
    CHUNK_MAX_SIZE,
    CHUNK_OVERLAP,
    EMBEDDING_BASE_URL,
    MONGO_DB,
    MONGO_URI,
    SECURITY_RANK,
)
from app.extract import extract_text
from app.milvus_store import delete_by_document, insert_vectors


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _mongo() -> MongoClient:
    return MongoClient(MONGO_URI)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{EMBEDDING_BASE_URL.rstrip('/')}/v1/embeddings",
            json={"input": texts},
        )
        res.raise_for_status()
        data = res.json()["data"]
        return [item["embedding"] for item in data]


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
        chunks = chunk_text(raw_text, CHUNK_MAX_SIZE, CHUNK_OVERLAP)
        if not chunks:
            raise ValueError("Không tạo được chunk từ nội dung.")

        _update_job(db, document_id, status="processing", stage="embed")
        vectors = await embed_texts(chunks)

        security_level = job.get("securityLevel", "internal")
        security_rank = SECURITY_RANK.get(security_level, 2)

        db.document_chunks.delete_many({"documentId": document_id})
        delete_by_document(document_id)

        _update_job(db, document_id, status="processing", stage="index")
        chunk_ids: list[str] = []
        document_ids: list[str] = []
        security_ranks: list[int] = []
        mongo_docs: list[dict] = []

        for idx, (chunk_text_value, vector) in enumerate(zip(chunks, vectors)):
            chunk_id = str(uuid.uuid4())
            chunk_ids.append(chunk_id)
            document_ids.append(document_id)
            security_ranks.append(security_rank)
            mongo_docs.append(
                {
                    "chunkId": chunk_id,
                    "documentId": document_id,
                    "chunkIndex": idx,
                    "chunkText": chunk_text_value,
                    "metadata": {
                        "title": title,
                        "securityLevel": security_level,
                        "scopeType": job.get("scopeType", "all"),
                        "accessRoleCodes": job.get("accessRoleCodes", []),
                        "accessDepartmentCodes": job.get("accessDepartmentCodes", []),
                        "accessUserIds": job.get("accessUserIds", []),
                        "uploadedById": job.get("uploadedById", ""),
                    },
                    "createdAt": _utcnow(),
                }
            )

        milvus_ids = insert_vectors(chunk_ids, document_ids, security_ranks, vectors)
        for i, mid in enumerate(milvus_ids):
            mongo_docs[i]["milvusVectorId"] = str(mid)

        if mongo_docs:
            db.document_chunks.insert_many(mongo_docs)

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

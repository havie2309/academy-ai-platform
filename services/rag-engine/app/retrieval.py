import httpx
from pymongo import MongoClient

from app.access import can_view_chunk
from app.config import (
    EMBEDDING_BASE_URL,
    MONGO_DB,
    MONGO_URI,
    RETRIEVAL_TOP_K,
)
from app.milvus_search import search_vectors
from app.rerank import rerank_citations


async def embed_query(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{EMBEDDING_BASE_URL.rstrip('/')}/v1/embeddings",
            json={"input": text},
        )
        res.raise_for_status()
        return res.json()["data"][0]["embedding"]


def _build_citation(row: dict, chunk_id: str, vector_score: float | None) -> dict:
    meta = row.get("metadata", {})
    text = row.get("chunkText", "")
    snippet = text[:280] + ("…" if len(text) > 280 else "")
    return {
        "doc_id": row.get("documentId", ""),
        "chunk_id": chunk_id,
        "title": meta.get("title", "Tài liệu"),
        "snippet": snippet,
        "text": text,
        "source": meta.get("title", "Kho tài liệu"),
        "score": vector_score,
    }


async def retrieve_citations(query: str, user: dict) -> list[dict]:
    query = query.strip()
    if not query:
        return []

    try:
        vector = await embed_query(query)
    except Exception:
        return []

    try:
        hits = search_vectors(vector, RETRIEVAL_TOP_K)
    except Exception:
        return []

    if not hits:
        return []

    chunk_ids = [h["chunk_id"] for h in hits if h.get("chunk_id")]
    if not chunk_ids:
        return []

    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    try:
        rows = list(db.document_chunks.find({"chunkId": {"$in": chunk_ids}}))
    finally:
        client.close()

    by_id = {r["chunkId"]: r for r in rows}
    candidates: list[dict] = []

    for hit in hits:
        chunk_id = hit.get("chunk_id")
        row = by_id.get(chunk_id)
        if not row:
            continue
        meta = row.get("metadata", {})
        if not can_view_chunk(meta, user):
            continue
        candidates.append(_build_citation(row, chunk_id, hit.get("score")))

    return await rerank_citations(query, candidates)

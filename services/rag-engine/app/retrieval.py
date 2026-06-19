import httpx
import re
from pymongo import MongoClient

from app.access import can_view_chunk
from app.cache import RedisCache
from app.citation_select import limit_chunks_per_doc
from app.config import (
    EMBEDDING_BASE_URL,
    MAX_CHUNKS_PER_DOC,
    MONGO_DB,
    MONGO_URI,
    RERANK_SCORE_DELTA,
    RERANK_SCORE_MIN,
    RETRIEVAL_TOP_K,
    VECTOR_SCORE_MIN,
)
from app.milvus_search import search_vectors
from app.rerank import rerank_citations

cache = RedisCache()

COMPARE_KEYWORDS = (
    "so sánh",
    "so sanh",
    "khác nhau",
    "cũ và mới",
    "mới và cũ",
    "quy định cũ",
    "quy dinh cu",
    "quy định mới",
    "quy dinh moi",
)
OLD_DOC_KEYWORDS = ("conflict", "cũ", "cu", "old")
YEAR_RE = re.compile(r"(20\d{2})(?:\D+(20\d{2}))?")


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
    citation = {
        "doc_id": row.get("documentId", ""),
        "chunk_id": chunk_id,
        "title": meta.get("title", "Tài liệu"),
        "snippet": snippet,
        "text": text,
        "source": meta.get("title", "Kho tài liệu"),
        "score": vector_score,
    }
    section_path = meta.get("sectionPath")
    if section_path:
        citation["section_path"] = section_path
    return citation


def _is_compare_query(query: str) -> bool:
    q = query.lower()
    return any(k in q for k in COMPARE_KEYWORDS)


def _extract_year_pairs(text: str) -> list[tuple[int, int]]:
    pairs: list[tuple[int, int]] = []
    for y1, y2 in YEAR_RE.findall(text):
        start = int(y1)
        end = int(y2) if y2 else start
        if start > end:
            start, end = end, start
        pairs.append((start, end))
    return pairs


def _doc_text(c: dict) -> str:
    return " ".join(
        [
            str(c.get("doc_id", "")),
            str(c.get("title", "")),
            str(c.get("source", "")),
            str(c.get("snippet", "")),
        ]
    ).lower()


def _apply_year_policy(query: str, citations: list[dict]) -> list[dict]:
    if not citations:
        return []
    query_pairs = _extract_year_pairs(query)
    allow_compare = _is_compare_query(query)

    if allow_compare:
        return citations

    if query_pairs:
        query_years = {y for p in query_pairs for y in p}
        matched = []
        for c in citations:
            years = {y for p in _extract_year_pairs(_doc_text(c)) for y in p}
            if years and years & query_years:
                matched.append(c)
        if matched:
            return matched

    # No explicit year in query: keep newest academic year if identifiable.
    with_year = []
    for c in citations:
        pairs = _extract_year_pairs(_doc_text(c))
        if pairs:
            latest_end = max(end for _, end in pairs)
            with_year.append((latest_end, c))
    if with_year:
        max_end = max(end for end, _ in with_year)
        return [c for end, c in with_year if end == max_end]

    return citations


def _filter_old_conflict_docs(query: str, citations: list[dict]) -> list[dict]:
    if _is_compare_query(query):
        return citations
    filtered = []
    for c in citations:
        text = _doc_text(c)
        if any(k in text for k in OLD_DOC_KEYWORDS):
            continue
        filtered.append(c)
    return filtered


def _apply_score_thresholds(citations: list[dict]) -> list[dict]:
    if not citations:
        return []
    # Base filter by vector similarity.
    after_vector = [
        c for c in citations if float(c.get("score", 0.0) or 0.0) >= VECTOR_SCORE_MIN
    ]
    if not after_vector:
        after_vector = citations[:]

    rerank_scores = [
        float(c.get("rerank_score"))
        for c in after_vector
        if c.get("rerank_score") is not None
    ]
    if not rerank_scores:
        return after_vector

    top = max(rerank_scores)
    floor = max(RERANK_SCORE_MIN, top - RERANK_SCORE_DELTA)
    after_rerank = [
        c
        for c in after_vector
        if c.get("rerank_score") is None or float(c.get("rerank_score")) >= floor
    ]
    return after_rerank or after_vector


async def retrieve_citations(query: str, user: dict) -> list[dict]:
    query = query.strip()
    if not query:
        return []
    
    # Check cache first
    user_id = user.get("userId")
    cached = cache.get_retrieval(query, user_id)
    if cached:
        print(f"Cache hit for: {query[:50]}...")
        return cached

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

    reranked = await rerank_citations(query, candidates)
    selected = _apply_score_thresholds(reranked)
    selected = _filter_old_conflict_docs(query, selected)
    selected = _apply_year_policy(query, selected)
    selected.sort(
        key=lambda c: float(c.get("rerank_score", c.get("score", -9999))),
        reverse=True,
    )
    selected = limit_chunks_per_doc(selected, MAX_CHUNKS_PER_DOC)
    
    cache.set_retrieval(query, selected, user_id)
    print(f"Cache miss for: {query[:50]}...")

    return selected

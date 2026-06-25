import logging
import re

import httpx
from pymongo import MongoClient

from app.access import (
    build_milvus_document_expr,
    can_view_chunk,
    resolve_accessible_document_ids,
)
from app.cache import RedisCache
from app.citation_select import limit_chunks_per_doc
from app.config import (
    ALLOW_ADVERSARIAL_DOCS,
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
from app.rerank import limit_context_budget, rerank_citations

logger = logging.getLogger(__name__)
cache = RedisCache()


def _get_mongo() -> MongoClient:
    return MongoClient(MONGO_URI)


COMPARE_KEYWORDS = (
    "so sánh",
    "so sanh",
    "khác nhau",
    "khac nhau",
    "cũ và mới",
    "cu va moi",
    "mới và cũ",
    "moi va cu",
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
    snippet = text[:280] + ("..." if len(text) > 280 else "")
    citation = {
        "doc_id": row.get("documentId", ""),
        "chunk_id": chunk_id,
        "title": meta.get("title", "Tai lieu"),
        "snippet": snippet,
        "text": text,
        "source": meta.get("title", "Kho tai lieu"),
        "score": vector_score,
    }
    section_path = meta.get("sectionPath") or meta.get("section_path")
    if section_path:
        citation["section_path"] = section_path
    return citation


def _is_compare_query(query: str) -> bool:
    q = query.lower()
    return any(keyword in q for keyword in COMPARE_KEYWORDS)


def _extract_year_pairs(text: str) -> list[tuple[int, int]]:
    pairs: list[tuple[int, int]] = []
    for y1, y2 in YEAR_RE.findall(text):
        start = int(y1)
        end = int(y2) if y2 else start
        if start > end:
            start, end = end, start
        pairs.append((start, end))
    return pairs


def _doc_text(citation: dict) -> str:
    return " ".join(
        [
            str(citation.get("doc_id", "")),
            str(citation.get("title", "")),
            str(citation.get("source", "")),
            str(citation.get("snippet", "")),
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
        query_years = {year for pair in query_pairs for year in pair}
        matched = []
        for citation in citations:
            years = {
                year for pair in _extract_year_pairs(_doc_text(citation)) for year in pair
            }
            if years and years & query_years:
                matched.append(citation)
        if matched:
            return matched

    with_year = []
    for citation in citations:
        pairs = _extract_year_pairs(_doc_text(citation))
        if pairs:
            latest_end = max(end for _, end in pairs)
            with_year.append((latest_end, citation))
    if with_year:
        max_end = max(end for end, _ in with_year)
        return [citation for end, citation in with_year if end == max_end]

    return citations


def _filter_old_conflict_docs(query: str, citations: list[dict]) -> list[dict]:
    if _is_compare_query(query):
        return citations
    filtered = []
    for citation in citations:
        text = _doc_text(citation)
        if any(keyword in text for keyword in OLD_DOC_KEYWORDS):
            continue
        filtered.append(citation)
    return filtered


def _apply_score_thresholds(citations: list[dict]) -> list[dict]:
    if not citations:
        return []
    after_vector = [
        citation
        for citation in citations
        if float(citation.get("score", 0.0) or 0.0) >= VECTOR_SCORE_MIN
    ]
    if not after_vector:
        after_vector = citations[:]

    rerank_scores = [
        float(citation.get("rerank_score"))
        for citation in after_vector
        if citation.get("rerank_score") is not None
    ]
    if not rerank_scores:
        return after_vector

    top = max(rerank_scores)
    floor = max(RERANK_SCORE_MIN, top - RERANK_SCORE_DELTA)
    after_rerank = [
        citation
        for citation in after_vector
        if citation.get("rerank_score") is None
        or float(citation.get("rerank_score")) >= floor
    ]
    return after_rerank or after_vector


async def retrieve_citations(query: str, user: dict) -> list[dict]:
    """
    Retrieve parent citations from child-vector hits.

    Access metadata remains source-of-truth in Mongo `documents`, but we also
    push the accessible document ids down into Milvus before vector search.
    Mongo post-filtering stays as defense in depth.
    """
    query_text = query.strip()
    if not query_text:
        return []

    user_id = user.get("userId")
    cached = cache.get_retrieval(query_text, user_id)
    if cached:
        logger.debug("Cache hit for retrieval query: %s", query_text[:50])
        return cached

    try:
        vector = await embed_query(query_text)
    except Exception:
        return []

    client = _get_mongo()
    db = client[MONGO_DB]
    try:
        accessible_doc_ids: list[str] | None = None
        milvus_expr: str | None = None

        try:
            accessible_doc_ids = resolve_accessible_document_ids(
                db,
                user,
                allow_adversarial=ALLOW_ADVERSARIAL_DOCS,
            )
            if not accessible_doc_ids:
                return []
            milvus_expr = build_milvus_document_expr(accessible_doc_ids)
        except Exception:
            logger.warning(
                "ACL push-down failed; continuing with post-filter retrieval only."
            )
            accessible_doc_ids = None
            milvus_expr = None

        try:
            hits = search_vectors(vector, RETRIEVAL_TOP_K, expr=milvus_expr)
        except Exception:
            return []

        if not hits:
            return []

        child_chunk_ids = [hit["chunk_id"] for hit in hits if hit.get("chunk_id")]
        if not child_chunk_ids:
            return []

        child_query = {
            "chunkId": {"$in": child_chunk_ids},
            "chunkType": "child",
        }
        if accessible_doc_ids:
            child_query["documentId"] = {"$in": accessible_doc_ids}
        if not ALLOW_ADVERSARIAL_DOCS:
            child_query["metadata.isUnreasonable"] = {"$ne": True}

        child_rows = list(db.document_chunks.find(child_query))
        if not child_rows:
            return []

        child_rows_by_id = {
            row.get("chunkId"): row for row in child_rows if row.get("chunkId")
        }
        parent_best_scores: dict[str, float] = {}
        for hit in hits:
            chunk_id = hit.get("chunk_id")
            if not chunk_id:
                continue
            row = child_rows_by_id.get(chunk_id)
            if not row:
                continue
            parent_id = row.get("parentId")
            if not parent_id:
                continue
            score = float(hit.get("score") or 0.0)
            parent_best_scores[parent_id] = max(
                parent_best_scores.get(parent_id, score),
                score,
            )

        parent_ids = list(parent_best_scores.keys())
        if not parent_ids:
            return []

        parent_query = {
            "chunkId": {"$in": parent_ids},
            "chunkType": "parent",
        }
        if accessible_doc_ids:
            parent_query["documentId"] = {"$in": accessible_doc_ids}
        parent_rows = list(db.document_chunks.find(parent_query))
    finally:
        client.close()

    parents_by_id = {
        row.get("chunkId"): row for row in parent_rows if row.get("chunkId")
    }
    ordered_parent_rows = [
        parents_by_id[parent_id]
        for parent_id, _ in sorted(
            parent_best_scores.items(),
            key=lambda item: item[1],
            reverse=True,
        )
        if parent_id in parents_by_id
    ]

    filtered_parents = []
    for row in ordered_parent_rows:
        meta = row.get("metadata", {})
        if can_view_chunk(meta, user):
            filtered_parents.append(row)

    if not filtered_parents:
        return []

    citations = []
    for row in filtered_parents:
        best_score = parent_best_scores.get(row.get("chunkId", ""), None)
        citations.append(_build_citation(row, row.get("chunkId"), best_score))

    reranked = await rerank_citations(query_text, citations)
    selected = _apply_score_thresholds(reranked)
    selected = _filter_old_conflict_docs(query_text, selected)
    selected = _apply_year_policy(query_text, selected)
    selected.sort(
        key=lambda citation: float(
            citation.get("rerank_score", citation.get("score", -9999))
        ),
        reverse=True,
    )
    selected = limit_chunks_per_doc(selected, MAX_CHUNKS_PER_DOC)
    selected = limit_context_budget(selected)

    cache.set_retrieval(query_text, selected, user_id)
    logger.debug("Cache miss for retrieval query: %s", query_text[:50])
    return selected

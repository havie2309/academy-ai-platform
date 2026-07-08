import logging
import re
from dataclasses import dataclass

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
    MAX_CHUNKS_PER_DOC,
    MONGO_DB,
    MONGO_URI,
    RERANK_SCORE_DELTA,
    RERANK_SCORE_MIN,
    RETRIEVAL_TOP_K,
    VECTOR_SCORE_MIN,
)
from app.embeddings import embed_query
from app.guardrails.document_security import (
    DocumentSecurityDecision,
    filter_rows_by_document_security,
    persist_document_security_audit,
)
from app.milvus_search import search_vectors
from app.rerank import limit_context_budget, rerank_citations

logger = logging.getLogger(__name__)
cache = RedisCache()


@dataclass
class RetrievalResult:
    citations: list[dict]
    security_denied_all: bool = False
    primary_denial: DocumentSecurityDecision | None = None
    max_score: float | None = None          # max rerank score
    reranked_candidates: list[dict] | None = None  # full list with scores



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
        "security_level": meta.get("securityLevel", "internal"),
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
    """Apply thresholds and return only chunks that pass. No fallback."""
    if not citations:
        return []

    # Vector score filter
    after_vector = [
        c for c in citations
        if float(c.get("score", 0.0) or 0.0) >= VECTOR_SCORE_MIN
    ]
    if not after_vector:
        return []  # No fallback – return empty

    # Rerank scores
    rerank_scores = [
        float(c.get("rerank_score"))
        for c in after_vector
        if c.get("rerank_score") is not None
    ]
    if not rerank_scores:
        return after_vector

    top = max(rerank_scores)
    floor = max(RERANK_SCORE_MIN, top - RERANK_SCORE_DELTA)

    # Keep those with rerank_score >= floor AND >= hard_min
    after_rerank = [
        c for c in after_vector
        if c.get("rerank_score") is None  # keep those without rerank score? (shouldn't happen)
        or float(c.get("rerank_score")) >= floor
    ]
    return after_rerank  # may be empty


_SECURITY_PRIORITY = {"confidential": 4, "restricted": 3, "internal": 2, "public": 1}
_SECURITY_THRESHOLD = 1.5
_BOOST_FACTOR = 1.0


def _sort_with_soft_security_priority(citations: list[dict]) -> list[dict]:
    if not citations:
        return citations
    best_score = max(
        float(c.get("rerank_score", c.get("score", 0)) or 0)
        for c in citations
    )

    def _key(c: dict):
        score = float(c.get("rerank_score", c.get("score", 0)) or 0)
        sec = _SECURITY_PRIORITY.get(c.get("security_level", "internal"), 2)
        if score >= best_score - _SECURITY_THRESHOLD:
            return (0, -sec, -score)
        return (1, 0, -score)

    return sorted(citations, key=_key)


def _apply_security_boost(citations: list[dict]) -> list[dict]:
    for c in citations:
        sec = c.get("security_level", "public")
        priority = _SECURITY_PRIORITY.get(sec, 1)
        # Boost only for levels above public
        boost = _BOOST_FACTOR * (priority - 1)
        if boost > 0:
            if c.get("rerank_score") is not None:
                c["rerank_score"] += boost
            else:
                # If no rerank score, set a high default (trusted docs without score)
                c["rerank_score"] = 10.0 + boost
    return citations


async def retrieve_citations(
    query: str,
    user: dict,
    scope_doc_ids: list[str] | None = None,
) -> RetrievalResult:
    """
    Retrieve parent citations from child-vector hits.

    Access metadata remains source-of-truth in Mongo `documents`, but we also
    push the accessible document ids down into Milvus before vector search.
    Mongo post-filtering stays as defense in depth.

    When `scope_doc_ids` is provided (e.g. the user is asking about one opened
    document), retrieval is further narrowed to the intersection of that scope
    with the user's accessible documents — so answers can only be grounded in
    the requested document(s), and never leak content the user cannot access.
    """
    query_text = query.strip()
    if not query_text:
        return RetrievalResult(citations=[])

    # Normalize the requested scope into a clean set of doc ids.
    scope_set: set[str] | None = None
    if scope_doc_ids:
        scope_set = {d.strip() for d in scope_doc_ids if d and d.strip()}
        if not scope_set:
            scope_set = None

    try:
        vector = await embed_query(query_text)
    except Exception:
        return RetrievalResult(citations=[])

    client = _get_mongo()
    db = client[MONGO_DB]
    documents_by_id: dict[str, dict] = {}
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
                return RetrievalResult(citations=[])
            # Narrow to the requested document scope, keeping ACL as the ceiling.
            if scope_set is not None:
                accessible_doc_ids = [
                    d for d in accessible_doc_ids if d in scope_set
                ]
                if not accessible_doc_ids:
                    return RetrievalResult(citations=[])
            milvus_expr = build_milvus_document_expr(accessible_doc_ids)
        except Exception:
            logger.warning(
                "ACL push-down failed; continuing with post-filter retrieval only."
            )
            # Even if the ACL push-down fails, still honour an explicit doc scope
            # so the answer stays confined to the requested document(s). Mongo
            # security post-filtering below remains the source of truth.
            if scope_set is not None:
                accessible_doc_ids = sorted(scope_set)
                milvus_expr = build_milvus_document_expr(accessible_doc_ids)
            else:
                accessible_doc_ids = None
                milvus_expr = None

        try:
            hits = search_vectors(vector, RETRIEVAL_TOP_K, expr=milvus_expr)
        except Exception:
            return RetrievalResult(citations=[])

        if not hits:
            return RetrievalResult(citations=[])

        child_chunk_ids = [hit["chunk_id"] for hit in hits if hit.get("chunk_id")]
        if not child_chunk_ids:
            return RetrievalResult(citations=[])

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
            return RetrievalResult(citations=[])

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
            return RetrievalResult(citations=[])

        parent_query = {
            "chunkId": {"$in": parent_ids},
            "chunkType": "parent",
        }
        if accessible_doc_ids:
            parent_query["documentId"] = {"$in": accessible_doc_ids}
        parent_rows = list(db.document_chunks.find(parent_query))

        doc_ids_for_meta = {
            str(row.get("documentId", "")).strip()
            for row in parent_rows
            if str(row.get("documentId", "")).strip()
        }
        if doc_ids_for_meta:
            for doc in db.documents.find({"docId": {"$in": list(doc_ids_for_meta)}}):
                doc_id = str(doc.get("docId", "")).strip()
                if doc_id:
                    documents_by_id[doc_id] = doc
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

    acl_parents = []
    for row in ordered_parent_rows:
        meta = row.get("metadata", {})
        if can_view_chunk(meta, user):
            acl_parents.append(row)

    filtered_parents, blocked = filter_rows_by_document_security(
        acl_parents,
        user,
        query=query_text,
        documents_by_id=documents_by_id,
    )

    for row, decision in blocked:
        await persist_document_security_audit(
            query=query_text,
            user=user,
            doc_id=str(row.get("documentId", "")).strip(),
            chunk_id=str(row.get("chunkId", "")).strip(),
            decision=decision,
        )

    security_denied_all = bool(acl_parents) and not filtered_parents and bool(blocked)
    primary_denial = blocked[0][1] if blocked else None

    if security_denied_all:
        if primary_denial:
            await persist_document_security_audit(
                query=query_text,
                user=user,
                doc_id="all-denied",
                chunk_id="all-denied",
                decision=primary_denial,
            )
        return RetrievalResult(
            citations=[],
            security_denied_all=True,
            primary_denial=primary_denial,
        )

    if not filtered_parents:
        return RetrievalResult(citations=[])

    citations = []
    for row in filtered_parents:
        best_score = parent_best_scores.get(row.get("chunkId", ""), None)
        citations.append(_build_citation(row, row.get("chunkId"), best_score))

    reranked = await rerank_citations(query_text, citations)
    max_score = max((c.get("rerank_score") for c in reranked if c.get("rerank_score") is not None), default=None)
    reranked = _apply_security_boost(reranked)
    selected = _apply_score_thresholds(reranked)
    selected = _filter_old_conflict_docs(query_text, selected)
    selected = _apply_year_policy(query_text, selected)
    selected = _sort_with_soft_security_priority(selected)
    selected = limit_chunks_per_doc(selected, MAX_CHUNKS_PER_DOC)
    selected = limit_context_budget(selected)

    return RetrievalResult(
        citations=selected,
        max_score=max_score,
        reranked_candidates=reranked
    )


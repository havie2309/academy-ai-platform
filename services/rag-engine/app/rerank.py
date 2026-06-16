"""Cross-encoder rerank client (E-04)."""

import logging

import httpx

from app.config import RERANK_BASE_URL, RERANK_ENABLED, RERANK_TOP_K

logger = logging.getLogger(__name__)


async def rerank_citations(query: str, citations: list[dict]) -> list[dict]:
    """Re-score and reorder retrieved chunks; keep top RERANK_TOP_K for LLM context."""
    if not citations:
        return []

    if not RERANK_ENABLED or len(citations) == 1:
        return citations[:RERANK_TOP_K]

    documents = [c.get("text") or c.get("snippet", "") for c in citations]
    if not any(documents):
        return citations[:RERANK_TOP_K]

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                f"{RERANK_BASE_URL.rstrip('/')}/v1/rerank",
                json={"query": query, "documents": documents},
            )
            res.raise_for_status()
            results = res.json().get("results", [])
    except Exception as exc:
        logger.warning("rerank unavailable, using vector order: %s", exc)
        return citations[:RERANK_TOP_K]

    reranked: list[dict] = []
    for item in results:
        idx = item.get("index")
        if idx is None or idx < 0 or idx >= len(citations):
            continue
        row = dict(citations[idx])
        row["rerank_score"] = item.get("score")
        reranked.append(row)
        if len(reranked) >= RERANK_TOP_K:
            break

    return reranked or citations[:RERANK_TOP_K]

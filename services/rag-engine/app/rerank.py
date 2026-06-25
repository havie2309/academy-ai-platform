"""Cross-encoder rerank client (E-04)."""

import logging

import httpx

from app.config import (
    RAG_CONTEXT_MAX_CHARS,
    RERANK_BASE_URL,
    RERANK_DOC_MAX_CHARS,
    RERANK_ENABLED,
    RERANK_TOP_K,
)

logger = logging.getLogger(__name__)


def _trim_text(text: str, max_chars: int) -> str:
    cleaned = str(text or "").strip()
    if max_chars <= 0 or len(cleaned) <= max_chars:
        return cleaned
    if max_chars <= 3:
        return cleaned[:max_chars]
    return cleaned[: max_chars - 3].rstrip() + "..."


def build_rerank_document(citation: dict, *, max_chars: int = RERANK_DOC_MAX_CHARS) -> str:
    """Build a metadata-rich candidate for the cross-encoder without exploding prompt size."""
    title = str(citation.get("title") or "").strip()
    section_path = str(citation.get("section_path") or "").strip()
    source = str(citation.get("source") or "").strip()
    body = str(citation.get("text") or citation.get("snippet") or "").strip()

    prefix_parts: list[str] = []
    if title:
        prefix_parts.append(f"Tieu de: {title}")
    if section_path:
        prefix_parts.append(f"Muc: {section_path}")
    if source and source != title:
        prefix_parts.append(f"Nguon: {source}")

    prefix = "\n".join(prefix_parts).strip()
    if max_chars > 0 and prefix and len(prefix) >= max_chars:
        return _trim_text(prefix, max_chars)
    if max_chars > 0 and prefix:
        remaining = max(max_chars - len(prefix) - 2, 0)
    else:
        remaining = max_chars

    body = _trim_text(body, remaining)
    if prefix and body:
        return f"{prefix}\n\n{body}"
    return prefix or body


def limit_context_budget(citations: list[dict]) -> list[dict]:
    """Keep citation order but cap total LLM context size."""
    if not citations or RAG_CONTEXT_MAX_CHARS <= 0:
        return citations

    selected: list[dict] = []
    total_chars = 0
    for citation in citations:
        weight = len(str(citation.get("text") or citation.get("snippet") or "").strip())
        weight = max(weight, 1)
        if not selected:
            selected.append(citation)
            total_chars += weight
            continue
        if total_chars + weight > RAG_CONTEXT_MAX_CHARS:
            continue
        selected.append(citation)
        total_chars += weight

    return selected or citations[:1]


async def rerank_citations(query: str, citations: list[dict]) -> list[dict]:
    """Re-score and reorder retrieved chunks; keep top RERANK_TOP_K for LLM context."""
    if not citations:
        return []

    if not RERANK_ENABLED or len(citations) == 1:
        return citations[:RERANK_TOP_K]

    documents = [build_rerank_document(citation) for citation in citations]
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

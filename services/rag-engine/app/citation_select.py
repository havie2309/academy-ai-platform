"""Citation post-filter helpers (per-document limits)."""


def doc_key(citation: dict) -> str:
    doc_id = str(citation.get("doc_id", "")).strip().lower()
    if doc_id:
        return f"doc:{doc_id}"
    title = str(citation.get("title", "")).strip().lower()
    source = str(citation.get("source", "")).strip().lower()
    return f"title:{title}|source:{source}"


def limit_chunks_per_doc(citations: list[dict], max_per_doc: int) -> list[dict]:
    """Keep up to `max_per_doc` highest-scoring chunks per document."""
    if max_per_doc <= 0 or not citations:
        return citations

    counts: dict[str, int] = {}
    limited: list[dict] = []
    for citation in citations:
        key = doc_key(citation)
        seen = counts.get(key, 0)
        if seen >= max_per_doc:
            continue
        counts[key] = seen + 1
        limited.append(citation)
    return limited

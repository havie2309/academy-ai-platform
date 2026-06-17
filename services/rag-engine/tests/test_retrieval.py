import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.citation_select import doc_key, limit_chunks_per_doc  # noqa: E402


def _cite(doc_id: str, chunk_id: str, score: float) -> dict:
    return {
        "doc_id": doc_id,
        "chunk_id": chunk_id,
        "score": score,
        "rerank_score": score,
    }


def test_limit_chunks_per_doc_allows_multiple_from_same_doc():
    citations = [
        _cite("doc-a", "c1", 0.9),
        _cite("doc-a", "c2", 0.8),
        _cite("doc-a", "c3", 0.7),
        _cite("doc-a", "c4", 0.6),
        _cite("doc-b", "c5", 0.85),
    ]
    limited = limit_chunks_per_doc(citations, 3)
    doc_a = [c for c in limited if doc_key(c) == "doc:doc-a"]
    doc_b = [c for c in limited if doc_key(c) == "doc:doc-b"]
    assert len(doc_a) == 3
    assert len(doc_b) == 1
    assert [c["chunk_id"] for c in doc_a] == ["c1", "c2", "c3"]


def test_limit_zero_means_unlimited():
    citations = [_cite("doc-a", "c1", 0.9), _cite("doc-a", "c2", 0.8)]
    assert limit_chunks_per_doc(citations, 0) == citations


if __name__ == "__main__":
    test_limit_chunks_per_doc_allows_multiple_from_same_doc()
    test_limit_zero_means_unlimited()
    print("ok")

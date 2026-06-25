import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.rerank as rerank  # noqa: E402
from app.rerank import build_rerank_document, limit_context_budget  # noqa: E402


def test_build_rerank_document_includes_metadata_and_trims_body():
    doc = build_rerank_document(
        {
            "title": "Quy che dao tao",
            "section_path": "Chuong I > Dieu 2",
            "source": "Phong Dao tao",
            "text": "Noi dung " * 80,
        },
        max_chars=140,
    )

    assert "Tieu de: Quy che dao tao" in doc
    assert "Muc: Chuong I > Dieu 2" in doc
    assert "Nguon: Phong Dao tao" in doc
    assert len(doc) <= 140


def test_limit_context_budget_keeps_order_under_budget():
    previous = rerank.RAG_CONTEXT_MAX_CHARS
    rerank.RAG_CONTEXT_MAX_CHARS = 100
    try:
        result = limit_context_budget(
            [
                {"chunk_id": "chunk-1", "text": "A" * 70},
                {"chunk_id": "chunk-2", "text": "B" * 40},
                {"chunk_id": "chunk-3", "text": "C" * 20},
            ]
        )
    finally:
        rerank.RAG_CONTEXT_MAX_CHARS = previous

    assert [item["chunk_id"] for item in result] == ["chunk-1", "chunk-3"]


if __name__ == "__main__":
    test_build_rerank_document_includes_metadata_and_trims_body()
    test_limit_context_budget_keeps_order_under_budget()
    print("ok")

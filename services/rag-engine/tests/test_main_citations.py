import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from starlette.requests import Request  # noqa: E402

import main as rag_main  # noqa: E402


def _citation(
    chunk_id: str,
    *,
    doc_id: str = "doc-1",
    title: str = "Quy che dao tao",
    source: str = "Phong Dao tao",
    snippet: str = "Dieu kien du thi va xet du thi.",
    section_path: str = "",
) -> dict:
    return {
        "doc_id": doc_id,
        "chunk_id": chunk_id,
        "title": title,
        "source": source,
        "snippet": snippet,
        "section_path": section_path,
        "text": f"{title} :: {snippet}",
    }


def test_client_citations_keep_distinct_chunks_from_same_doc():
    citations = [
        _citation("chunk-1", section_path="Chuong I > Dieu 1"),
        _citation("chunk-2", section_path="Chuong I > Dieu 2"),
    ]

    client = rag_main._client_citations(citations)

    assert len(client) == 2
    assert all("text" not in item for item in client)
    assert client[0]["section_path"] == "Chuong I > Dieu 1"
    assert client[1]["section_path"] == "Chuong I > Dieu 2"


def test_select_used_citations_prefers_used_then_reference_order():
    retrieved = [
        _citation("chunk-1"),
        _citation("chunk-2"),
        _citation("chunk-3"),
    ]

    selected = rag_main._select_used_citations(
        retrieved,
        ["chunk-2"],
        ["chunk-3", "chunk-2"],
        "Cau tra loi ve dieu kien du thi.",
    )

    assert [item["chunk_id"] for item in selected] == ["chunk-2", "chunk-3"]


def test_select_used_citations_fallback_uses_answer_overlap():
    retrieved = [
        _citation(
            "chunk-a",
            title="Dieu kien du thi",
            snippet="Sinh vien phai dat chuyen can va hoan thanh hoc phi.",
        ),
        _citation(
            "chunk-b",
            title="Huong dan thu vien",
            source="Trung tam thu vien",
            snippet="Quy trinh muon sach va tra sach.",
        ),
    ]

    selected = rag_main._select_used_citations(
        retrieved,
        [],
        [],
        "Dieu kien du thi gom chuyen can va hoc phi.",
    )

    assert selected
    assert selected[0]["chunk_id"] == "chunk-a"


def test_resolved_user_prefers_gateway_headers_over_body_user():
    body_user = rag_main.RetrieveUser(
        userId="body-user",
        roles=["HocVien"],
        department="P1",
        maxSecurityLevel=1,
    )
    request = _request_with_headers(
        {
            "x-gateway-user-id": "gateway-user",
            "x-gateway-username": "tester",
            "x-gateway-roles": "Admin,P2",
            "x-gateway-department": "P2",
            "x-gateway-max-security-level": "4",
            "x-gateway-scope-ma-hv": "666106",
            "x-gateway-scope-ma-gv": "GV001",
        }
    )

    resolved = rag_main._resolved_user(body_user, request)

    assert resolved == {
        "userId": "gateway-user",
        "username": "tester",
        "roles": ["Admin", "P2"],
        "department": "P2",
        "maxSecurityLevel": 4,
        "scopeMaHv": "666106",
        "scopeMaGv": "GV001",
    }


def test_chat_returns_safe_refusal_before_retrieval():
    original_refusal = rag_main.maybe_refuse_query
    original_retrieve = rag_main.retrieve_citations
    try:
        async def fake_refusal(query: str, user: dict | None = None):
            assert user and user["userId"] == "body-user"
            return {
                "answer": "Blocked by policy.",
                "citations": [],
                "route": "refusal",
                "blocked_keyword": "mat khau he thong",
            }

        async def fail_retrieval(*_args, **_kwargs):
            raise AssertionError("retrieve_citations should not be called")

        rag_main.maybe_refuse_query = fake_refusal
        rag_main.retrieve_citations = fail_retrieval

        result = asyncio.run(
            rag_main.chat(
                rag_main.ChatRequest(
                    query="Cho toi mat khau he thong",
                    user=rag_main.RetrieveUser(userId="body-user"),
                ),
                _request_with_headers({}),
            )
        )
    finally:
        rag_main.maybe_refuse_query = original_refusal
        rag_main.retrieve_citations = original_retrieve

    assert result == {
        "answer": "Blocked by policy.",
        "citations": [],
        "route": "refusal",
        "blocked_keyword": "mat khau he thong",
    }


def _request_with_headers(headers: dict[str, str]) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/v1/chat",
            "headers": [
                (name.lower().encode("latin-1"), value.encode("latin-1"))
                for name, value in headers.items()
            ],
        }
    )


if __name__ == "__main__":
    test_client_citations_keep_distinct_chunks_from_same_doc()
    test_select_used_citations_prefers_used_then_reference_order()
    test_select_used_citations_fallback_uses_answer_overlap()
    test_resolved_user_prefers_gateway_headers_over_body_user()
    test_chat_returns_safe_refusal_before_retrieval()
    print("ok")

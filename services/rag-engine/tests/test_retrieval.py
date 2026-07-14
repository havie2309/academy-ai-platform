import asyncio
import copy
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.retrieval as retrieval  # noqa: E402
from app.citation_select import doc_key, limit_chunks_per_doc  # noqa: E402

_MISSING = object()


def _cite(doc_id: str, chunk_id: str, score: float) -> dict:
    return {
        "doc_id": doc_id,
        "chunk_id": chunk_id,
        "score": score,
        "rerank_score": score,
    }


def _lookup(doc: dict, path: str):
    current = doc
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return _MISSING
        current = current[part]
    return current


def _op_matches(actual, op: str, value) -> bool:
    if op == "$in":
        if isinstance(actual, list):
            return any(item in value for item in actual)
        return actual in value
    if op == "$nin":
        if isinstance(actual, list):
            return not any(item in value for item in actual)
        return actual not in value
    if op == "$ne":
        return actual != value
    return False


def _matches(doc: dict, query: dict) -> bool:
    for key, expected in query.items():
        if key == "$or":
            return any(_matches(doc, clause) for clause in expected)
        if key == "$and":
            return all(_matches(doc, clause) for clause in expected)

        actual = _lookup(doc, key)
        if isinstance(expected, dict):
            for op, value in expected.items():
                if op == "$or":
                    if not any(_matches(doc, clause) for clause in value):
                        return False
                    continue
                if op == "$exists":
                    exists = actual is not _MISSING
                    if bool(value) != exists:
                        return False
                    continue
                if not _op_matches(actual, op, value):
                    return False
            continue

        if isinstance(actual, list):
            if expected not in actual:
                return False
        elif actual != expected:
            return False
    return True


def _result_citations(result):
    if hasattr(result, "citations"):
        return result.citations
    return result


class _FakeCollection:
    def __init__(self, docs=None):
        self.docs = [copy.deepcopy(doc) for doc in (docs or [])]

    def find(self, query=None):
        query = query or {}
        return [copy.deepcopy(doc) for doc in self.docs if _matches(doc, query)]


class _FakeDb:
    def __init__(self, *, documents=None, chunks=None):
        self.documents = _FakeCollection(documents)
        self.document_chunks = _FakeCollection(chunks)


class _FakeMongoClient:
    def __init__(self, db):
        self._db = db

    def __getitem__(self, _name):
        return self._db

    def close(self):
        return None


class _FakeCache:
    def __init__(self):
        self.saved = None

    def get_retrieval(self, _query: str, _user_id: str | None):
        return None

    def set_retrieval(self, query: str, citations: list[dict], user_id: str | None):
        self.saved = (query, citations, user_id)


class CitationSelectTests(unittest.TestCase):
    def test_limit_chunks_per_doc_allows_multiple_from_same_doc(self):
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
        self.assertEqual(len(doc_a), 3)
        self.assertEqual(len(doc_b), 1)
        self.assertEqual([c["chunk_id"] for c in doc_a], ["c1", "c2", "c3"])

    def test_limit_zero_means_unlimited(self):
        citations = [_cite("doc-a", "c1", 0.9), _cite("doc-a", "c2", 0.8)]
        self.assertEqual(limit_chunks_per_doc(citations, 0), citations)


class RetrievalFlowTests(unittest.TestCase):
    def test_retrieve_citations_matches_role_aliases_before_acl_pushdown(self):
        fake_cache = _FakeCache()
        fake_db = _FakeDb(
            documents=[
                {
                    "docId": "doc-lecturer",
                    "securityLevel": "internal",
                    "scopeType": "role",
                    "accessRoleCodes": ["GV"],
                    "accessDepartmentCodes": [],
                    "accessUserIds": [],
                    "uploadedById": "u-2",
                },
                {
                    "docId": "doc-student",
                    "securityLevel": "internal",
                    "scopeType": "role",
                    "accessRoleCodes": ["HV"],
                    "accessDepartmentCodes": [],
                    "accessUserIds": [],
                    "uploadedById": "u-3",
                },
            ],
            chunks=[
                {
                    "chunkId": "child-gv",
                    "documentId": "doc-lecturer",
                    "parentId": "parent-gv",
                    "chunkType": "child",
                    "metadata": {
                        "securityLevel": "internal",
                        "scopeType": "role",
                        "accessRoleCodes": ["GV"],
                    },
                },
                {
                    "chunkId": "child-hv",
                    "documentId": "doc-student",
                    "parentId": "parent-hv",
                    "chunkType": "child",
                    "metadata": {
                        "securityLevel": "internal",
                        "scopeType": "role",
                        "accessRoleCodes": ["HV"],
                    },
                },
                {
                    "chunkId": "parent-gv",
                    "documentId": "doc-lecturer",
                    "chunkType": "parent",
                    "chunkText": "Noi dung danh cho giang vien.",
                    "metadata": {
                        "title": "Tai lieu GV",
                        "securityLevel": "internal",
                        "scopeType": "role",
                        "accessRoleCodes": ["GV"],
                    },
                },
                {
                    "chunkId": "parent-hv",
                    "documentId": "doc-student",
                    "chunkType": "parent",
                    "chunkText": "Noi dung danh cho hoc vien.",
                    "metadata": {
                        "title": "Tai lieu HV",
                        "securityLevel": "internal",
                        "scopeType": "role",
                        "accessRoleCodes": ["HV"],
                    },
                },
            ],
        )

        captured: dict[str, object] = {}

        def _fake_search(_vector: list[float], _top_k: int, *, expr: str | None = None):
            captured["expr"] = expr
            return [
                {"chunk_id": "child-gv", "score": 0.9},
                {"chunk_id": "child-hv", "score": 0.7},
            ]

        async def _fake_rerank(_query: str, citations: list[dict]):
            return [{**citation, "rerank_score": citation["score"]} for citation in citations]

        async def _noop_audit(**_kwargs):
            return None

        with (
            patch.object(retrieval, "cache", fake_cache),
            patch.object(retrieval, "embed_query", return_value=[0.1, 0.2]),
            patch.object(retrieval, "search_vectors", new=_fake_search),
            patch.object(retrieval, "MongoClient", return_value=_FakeMongoClient(fake_db)),
            patch.object(retrieval, "rerank_citations", new=_fake_rerank),
            patch.object(retrieval, "persist_document_security_audit", new=_noop_audit),
        ):
            result = asyncio.run(
                retrieval.retrieve_citations(
                    "quy dinh cho giang vien",
                    {
                        "userId": "u-1",
                        "roles": ["Giang Vien"],
                        "normalizedRoles": ["GIANG_VIEN"],
                        "department": "CNTT",
                        "maxSecurityLevel": 2,
                    },
                )
            )

        self.assertEqual([item["chunk_id"] for item in _result_citations(result)], ["parent-gv"])
        expr = str(captured.get("expr") or "")
        self.assertIn("doc-lecturer", expr)
        self.assertNotIn("doc-student", expr)

    def test_retrieve_citations_uses_parent_child_flow_and_keeps_query_text_for_rerank(self):
        fake_cache = _FakeCache()
        fake_db = _FakeDb(
            documents=[
                {
                    "docId": "doc-a",
                    "securityLevel": "internal",
                    "scopeType": "all",
                    "accessRoleCodes": [],
                    "accessDepartmentCodes": [],
                    "accessUserIds": [],
                    "uploadedById": "u-2",
                },
                {
                    "docId": "doc-b",
                    "securityLevel": "internal",
                    "scopeType": "all",
                    "accessRoleCodes": [],
                    "accessDepartmentCodes": [],
                    "accessUserIds": [],
                    "uploadedById": "u-3",
                },
            ],
            chunks=[
                {
                    "chunkId": "child-1",
                    "documentId": "doc-b",
                    "parentId": "parent-b",
                    "chunkType": "child",
                    "metadata": {"securityLevel": "internal", "scopeType": "all"},
                },
                {
                    "chunkId": "child-2",
                    "documentId": "doc-a",
                    "parentId": "parent-a",
                    "chunkType": "child",
                    "metadata": {"securityLevel": "internal", "scopeType": "all"},
                },
                {
                    "chunkId": "parent-a",
                    "documentId": "doc-a",
                    "chunkType": "parent",
                    "chunkText": "Dieu 2. Dieu kien hoc phi va chuyen can.",
                    "metadata": {
                        "title": "Quy che dao tao A",
                        "childIds": ["child-2"],
                        "section_path": "Chuong I > Dieu 2",
                        "securityLevel": "internal",
                        "scopeType": "all",
                    },
                },
                {
                    "chunkId": "parent-b",
                    "documentId": "doc-b",
                    "chunkType": "parent",
                    "chunkText": "Dieu 5. Dieu kien du thi va diem trung binh.",
                    "metadata": {
                        "title": "Quy che dao tao B",
                        "childIds": ["child-1"],
                        "section_path": "Chuong II > Dieu 5",
                        "securityLevel": "internal",
                        "scopeType": "all",
                    },
                },
            ],
        )

        async def _fake_rerank(query: str, citations: list[dict]):
            self.assertIsInstance(query, str)
            self.assertEqual(query, "dieu kien du thi")
            return [{**citation, "rerank_score": citation["score"]} for citation in citations]

        async def _noop_audit(**_kwargs):
            return None

        with (
            patch.object(retrieval, "cache", fake_cache),
            patch.object(retrieval, "embed_query", return_value=[0.1, 0.2]),
            patch.object(
                retrieval,
                "search_vectors",
                return_value=[
                    {"chunk_id": "child-1", "score": 0.91},
                    {"chunk_id": "child-2", "score": 0.82},
                ],
            ),
            patch.object(retrieval, "MongoClient", return_value=_FakeMongoClient(fake_db)),
            patch.object(retrieval, "rerank_citations", new=_fake_rerank),
            patch.object(retrieval, "persist_document_security_audit", new=_noop_audit),
        ):
            result = asyncio.run(
                retrieval.retrieve_citations(
                    "dieu kien du thi",
                    {"userId": "u-1", "roles": [], "maxSecurityLevel": 4},
                )
            )

        self.assertEqual([item["chunk_id"] for item in _result_citations(result)], ["parent-b", "parent-a"])
        self.assertEqual(_result_citations(result)[0]["section_path"], "Chuong II > Dieu 5")
        self.assertEqual(_result_citations(result)[1]["section_path"], "Chuong I > Dieu 2")
        # Cache is not used for retrieval results in the current implementation.

    def test_retrieve_citations_pushes_accessible_doc_ids_into_milvus_expr(self):
        fake_cache = _FakeCache()
        fake_db = _FakeDb(
            documents=[
                {
                    "docId": "doc-public",
                    "securityLevel": "internal",
                    "scopeType": "all",
                    "accessRoleCodes": [],
                    "accessDepartmentCodes": [],
                    "accessUserIds": [],
                    "uploadedById": "u-9",
                },
                {
                    "docId": "doc-user",
                    "securityLevel": "internal",
                    "scopeType": "custom",
                    "accessRoleCodes": [],
                    "accessDepartmentCodes": [],
                    "accessUserIds": ["u-1"],
                    "uploadedById": "u-8",
                },
                {
                    "docId": "doc-hidden",
                    "securityLevel": "restricted",
                    "scopeType": "department",
                    "accessRoleCodes": [],
                    "accessDepartmentCodes": ["P7"],
                    "accessUserIds": [],
                    "uploadedById": "u-7",
                },
            ],
            chunks=[
                {
                    "chunkId": "child-public",
                    "documentId": "doc-public",
                    "parentId": "parent-public",
                    "chunkType": "child",
                    "metadata": {"securityLevel": "internal", "scopeType": "all"},
                },
                {
                    "chunkId": "child-user",
                    "documentId": "doc-user",
                    "parentId": "parent-user",
                    "chunkType": "child",
                    "metadata": {
                        "securityLevel": "internal",
                        "scopeType": "custom",
                        "accessUserIds": ["u-1"],
                    },
                },
                {
                    "chunkId": "parent-public",
                    "documentId": "doc-public",
                    "chunkType": "parent",
                    "chunkText": "Noi dung public.",
                    "metadata": {
                        "title": "Tai lieu A",
                        "securityLevel": "internal",
                        "scopeType": "all",
                    },
                },
                {
                    "chunkId": "parent-user",
                    "documentId": "doc-user",
                    "chunkType": "parent",
                    "chunkText": "Noi dung rieng.",
                    "metadata": {
                        "title": "Tai lieu B",
                        "securityLevel": "internal",
                        "scopeType": "custom",
                        "accessUserIds": ["u-1"],
                    },
                },
            ],
        )

        captured: dict[str, object] = {}

        def _fake_search(_vector: list[float], _top_k: int, *, expr: str | None = None):
            captured["expr"] = expr
            return [
                {"chunk_id": "child-public", "score": 0.88},
                {"chunk_id": "child-user", "score": 0.81},
            ]

        async def _fake_rerank(_query: str, citations: list[dict]):
            return [{**citation, "rerank_score": citation["score"]} for citation in citations]

        async def _noop_audit(**_kwargs):
            return None

        with (
            patch.object(retrieval, "cache", fake_cache),
            patch.object(retrieval, "embed_query", return_value=[0.1, 0.2]),
            patch.object(retrieval, "search_vectors", new=_fake_search),
            patch.object(retrieval, "MongoClient", return_value=_FakeMongoClient(fake_db)),
            patch.object(retrieval, "rerank_citations", new=_fake_rerank),
            patch.object(retrieval, "persist_document_security_audit", new=_noop_audit),
        ):
            result = asyncio.run(
                retrieval.retrieve_citations(
                    "hoc phi va thong bao",
                    {
                        "userId": "u-1",
                        "roles": [],
                        "department": "P2",
                        "maxSecurityLevel": 2,
                    },
                )
            )

        expr = str(captured.get("expr") or "")
        self.assertIn("doc-public", expr)
        self.assertIn("doc-user", expr)
        self.assertNotIn("doc-hidden", expr)
        self.assertEqual([item["chunk_id"] for item in _result_citations(result)], ["parent-public", "parent-user"])


if __name__ == "__main__":
    unittest.main()

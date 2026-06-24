import copy
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.pipeline as pipeline  # noqa: E402


def _lookup(doc: dict, path: str):
    current = doc
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _set_path(doc: dict, path: str, value):
    current = doc
    parts = path.split(".")
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    current[parts[-1]] = value


def _matches(doc: dict, query: dict) -> bool:
    for key, expected in query.items():
        actual = _lookup(doc, key)
        if isinstance(expected, dict):
            for op, value in expected.items():
                if op == "$in" and actual not in value:
                    return False
                if op == "$nin" and actual in value:
                    return False
                if op == "$ne" and actual == value:
                    return False
        elif actual != expected:
            return False
    return True


class _FakeCollection:
    def __init__(self, docs=None):
        self.docs = [copy.deepcopy(doc) for doc in (docs or [])]

    def insert_many(self, docs):
        self.docs.extend(copy.deepcopy(doc) for doc in docs)

    def update_one(self, query, update, upsert=False):
        for doc in self.docs:
            if _matches(doc, query):
                for key, value in update.get("$set", {}).items():
                    _set_path(doc, key, value)
                return

        if not upsert:
            return

        created = copy.deepcopy(query)
        for key, value in update.get("$setOnInsert", {}).items():
            _set_path(created, key, value)
        for key, value in update.get("$set", {}).items():
            _set_path(created, key, value)
        self.docs.append(created)

    def delete_many(self, query):
        self.docs = [doc for doc in self.docs if not _matches(doc, query)]

    def find(self, query=None):
        query = query or {}
        return [copy.deepcopy(doc) for doc in self.docs if _matches(doc, query)]


class _FakeDb:
    def __init__(self):
        self.document_chunks = _FakeCollection(
            [
                {
                    "chunkId": "old-parent",
                    "documentId": "doc-1",
                    "chunkType": "parent",
                    "chunkText": "Old parent text",
                    "metadata": {"section_path": "Old chapter"},
                },
                {
                    "chunkId": "old-child",
                    "documentId": "doc-1",
                    "parentId": "old-parent",
                    "chunkType": "child",
                    "chunkText": "Old child text",
                    "metadata": {"section_path": "Old chapter"},
                },
                {
                    "chunkId": "other-doc-child",
                    "documentId": "doc-2",
                    "chunkType": "child",
                    "chunkText": "Should stay intact",
                    "metadata": {"section_path": "Other"},
                },
            ]
        )
        self.processing_jobs = _FakeCollection()
        self.documents = _FakeCollection([{"docId": "doc-1"}])


class _FakeMongoClient:
    def __init__(self, db):
        self._db = db

    def __getitem__(self, _name):
        return self._db

    def close(self):
        return None


class PipelineParentChildTests(unittest.IsolatedAsyncioTestCase):
    def _job(self):
        return {
            "documentId": "doc-1",
            "storagePath": "file.txt",
            "title": "Quy chế đào tạo",
            "mimeType": "text/plain",
            "securityLevel": "internal",
            "scopeType": "all",
            "uploadedById": "u-1",
        }

    def _chunk_result(self):
        return {
            "parent_nodes": [
                {
                    "id": "parent-new-1",
                    "text": "Điều 1. Phạm vi áp dụng\nNội dung parent mới thứ nhất.",
                    "metadata": {
                        "section_path": "Chương I. Quy định chung > Điều 1. Phạm vi áp dụng",
                        "headers": [
                            "Chương I. Quy định chung",
                            "Điều 1. Phạm vi áp dụng",
                        ],
                        "section_type": "dieu",
                    },
                    "child_ids": ["child-new-1"],
                }
            ],
            "child_nodes": [
                {
                    "id": "child-new-1",
                    "parent_id": "parent-new-1",
                    "text": "Nội dung child mới dùng để embed.",
                    "index": 0,
                    "metadata": {
                        "section_path": "Chương I. Quy định chung > Điều 1. Phạm vi áp dụng",
                        "headers": [
                            "Chương I. Quy định chung",
                            "Điều 1. Phạm vi áp dụng",
                        ],
                        "section_type": "dieu",
                        "chunk_type": "child",
                        "parent_id": "parent-new-1",
                        "chunk_index": 0,
                        "parent_preview": "Điều 1. Phạm vi áp dụng Nội dung parent mới thứ nhất.",
                    },
                }
            ],
        }

    async def test_process_document_reingest_replaces_stale_chunks_and_prefixes_embedding_text(self):
        db = _FakeDb()
        mongo_client = _FakeMongoClient(db)
        embed_inputs: list[str] = []
        cleanup_calls: list[tuple[str, list[str]]] = []

        async def _fake_embed(texts: list[str]):
            embed_inputs.extend(texts)
            return [[0.11, 0.22]]

        with (
            patch.object(pipeline, "_mongo", return_value=mongo_client),
            patch.object(pipeline, "extract_text", return_value="ignored"),
            patch.object(
                pipeline,
                "chunk_document_parent_child",
                return_value=self._chunk_result(),
            ),
            patch.object(pipeline, "embed_texts", new=_fake_embed),
            patch.object(pipeline, "insert_vectors", return_value=[101]),
            patch.object(
                pipeline,
                "delete_document_except",
                side_effect=lambda document_id, keep_ids: cleanup_calls.append(
                    (document_id, keep_ids[:])
                ),
            ),
            patch.object(pipeline, "delete_chunk_ids") as delete_chunk_ids,
        ):
            result = await pipeline.process_document(self._job())

        self.assertEqual(
            result,
            {
                "documentId": "doc-1",
                "chunkCount": 1,
                "parentCount": 1,
                "status": "completed",
            },
        )
        self.assertEqual(len(embed_inputs), 1)
        self.assertIn(
            "Chương I. Quy định chung > Điều 1. Phạm vi áp dụng",
            embed_inputs[0],
        )
        self.assertIn("Nội dung child mới dùng để embed.", embed_inputs[0])
        self.assertIn("Điều 1. Phạm vi áp dụng", embed_inputs[0])
        self.assertEqual(cleanup_calls, [("doc-1", ["child-new-1"])])
        delete_chunk_ids.assert_not_called()

        doc_1_chunks = [
            doc for doc in db.document_chunks.docs if doc["documentId"] == "doc-1"
        ]
        self.assertEqual({doc["chunkId"] for doc in doc_1_chunks}, {"parent-new-1", "child-new-1"})
        child_doc = next(doc for doc in doc_1_chunks if doc["chunkType"] == "child")
        self.assertEqual(child_doc["milvusVectorId"], "101")
        self.assertEqual(
            child_doc["metadata"]["section_path"],
            "Chương I. Quy định chung > Điều 1. Phạm vi áp dụng",
        )

        other_doc_chunks = [
            doc for doc in db.document_chunks.docs if doc["documentId"] == "doc-2"
        ]
        self.assertEqual(len(other_doc_chunks), 1)
        self.assertEqual(other_doc_chunks[0]["chunkId"], "other-doc-child")

    async def test_process_document_rolls_back_partial_parent_insert_when_vector_index_fails(self):
        db = _FakeDb()
        mongo_client = _FakeMongoClient(db)
        deleted_chunk_ids: list[list[str]] = []

        async def _fake_embed(_texts: list[str]):
            return [[0.11, 0.22]]

        with (
            patch.object(pipeline, "_mongo", return_value=mongo_client),
            patch.object(pipeline, "extract_text", return_value="ignored"),
            patch.object(
                pipeline,
                "chunk_document_parent_child",
                return_value=self._chunk_result(),
            ),
            patch.object(pipeline, "embed_texts", new=_fake_embed),
            patch.object(pipeline, "insert_vectors", side_effect=RuntimeError("milvus down")),
            patch.object(
                pipeline,
                "delete_chunk_ids",
                side_effect=lambda chunk_ids: deleted_chunk_ids.append(chunk_ids[:]),
            ),
            patch.object(pipeline, "delete_document_except") as delete_document_except,
        ):
            with self.assertRaisesRegex(RuntimeError, "milvus down"):
                await pipeline.process_document(self._job())

        delete_document_except.assert_not_called()
        self.assertEqual(deleted_chunk_ids, [["child-new-1"]])

        doc_1_chunks = [
            doc for doc in db.document_chunks.docs if doc["documentId"] == "doc-1"
        ]
        self.assertEqual({doc["chunkId"] for doc in doc_1_chunks}, {"old-parent", "old-child"})
        self.assertFalse(any(doc["chunkId"] == "parent-new-1" for doc in doc_1_chunks))
        self.assertFalse(any(doc["chunkId"] == "child-new-1" for doc in doc_1_chunks))


if __name__ == "__main__":
    unittest.main()

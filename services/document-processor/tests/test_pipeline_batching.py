import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.pipeline as pipeline  # noqa: E402
import httpx  # noqa: E402


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, fail_first_post: bool = False):
        self.calls: list[int] = []
        self.fail_first_post = fail_first_post
        self.post_count = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, _url: str, json: dict):
        self.post_count += 1
        texts = json["input"]
        self.calls.append(len(texts))
        if self.fail_first_post and self.post_count == 1:
            raise httpx.ReadTimeout("temporary embedding failure")
        return _FakeResponse(
            {
                "data": [
                    {"embedding": [float(i)]} for i, _ in enumerate(texts, start=1)
                ]
            }
        )


class PipelineBatchingTests(unittest.IsolatedAsyncioTestCase):
    async def test_embed_texts_batches_requests(self):
        old_client = pipeline.httpx.AsyncClient
        old_size = pipeline.EMBEDDING_BATCH_SIZE
        fake_client = _FakeClient()
        try:
            pipeline.httpx.AsyncClient = lambda timeout=120: fake_client
            pipeline.EMBEDDING_BATCH_SIZE = 32
            texts = [f"chunk-{i}" for i in range(70)]
            vectors = await pipeline.embed_texts(texts)
            self.assertEqual(fake_client.calls, [32, 32, 6])
            self.assertEqual(len(vectors), 70)
        finally:
            pipeline.httpx.AsyncClient = old_client
            pipeline.EMBEDDING_BATCH_SIZE = old_size

    async def test_embed_texts_retries_transient_failure(self):
        old_client = pipeline.httpx.AsyncClient
        old_retries = pipeline.EMBEDDING_MAX_RETRIES
        old_backoff = pipeline.EMBEDDING_RETRY_BACKOFF_MS
        fake_client = _FakeClient(fail_first_post=True)
        try:
            pipeline.httpx.AsyncClient = lambda timeout=120: fake_client
            pipeline.EMBEDDING_MAX_RETRIES = 2
            pipeline.EMBEDDING_RETRY_BACKOFF_MS = 1
            vectors = await pipeline.embed_texts(["a", "b"])
            self.assertEqual(fake_client.calls, [2, 2])
            self.assertEqual(len(vectors), 2)
        finally:
            pipeline.httpx.AsyncClient = old_client
            pipeline.EMBEDDING_MAX_RETRIES = old_retries
            pipeline.EMBEDDING_RETRY_BACKOFF_MS = old_backoff


if __name__ == "__main__":
    unittest.main()

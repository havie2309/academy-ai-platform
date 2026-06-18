import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.pipeline as pipeline  # noqa: E402


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self):
        self.calls: list[int] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, _url: str, json: dict):
        texts = json["input"]
        self.calls.append(len(texts))
        return _FakeResponse(
            {
                "data": [
                    {"embedding": [float(i)]} for i, _ in enumerate(texts, start=1)
                ]
            }
        )


async def _run_batching_test():
    old_client = pipeline.httpx.AsyncClient
    old_size = pipeline.EMBEDDING_BATCH_SIZE
    fake_client = _FakeClient()
    try:
        pipeline.httpx.AsyncClient = lambda timeout=120: fake_client
        pipeline.EMBEDDING_BATCH_SIZE = 32
        texts = [f"chunk-{i}" for i in range(70)]
        vectors = await pipeline.embed_texts(texts)
        assert fake_client.calls == [32, 32, 6]
        assert len(vectors) == 70
    finally:
        pipeline.httpx.AsyncClient = old_client
        pipeline.EMBEDDING_BATCH_SIZE = old_size


if __name__ == "__main__":
    import asyncio

    asyncio.run(_run_batching_test())
    print("ok")

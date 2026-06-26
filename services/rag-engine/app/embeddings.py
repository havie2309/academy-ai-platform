from __future__ import annotations

import httpx

from app.cache import RedisCache
from app.config import EMBEDDING_BASE_URL

cache = RedisCache()


async def embed_query(text: str, *, use_cache: bool = True) -> list[float]:
    if use_cache:
        cached = cache.get_embedding(text)
        if cached is not None:
            return cached

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{EMBEDDING_BASE_URL.rstrip('/')}/v1/embeddings",
            json={"input": text},
        )
        response.raise_for_status()
        embedding = response.json()["data"][0]["embedding"]

    if use_cache:
        cache.set_embedding(text, embedding)
    return embedding

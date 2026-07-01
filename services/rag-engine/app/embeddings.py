from __future__ import annotations

from ai_clients import create_embeddings

from app.cache import RedisCache
from app.config import EMBEDDING_BASE_URL

cache = RedisCache()


async def embed_query(text: str, *, use_cache: bool = True) -> list[float]:
    if use_cache:
        cached = cache.get_embedding(text)
        if cached is not None:
            return cached

    embedding = (
        await create_embeddings(
            base_url=EMBEDDING_BASE_URL,
            inputs=[text],
            timeout=60.0,
        )
    )[0]

    if use_cache:
        cache.set_embedding(text, embedding)
    return embedding

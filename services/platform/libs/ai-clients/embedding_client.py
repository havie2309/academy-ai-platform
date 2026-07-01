import os

from ai_clients import create_embeddings

EMBEDDING_BASE_URL = os.getenv("EMBEDDING_BASE_URL", "http://localhost:8001")

async def embed(texts: list[str]) -> list[list[float]]:
    return await create_embeddings(
        base_url=EMBEDDING_BASE_URL,
        inputs=texts,
        timeout=30,
    )

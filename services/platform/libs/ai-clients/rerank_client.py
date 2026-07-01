import os

from ai_clients import rerank_documents

RERANK_BASE_URL = os.getenv("RERANK_BASE_URL", "http://localhost:8002")

async def rerank(query: str, documents: list[str]) -> list[dict]:
    """Call rerank-server; returns [{index, score}, ...] sorted by score desc."""
    return await rerank_documents(
        base_url=RERANK_BASE_URL,
        query=query,
        documents=documents,
        timeout=60,
    )

import httpx
import os

RERANK_BASE_URL = os.getenv("RERANK_BASE_URL", "http://localhost:8002")

async def rerank(query: str, documents: list[str]) -> list[dict]:
    """Call rerank-server; returns [{index, score}, ...] sorted by score desc."""
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{RERANK_BASE_URL.rstrip('/')}/v1/rerank",
            json={"query": query, "documents": documents},
        )
        response.raise_for_status()
        return response.json()["results"]
import httpx
import os

RERANK_BASE_URL = os.getenv("RERANK_BASE_URL", "http://localhost:8002")

async def rerank(query: str, documents: list[str]) -> list[dict]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{RERANK_BASE_URL}/v1/rerank",
            json={"query": query, "documents": documents}
        )
        response.raise_for_status()
        return response.json()["results"]
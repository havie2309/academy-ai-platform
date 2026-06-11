import httpx
import os

EMBEDDING_BASE_URL = os.getenv("EMBEDDING_BASE_URL", "https://localhost:8001")

async def embed(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{EMBEDDING_BASE_URL}/v1/embeddings",
            json={"input": texts}
        )
        response.raise_for_status() # kiem tra loi trong response
        return [item["embedding"] for item in response.json()["data"]]
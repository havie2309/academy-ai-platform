import httpx
import os

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434")

async def chat_completion(messages: list, model: str = "qwen2.5:3b") -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{LLM_BASE_URL}/v1/chat/completions",
            json={"model": model, "messages": messages}
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
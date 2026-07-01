import os

from ai_clients import create_chat_completion, extract_message_content, resolve_chat_target

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434")

async def chat_completion(messages: list, model: str = "qwen2.5:3b") -> str:
    target = resolve_chat_target(
        provider="ollama",
        base_url=LLM_BASE_URL,
        model=model,
    )
    payload = await create_chat_completion(
        target,
        messages,
        timeout=30,
    )
    return str(extract_message_content(payload) or "")

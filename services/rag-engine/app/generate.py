"""RAG answer generation: grounding prompt + LLM call (Ollama / OpenAI).

Keeps the answer logic inside rag-engine so it is the single RAG orchestrator:
retrieve -> build grounded messages -> call LLM -> grounded answer + citations.
"""

import json
from collections.abc import AsyncIterator

import httpx

from app.config import (
    LLM_BASE_URL,
    LLM_MODEL,
    LLM_PROVIDER,
    LLM_TIMEOUT,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)

SYSTEM_PROMPT = """
Bạn là trợ lý ảo của học viện, hỗ trợ cán bộ, giảng viên và học viên tra cứu thông tin đào tạo, khảo thí, nghiên cứu khoa học.

Nguyên tắc trả lời:
- Luôn trả lời bằng tiếng Việt.
- Trả lời ngắn gọn, rõ ràng, đúng trọng tâm.
- Chỉ dùng thông tin có trong tài liệu được cung cấp.
- Không bịa thông tin ngoài tài liệu.
- Nếu không tìm thấy thông tin trong tài liệu, trả lời: "Tôi không tìm thấy thông tin này trong tài liệu được cung cấp."

Định dạng câu trả lời:
- Không chèn mã tài liệu, phiên bản, ngày ban hành, metadata vào giữa câu trả lời.
- Nếu câu trả lời có nhiều ý, dùng danh sách bullet.
- Không viết phần "Ghi chú kiểm thử" cho người dùng.
- Không lặp lại nguồn nhiều lần trong từng bullet.
- Phần nguồn tham khảo phải đặt riêng ở cuối câu trả lời.
""".strip()


class LlmError(RuntimeError):
    """Raised when the upstream LLM call fails."""


def _llm_target() -> tuple[str, str, dict[str, str]]:
    """Resolve (url, model, headers) for the configured LLM provider."""
    provider = LLM_PROVIDER
    if not provider:
        provider = "ollama" if LLM_BASE_URL else "openai"

    if provider == "openai":
        if not OPENAI_API_KEY:
            raise LlmError("Chưa cấu hình OPENAI_API_KEY cho rag-engine.")
        return (
            "https://api.openai.com/v1/chat/completions",
            OPENAI_MODEL,
            {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
        )

    base = (LLM_BASE_URL or "http://localhost:11434").rstrip("/")
    return (
        f"{base}/v1/chat/completions",
        LLM_MODEL,
        {"Content-Type": "application/json"},
    )


def build_messages(
    history: list[dict], citations: list[dict]
) -> list[dict]:
    """System prompt (+ retrieved context) followed by the conversation history.

    `citations` carry the full chunk `text` used as grounding context. History
    already ends with the latest user turn (mirrors the chat service).
    """
    if citations:
        context = "\n\nNgữ cảnh tham khảo (trích từ kho tài liệu):\n" + "\n".join(
            f"[{i + 1}] {c.get('title', 'Tài liệu')} ({c.get('source', 'Kho tài liệu')}): "
            f"{c.get('text') or c.get('snippet', '')}"
            for i, c in enumerate(citations)
        )
    else:
        context = (
            "\n\nKhông tìm thấy tài liệu liên quan trong kho. "
            "Hãy trả lời rằng không tìm thấy thông tin trong tài liệu được cung cấp."
        )

    system = SYSTEM_PROMPT + context
    convo = [
        {"role": m["role"], "content": m["content"]}
        for m in history
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    return [{"role": "system", "content": system}, *convo]


async def complete_chat(history: list[dict], citations: list[dict]) -> str:
    """Non-streaming grounded answer."""
    url, model, headers = _llm_target()
    messages = build_messages(history, citations)
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        res = await client.post(
            url, headers=headers, json={"model": model, "messages": messages}
        )
        if res.status_code >= 400:
            raise LlmError(f"LLM API lỗi ({res.status_code}): {res.text[:200]}")
        data = res.json()
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
    if not content or not content.strip():
        raise LlmError("LLM trả về rỗng.")
    return content


async def stream_chat(
    history: list[dict], citations: list[dict]
) -> AsyncIterator[str]:
    """Yield answer token deltas from the LLM (OpenAI-compatible SSE)."""
    url, model, headers = _llm_target()
    messages = build_messages(history, citations)
    payload = {"model": model, "messages": messages, "stream": True}
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        async with client.stream(
            "POST", url, headers=headers, json=payload
        ) as res:
            if res.status_code >= 400:
                body = (await res.aread()).decode("utf-8", "replace")
                raise LlmError(f"LLM API lỗi ({res.status_code}): {body[:200]}")
            async for line in res.aiter_lines():
                line = line.strip()
                if not line.startswith("data:"):
                    continue
                payload_str = line[5:].strip()
                if payload_str == "[DONE]":
                    break
                try:
                    obj = json.loads(payload_str)
                    delta = (obj.get("choices") or [{}])[0].get("delta", {}).get(
                        "content"
                    )
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if delta:
                    yield delta

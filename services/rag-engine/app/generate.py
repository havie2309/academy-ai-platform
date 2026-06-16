"""RAG answer generation: grounding prompt + LLM call (Ollama / OpenAI).

Keeps the answer logic inside rag-engine so it is the single RAG orchestrator:
retrieve -> build grounded messages -> call LLM -> grounded answer + citations.
"""

import json
import re
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

NGUYÊN TẮC TRẢ LỜI:
- Luôn trả lời bằng tiếng Việt.
- Trả lời ngắn gọn, rõ ràng, đúng trọng tâm.
- Chỉ dùng thông tin có trong các chunk tài liệu được cung cấp.
- Không dùng kiến thức bên ngoài.
- Không bịa thông tin ngoài tài liệu.
- Không suy đoán nếu tài liệu không nói rõ.
- Không kết luận chỉ dựa vào tên file, mã tài liệu, metadata hoặc tiêu đề tài liệu.
- Nếu không tìm thấy thông tin trong tài liệu, trả lời đúng câu:
  "Tôi không tìm thấy thông tin này trong tài liệu được cung cấp."

CÁCH CHỌN CHUNK:
- used_chunk_ids chỉ gồm chunk thực sự được dùng để suy luận câu trả lời.
- reference_chunk_ids gồm các chunk/tài liệu liên quan để người dùng đọc thêm.
- Một chunk có thể nằm trong reference_chunk_ids dù không nằm trong used_chunk_ids, nếu nó cùng chủ đề và hữu ích để tham khảo thêm.
- Không đưa chunk vào used_chunk_ids nếu chunk đó không trực tiếp hỗ trợ câu trả lời.
- Không đưa chunk vào reference_chunk_ids chỉ vì cùng file; phải có liên quan đến câu hỏi.

ĐỊNH DẠNG CÂU TRẢ LỜI:
- Không chèn mã tài liệu, chunk_id, metadata, ngày ban hành vào trong answer.
- Không viết phần "Ghi chú kiểm thử".
- Không tự tạo phần "Nguồn tham khảo" trong answer.
- Frontend sẽ tự hiển thị nguồn dựa trên reference_chunk_ids.

Ràng buộc đầu ra:
- BẮT BUỘC trả về JSON hợp lệ, không thêm text ngoài JSON.
- Schema JSON:
  {
    "answer": "câu trả lời tiếng Việt",
    "used_chunk_ids": ["chunk_id_1", "chunk_id_2"]
  }
- "used_chunk_ids" chỉ gồm chunk_id thực sự đã dùng để suy luận câu trả lời.
- Nếu không tìm thấy thông tin trong tài liệu, "answer" phải là câu từ chối chuẩn và "used_chunk_ids" phải là [].
""".strip()


class LlmError(RuntimeError):
    """Raised when the upstream LLM call fails."""


def _extract_json_object(text: str) -> dict | None:
    raw = text.strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    # Fallback for fenced markdown JSON blocks.
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw, flags=re.I)
    if fence:
        try:
            parsed = json.loads(fence.group(1))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def parse_llm_structured_output(raw: str) -> tuple[str, list[str]]:
    parsed = _extract_json_object(raw)
    if not parsed:
        # Fallback: keep content as answer, empty used ids -> backend heuristic fallback.
        return raw.strip(), []

    answer = str(parsed.get("answer", "")).strip()
    ids = parsed.get("used_chunk_ids", [])
    if isinstance(ids, list):
        used_ids = [str(x).strip() for x in ids if str(x).strip()]
    else:
        used_ids = []
    return answer, used_ids


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
            f"[{i + 1}] chunk_id={c.get('chunk_id', '')} | {c.get('title', 'Tài liệu')} ({c.get('source', 'Kho tài liệu')}): "
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


async def complete_chat_raw(history: list[dict], citations: list[dict]) -> str:
    """Non-streaming grounded answer (raw LLM content)."""
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


async def complete_chat_structured(
    history: list[dict], citations: list[dict]
) -> tuple[str, list[str]]:
    raw = await complete_chat_raw(history, citations)
    answer, used_chunk_ids = parse_llm_structured_output(raw)
    if not answer:
        raise LlmError("LLM trả về rỗng.")
    return answer, used_chunk_ids


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

"""Generate a single SELECT statement from natural language."""

from __future__ import annotations

import re

import httpx

from app.config import (
    LLM_TIMEOUT,
    OPENAI_API_KEY,
    SQL_FEW_SHOT_ENABLED,
    SQL_LLM_BASE_URL,
    SQL_LLM_MODEL,
    SQL_LLM_PROVIDER,
    SQL_OPENAI_MODEL,
)
from app.generate import LlmError
from app.sql_catalog import build_few_shot_prompt, build_schema_prompt

SQL_SYSTEM_PROMPT = """
Bạn là trợ lý sinh câu lệnh SQL PostgreSQL cho hệ thống đào tạo PM2.

Quy tắc BẮT BUỘC:
- Chỉ sinh MỘT câu lệnh SELECT duy nhất.
- Chỉ dùng các view trong schema sql_curated được liệt kê dưới đây.
- Luôn có mệnh đề LIMIT (tối đa 100).
- KHÔNG tự thêm WHERE theo ma_hv/ma_gv — hệ thống sẽ lọc theo quyền người dùng.
- Nếu câu hỏi nêu rõ mã học viên (số 5–8 chữ số) hoặc mã giảng viên (GVxxxx), có thể dùng trong WHERE.
- Với câu hỏi "của tôi", KHÔNG đoán mã — chỉ SELECT cột cần thiết, không WHERE ma_hv.
- Nếu câu hỏi hỏi "bao nhiêu" / "thống kê", ưu tiên SELECT COUNT(...) hoặc GROUP BY phù hợp.
- Chỉ JOIN khi thật sự cần ghép dữ liệu từ nhiều view; nếu 1 view đã đủ thì không JOIN.
- Không dùng comment SQL (-- hoặc /* */).
- Không dùng DDL/DML, không dùng ; nhiều câu, không dùng function nguy hiểm.
- Không bọc trong markdown, chỉ trả về câu SQL thuần.

{schema}

{few_shot}
""".strip()


def _extract_sql(raw: str) -> str:
    text = raw.strip()
    fence = re.search(r"```(?:sql)?\s*([\s\S]*?)```", text, flags=re.I)
    if fence:
        text = fence.group(1).strip()

    match = re.search(r"\bSELECT\b[\s\S]*", text, flags=re.I)
    if match:
        candidate = match.group(0).strip()
        candidate = re.split(r";\s*(?=\S)", candidate, maxsplit=1)[0].strip()
        lines = [line.strip() for line in candidate.splitlines() if line.strip()]
        normalized = " ".join(lines)
        if normalized.upper().startswith("SELECT"):
            return normalized
    raise LlmError("Model không trả về câu SELECT hợp lệ.")


def _sql_llm_target() -> tuple[str, str, dict[str, str]]:
    """Resolve dedicated LLM target for SQL generation."""
    provider = SQL_LLM_PROVIDER or ("ollama" if SQL_LLM_BASE_URL else "openai")

    if provider == "openai":
        if not OPENAI_API_KEY:
            raise LlmError("Chưa cấu hình OPENAI_API_KEY cho SQL generation.")
        return (
            "https://api.openai.com/v1/chat/completions",
            SQL_OPENAI_MODEL,
            {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
        )

    base = (SQL_LLM_BASE_URL or "http://localhost:11434").rstrip("/")
    return (
        f"{base}/v1/chat/completions",
        SQL_LLM_MODEL,
        {"Content-Type": "application/json"},
    )


def build_sql_messages(question: str) -> list[dict[str, str]]:
    few_shot = build_few_shot_prompt() if SQL_FEW_SHOT_ENABLED else "Few-shot: disabled."
    system = SQL_SYSTEM_PROMPT.format(
        schema=build_schema_prompt(),
        few_shot=few_shot,
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": question},
    ]


async def generate_sql(question: str) -> str:
    url, model, headers = _sql_llm_target()
    messages = build_sql_messages(question)
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        res = await client.post(
            url,
            headers=headers,
            json={"model": model, "messages": messages, "temperature": 0.1},
        )
        if res.status_code >= 400:
            raise LlmError(f"LLM API lỗi ({res.status_code}): {res.text[:200]}")
        data = res.json()
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
    if not content or not content.strip():
        raise LlmError("LLM trả về rỗng khi sinh SQL.")
    return _extract_sql(content)

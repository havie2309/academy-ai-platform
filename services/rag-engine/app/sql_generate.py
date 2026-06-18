"""Generate a single SELECT statement from natural language."""

from __future__ import annotations

import re

import httpx

from app.config import LLM_TIMEOUT
from app.generate import LlmError, _llm_target
from app.sql_catalog import build_schema_prompt

SQL_SYSTEM_PROMPT = """
Bạn là trợ lý sinh câu lệnh SQL PostgreSQL cho hệ thống đào tạo PM2.

Quy tắc BẮT BUỘC:
- Chỉ sinh MỘT câu lệnh SELECT duy nhất.
- Chỉ dùng các view trong schema sql_curated được liệt kê dưới đây.
- Luôn có mệnh đề LIMIT (tối đa 100).
- KHÔNG tự thêm WHERE theo ma_hv/ma_gv — hệ thống sẽ lọc theo quyền người dùng.
- Nếu câu hỏi nêu rõ mã học viên (số 5–8 chữ số) hoặc mã giảng viên (GVxxxx), có thể dùng trong WHERE.
- Với câu hỏi "của tôi", KHÔNG đoán mã — chỉ SELECT cột cần thiết, không WHERE ma_hv.
- Không dùng comment SQL (-- hoặc /* */).
- Không dùng DDL/DML, không dùng ; nhiều câu, không dùng function nguy hiểm.
- Không bọc trong markdown, chỉ trả về câu SQL thuần.

{schema}
""".strip()


def _extract_sql(raw: str) -> str:
    text = raw.strip()
    fence = re.search(r"```(?:sql)?\s*([\s\S]*?)```", text, flags=re.I)
    if fence:
        text = fence.group(1).strip()
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.upper().startswith("SELECT"):
            return stripped
    if text.upper().startswith("SELECT"):
        return text.split(";")[0].strip()
    raise LlmError("Model không trả về câu SELECT hợp lệ.")


async def generate_sql(question: str) -> str:
    url, model, headers = _llm_target()
    system = SQL_SYSTEM_PROMPT.format(schema=build_schema_prompt())
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": question},
    ]
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

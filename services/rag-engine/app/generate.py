"""RAG answer generation: grounding prompt + LLM call (Ollama / OpenAI).

Keeps the answer logic inside rag-engine so it is the single RAG orchestrator:
retrieve -> build grounded messages -> call LLM -> grounded answer + citations.
"""

import json
import re
from collections.abc import AsyncIterator

import httpx
from ai_clients import (
    AIClientError,
    ChatCompletionTarget,
    create_chat_completion,
    extract_message_content,
    resolve_chat_target,
    stream_chat_completion,
)

from app.config import (
    LLM_BASE_URL,
    LLM_FALLBACK_BASE_URL,
    LLM_FALLBACK_MODEL,
    LLM_FALLBACK_PROVIDER,
    LLM_MODEL,
    LLM_PROVIDER,
    LLM_TIMEOUT,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)

SYSTEM_PROMPT = """
Bạn là trợ lý ảo của học viện, hỗ trợ cán bộ, giảng viên và học viên tra cứu thông tin đào tạo, khảo thí, nghiên cứu khoa học.

NGUYÊN TẮC TRẢ LỜI:
- Luôn trả lời bằng tiếng Việt, không được dùng ngôn ngữ khác (không dùng tiếng Anh, tiếng Trung hoặc ký tự lạ trong phần trả lời).
- Nếu nội dung trong tài liệu có tiếng nước ngoài, hãy diễn giải lại đầy đủ bằng tiếng Việt, không trích nguyên văn cả câu dài bằng ngoại ngữ.
- Tóm tắt các điều kiện, quy định và ngoại lệ quan trọng trong các chunk được sử dụng.
- Khi tài liệu có đủ thông tin, cố gắng trả lời tương đối đầy đủ trong khoảng 2–5 câu, nêu rõ kết luận chính và lý do (dựa trên điều, mục, chương liên quan).
- Chỉ trả lời cực ngắn khi tài liệu cũng chỉ chứa một thông tin duy nhất và không có thêm chi tiết quan trọng nào khác.
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
- Có thể sử dụng markdown đơn giản trong answer:
  + Bullet: "- "
  + Xuống dòng: "\\n"
- Nếu có nhiều ý, nhiều điều kiện hoặc nhiều kết quả, ưu tiên dùng bullet thay vì viết thành một đoạn văn dài.
- Không lạm dụng bullet khi câu trả lời chỉ có một ý ngắn gọn.

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

TASK_ASSIST_SYSTEM_PROMPT = """
Ban la tro ly ao cua hoc vien, ho tro can bo, giang vien va hoc vien xu ly nhanh
cac tac vu nhu soan email, thong bao, checklist, ke hoach ngan va dien giai noi dung.

NGUYEN TAC TRA LOI:
- Luon tra loi bang tieng Viet.
- Dua ra ban nhap hoac goi y thuc dung, gon va de sua.
- Khong khang dinh day la quy dinh chinh thuc neu nguoi dung khong cung cap tai lieu.
- Neu yeu cau phu thuoc quy dinh noi bo cu the, phai noi ro day chi la goi y chung
  va khuyen doi chieu voi van ban/tai lieu chinh thuc.
- Khong tu dat ten don vi, ma van ban, thoi gian hay thong tin ca nhan ma nguoi dung
  chua cung cap.
- Neu phu hop, co the tra loi bang bullet hoac mau van ban ngan.
""".strip()


class LlmError(RuntimeError):
    """Raised when the upstream LLM call fails."""


def _is_no_info_answer(text: str) -> bool:
    t = text.strip().lower()
    return (
        "không tìm thấy thông tin" in t
        or "khong tim thay thong tin" in t
        or "không có thông tin" in t
    )


def _sentence_count(text: str) -> int:
    parts = [p.strip() for p in re.split(r"[.!?;\n]+", text) if p.strip()]
    return len(parts)


def _is_too_brief_answer(text: str) -> bool:
    t = text.strip()
    if not t:
        return True
    short_tokens = {
        "không",
        "có",
        "được",
        "không được",
        "co",
        "khong",
    }
    if t.lower().rstrip(".!?") in short_tokens:
        return True
    return len(t) < 40 or _sentence_count(t) < 2


def _extract_first_json_candidate(raw: str) -> str | None:
    """Find first balanced JSON object in a mixed model output."""
    start = raw.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(raw)):
        ch = raw[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return raw[start : i + 1]
    return None


def _extract_json_object(text: str) -> dict | None:
    raw = text.strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw, flags=re.I)
    if fence:
        try:
            parsed = json.loads(fence.group(1))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    tail = re.search(
        r"(\{[\s\S]*?\"answer\"[\s\S]*?\"used_chunk_ids\"[\s\S]*?\})\s*$",
        raw,
        flags=re.I,
    )
    if tail:
        try:
            parsed = json.loads(tail.group(1))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pass

    tail_list = re.search(
        r"(\[[\s\S]*?\"answer\"[\s\S]*?\"used_chunk_ids\"[\s\S]*?\])\s*$",
        raw,
        flags=re.I,
    )
    if tail_list:
        try:
            parsed_list = json.loads(tail_list.group(1))
            if isinstance(parsed_list, list):
                for item in parsed_list:
                    if isinstance(item, dict) and (
                        "answer" in item or "used_chunk_ids" in item
                    ):
                        return item
        except json.JSONDecodeError:
            pass
    candidate = _extract_first_json_candidate(raw)
    if candidate:
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _strip_trailing_json_block(raw: str) -> str:
    """Remove appended JSON tail from mixed LLM output for clean UI answer."""
    text = raw.strip()
    if not text:
        return text
    text = re.sub(r"```(?:json)?\s*\{[\s\S]*\}\s*```$", "", text, flags=re.I).strip()
    text = re.sub(
        r"\[\s*\{[\s\S]*?\"used_chunk_ids\"[\s\S]*?\}\s*\]\s*$",
        "",
        text,
        flags=re.I,
    ).strip()
    text = re.sub(
        r"\{[\s\S]*?\"used_chunk_ids\"[\s\S]*?\}\s*$",
        "",
        text,
        flags=re.I,
    ).strip()
    text = re.sub(
        r"\{[\s\S]*?\"answer\"[\s\S]*?\"used_chunk_ids\"[\s\S]*?\}\s*$",
        "",
        text,
        flags=re.I,
    ).strip()
    return text


def _clean_answer_text(raw: str) -> str:
    """Normalize visible answer text before it reaches the UI."""
    text = _strip_trailing_json_block(raw).strip()
    if not text:
        return text

    text = re.sub(r"^```(?:markdown|md|text)?\s*", "", text, flags=re.I).strip()
    text = re.sub(r"\s*```$", "", text).strip()

    lines: list[str] = []
    skipping_reference_lines = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        lowered = line.lower()

        if lowered in {
            "nguồn tham khảo",
            "nguồn tham khảo:",
            "tài liệu tham khảo",
            "tài liệu tham khảo:",
            "nguon tham khao",
            "nguon tham khao:",
            "tai lieu tham khao",
            "tai lieu tham khao:",
        }:
            skipping_reference_lines = True
            continue

        if skipping_reference_lines:
            if re.match(r"^(?:[-*]|\[\d+\])\s+", line):
                continue
            if not line:
                continue
            skipping_reference_lines = False

        if re.match(r"^\[\d+\]\s*chunk_id=", line, flags=re.I):
            continue
        if re.match(r"^chunk_id\s*=", line, flags=re.I):
            continue

        lines.append(raw_line.rstrip())

    text = "\n".join(lines).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def _parse_chunk_id_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    chunk_ids: list[str] = []
    for item in value:
        chunk_id = str(item).strip()
        if not chunk_id or chunk_id in seen:
            continue
        seen.add(chunk_id)
        chunk_ids.append(chunk_id)
    return chunk_ids


def parse_llm_structured_output(raw: str) -> tuple[str, list[str], list[str]]:
    clean_answer = _clean_answer_text(raw)
    parsed = _extract_json_object(raw)
    if not parsed:
        return clean_answer, [], []

    answer = _clean_answer_text(str(parsed.get("answer", "")))
    used_ids = _parse_chunk_id_list(parsed.get("used_chunk_ids", []))
    reference_ids = _parse_chunk_id_list(parsed.get("reference_chunk_ids", []))
    if not answer:
        return clean_answer, used_ids, reference_ids
    return answer, used_ids, reference_ids


def build_messages(
    history: list[dict],
    citations: list[dict],
    *,
    require_json: bool = True,
    force_answer_from_context: bool = False,
    force_expand_answer: bool = False,
) -> list[dict]:
    """System prompt (+ retrieved context) followed by the conversation history."""
    if citations:
        groups: dict[str, dict[str, list[str]]] = {}
        for c in citations:
            title = c.get('title', 'Tài liệu không tên')
            path = c.get('section_path', '')
            text = c.get('text') or c.get('snippet', '')
            if not text:
                continue
            groups.setdefault(title, {}).setdefault(path, []).append(text)

        md_parts = []
        for title, paths in groups.items():
            md_parts.append(f"# {title}")
            for path, texts in paths.items():
                if path:
                    md_parts.append(f"## {path}")
                for t in texts:
                    md_parts.append(t.strip())
        context = "\n\n".join(md_parts) if md_parts else ""
    else:
        context = "Không tìm thấy tài liệu liên quan trong kho."

    output_contract = (
        "\n\nBẮT BUỘC đầu ra JSON hợp lệ theo schema:\n"
        '{"answer":"...","used_chunk_ids":["chunk_id_1"],'
        '"reference_chunk_ids":["chunk_id_1","chunk_id_2"]}\n'
        "- `used_chunk_ids`: chunk được dùng trực tiếp để suy luận câu trả lời.\n"
        "- `reference_chunk_ids`: chunk nên hiển thị ở UI làm nguồn tham khảo; liệt kê `used_chunk_ids` trước, rồi mới thêm chunk liên quan để đọc thêm.\n"
        "- Nếu không có nguồn đọc thêm riêng, `reference_chunk_ids` có thể trùng với `used_chunk_ids`."
        if require_json
        else "\n\nTrả lời trực tiếp bằng tiếng Việt, không cần JSON."
    )
    anti_refusal = ""
    if force_answer_from_context:
        anti_refusal = (
            "\n\nLưu ý quan trọng (ghi đè mọi hướng dẫn trước đó):\n"
            "- Nếu trong ngữ cảnh có đầy đủ quy định liên quan và có thể áp dụng trực tiếp cho trường hợp người dùng hỏi, hãy suy luận kết luận dựa trên quy định đó.\n"
            "- Chỉ được suy luận từ các điều kiện xuất hiện rõ trong chunk tài liệu. Không bổ sung điều kiện ngoài tài liệu.\n"
            '- Nếu ngữ cảnh không đủ căn cứ trực tiếp, vẫn trả lời: "Tôi không tìm thấy thông tin này trong tài liệu được cung cấp."'
        )
    expand_answer = ""
    if force_expand_answer:
        expand_answer = (
            "\n\nYêu cầu bổ sung bắt buộc:\n"
            "- Không trả lời một từ hoặc một câu cụt.\n"
            "- Trả lời tối thiểu 2 câu tiếng Việt, gồm: (1) kết luận chính, (2) lý do/điều kiện áp dụng từ ngữ cảnh.\n"
            "- Nếu có điều kiện ngoại lệ trong ngữ cảnh thì nêu ngắn gọn."
        )
    system = SYSTEM_PROMPT + f"\n\nNgữ cảnh tham khảo:\n{context}" + output_contract + anti_refusal + expand_answer
    convo = [
        {"role": m["role"], "content": m["content"]}
        for m in history
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    return [{"role": "system", "content": system}, *convo]


def build_task_assist_messages(history: list[dict]) -> list[dict]:
    convo = [
        {"role": m["role"], "content": m["content"]}
        for m in history
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    return [{"role": "system", "content": TASK_ASSIST_SYSTEM_PROMPT}, *convo]


# ------------------------------------------------------------------
# AI Client based implementations (retry/fallback/circuit-breaker)
# ------------------------------------------------------------------

def _resolve_llm_target() -> ChatCompletionTarget:
    try:
        return resolve_chat_target(
            provider=LLM_PROVIDER,
            base_url=LLM_BASE_URL,
            model=LLM_MODEL,
            openai_api_key=OPENAI_API_KEY,
            openai_model=OPENAI_MODEL,
        )
    except ValueError as exc:
        raise LlmError(str(exc)) from exc


def _llm_fallback_targets() -> list[ChatCompletionTarget]:
    has_fallback = bool(
        LLM_FALLBACK_PROVIDER or LLM_FALLBACK_BASE_URL or LLM_FALLBACK_MODEL
    )
    if not has_fallback:
        return []

    provider = LLM_FALLBACK_PROVIDER or ("ollama" if LLM_FALLBACK_BASE_URL else "openai")
    model = LLM_FALLBACK_MODEL or (OPENAI_MODEL if provider == "openai" else LLM_MODEL)
    try:
        fallback = resolve_chat_target(
            provider=provider,
            base_url=LLM_FALLBACK_BASE_URL,
            model=model,
            openai_api_key=OPENAI_API_KEY,
            openai_model=model,
        )
    except ValueError as exc:
        raise LlmError(str(exc)) from exc

    primary = _resolve_llm_target()
    if (fallback.url, fallback.model) == (primary.url, primary.model):
        return []
    return [fallback]


async def complete_chat_raw(
    history: list[dict],
    citations: list[dict],
    *,
    require_json: bool = True,
    force_answer_from_context: bool = False,
    force_expand_answer: bool = False,
) -> str:
    """Non-streaming grounded answer using AI client (with retry/fallback)."""
    target = _resolve_llm_target()
    messages = build_messages(
        history,
        citations,
        require_json=require_json,
        force_answer_from_context=force_answer_from_context,
        force_expand_answer=force_expand_answer,
    )
    try:
        data = await create_chat_completion(
            target,
            messages,
            temperature=0.3,
            timeout=LLM_TIMEOUT,
            fallback_targets=_llm_fallback_targets(),
        )
    except (AIClientError, httpx.HTTPError) as exc:
        raise LlmError(str(exc)) from exc
    content = extract_message_content(data)
    if not content or not content.strip():
        raise LlmError("LLM trả về rỗng.")
    return content


async def complete_chat_structured(
    history: list[dict], citations: list[dict]
) -> tuple[str, list[str], list[str]]:
    """
    Non-streaming grounded answer, returning parsed (answer, used_ids, reference_ids).
    Uses the AI client (retry/fallback) internally.
    """
    raw = await complete_chat_raw(history, citations, require_json=True)
    answer, used_chunk_ids, reference_chunk_ids = parse_llm_structured_output(raw)
    if not answer:
        raise LlmError("LLM trả về rỗng.")

    # qwen2.5:3b may over-refuse in strict JSON mode; if retrieval has context,
    # retry once with relaxed output contract to reduce false "không tìm thấy".
    if _is_no_info_answer(answer) and citations:
        retry_raw = await complete_chat_raw(
            history,
            citations,
            require_json=False,
            force_answer_from_context=True,
        )
        retry_answer = _clean_answer_text(retry_raw)
        if retry_answer and not _is_no_info_answer(retry_answer):
            return retry_answer, [], []
    # qwen2.5:3b may answer too briefly ("Không.") despite relevant context.
    # Retry once with an explicit minimum explanation constraint.
    if citations and not _is_no_info_answer(answer) and _is_too_brief_answer(answer):
        retry_raw = await complete_chat_raw(
            history,
            citations,
            require_json=False,
            force_answer_from_context=True,
            force_expand_answer=True,
        )
        retry_answer = _clean_answer_text(retry_raw)
        if retry_answer and not _is_no_info_answer(retry_answer):
            return retry_answer, [], []
    return answer, used_chunk_ids, reference_chunk_ids


async def complete_task_assist(history: list[dict]) -> str:
    """Direct non-grounded helper answer with AI client."""
    target = _resolve_llm_target()
    messages = build_task_assist_messages(history)
    try:
        data = await create_chat_completion(
            target,
            messages,
            temperature=0.4,
            timeout=LLM_TIMEOUT,
            fallback_targets=_llm_fallback_targets(),
        )
    except (AIClientError, httpx.HTTPError) as exc:
        raise LlmError(str(exc)) from exc
    content = extract_message_content(data)
    answer = _clean_answer_text(str(content or ""))
    if not answer:
        raise LlmError("LLM trả về rỗng.")
    return answer


async def stream_chat(
    history: list[dict],
    citations: list[dict],
    require_json: bool = False,
    force_answer_from_context: bool = False,
    force_expand_answer: bool = False,
) -> AsyncIterator[str]:
    """
    Stream answer token deltas using AI client (with retry/fallback).
    The extra parameters are passed to build_messages to control prompt behaviour.
    """
    target = _resolve_llm_target()
    messages = build_messages(
        history,
        citations,
        require_json=require_json,
        force_answer_from_context=force_answer_from_context,
        force_expand_answer=force_expand_answer,
    )
    try:
        async for delta in stream_chat_completion(
            target,
            messages,
            timeout=LLM_TIMEOUT,
            fallback_targets=_llm_fallback_targets(),
        ):
            yield delta
    except (AIClientError, httpx.HTTPError) as exc:
        raise LlmError(str(exc)) from exc

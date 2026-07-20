import json
import re
import unicodedata
from urllib.parse import unquote
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.cache import RedisCache
from app.config import (
    GATEWAY_INTERNAL_SHARED_SECRET,
    SESSION_CONTEXT_MAX_MESSAGES,
    SUMMARY_MAX_CHARS,
    QUIZ_MAX_CHARS,
)
from app.quizzes import check_document_permission, get_quiz_status, generate_quizzes
from app.generate import LlmError, complete_chat_structured, complete_task_assist, stream_chat
from app.guardrails.document_security import build_document_security_refusal
from app.retrieval import retrieve_citations
from app.router import classify_route
from app.safe_refusal import _load_example_embeddings, check_query_clarity, maybe_refuse_query, retrieve_refusal_payload
from app.sql_execute import close_pool, init_pool
from app.sql_pipeline import SqlPipelineError, run_sql_query
from app.summarize import stream_document_summary

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_pool()
    await _load_example_embeddings()
    yield
    await close_pool()


app = FastAPI(title="RAG Engine", version="0.3.0", lifespan=lifespan)
session_cache = RedisCache()


class RetrieveUser(BaseModel):
    userId: str
    username: str = ""
    roles: list[str] = []
    normalizedRoles: list[str] = []
    department: str | None = None
    maxSecurityLevel: int = 1
    scopeMaHv: str | None = None
    scopeMaGv: str | None = None


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1)
    user: RetrieveUser | None = None
    # Optional document scope (intersected with the caller's ACL).
    docIds: list[str] = []


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    sessionId: str | None = None
    messages: list[ChatMessage] = []
    user: RetrieveUser | None = None
    # When set, retrieval is confined to these document ids (intersected with
    # the caller's ACL). Used by "Tra cứu tài liệu" to answer strictly from the
    # document the user has opened.
    docIds: list[str] = []


def _gateway_roles(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [role.strip() for role in raw.split(",") if role.strip()]


def _gateway_user(request: Request) -> RetrieveUser | None:
    # Reject requests that bypass the gateway when a shared secret is configured.
    if GATEWAY_INTERNAL_SHARED_SECRET:
        token = request.headers.get("x-gateway-internal-secret", "")
        if token != GATEWAY_INTERNAL_SHARED_SECRET:
            raise HTTPException(403, "forbidden: direct access not allowed")

    user_id = request.headers.get("x-gateway-user-id")
    if not user_id:
        return None

    scope_payload: dict[str, object] = {}
    raw_scope = request.headers.get("x-gateway-access-scope")
    if raw_scope:
        try:
            parsed = json.loads(unquote(raw_scope))
            if isinstance(parsed, dict):
                scope_payload = parsed
        except json.JSONDecodeError:
            scope_payload = {}

    username = request.headers.get("x-gateway-username", "")
    roles = _gateway_roles(request.headers.get("x-gateway-roles"))
    normalized_roles = _gateway_roles(
        request.headers.get("x-gateway-normalized-roles")
    )
    if not normalized_roles and isinstance(scope_payload.get("normalizedRoles"), list):
        normalized_roles = [
            str(role).strip()
            for role in scope_payload.get("normalizedRoles", [])
            if str(role).strip()
        ]
    department = request.headers.get("x-gateway-department") or None
    try:
        max_security_level = int(
            request.headers.get("x-gateway-max-security-level", "1")
        )
    except ValueError:
        max_security_level = 1

    return RetrieveUser(
        userId=user_id,
        username=username,
        roles=roles,
        normalizedRoles=normalized_roles,
        department=department,
        maxSecurityLevel=max_security_level,
        scopeMaHv=request.headers.get("x-gateway-scope-ma-hv")
        or scope_payload.get("scopeMaHv")
        or None,
        scopeMaGv=request.headers.get("x-gateway-scope-ma-gv")
        or scope_payload.get("scopeMaGv")
        or None,
    )


def _resolved_user(explicit_user: RetrieveUser | None, request: Request) -> dict:
    gateway_user = _gateway_user(request)
    if gateway_user is not None:
        return gateway_user.model_dump()
    if explicit_user is not None:
        return explicit_user.model_dump()
    raise HTTPException(401, "missing user context")


_TOKEN_RE = re.compile(r"[a-z0-9]{2,}")
_STOPWORDS = {
    "va",
    "voi",
    "cua",
    "cho",
    "trong",
    "theo",
    "nhung",
    "cac",
    "mot",
    "duoc",
    "khong",
    "thong",
    "tin",
    "nguoi",
    "dung",
    "tai",
    "lieu",
    "quy",
    "dinh",
    "hoc",
    "vien",
}


def _compact_ws(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _citation_identity_key(citation: dict) -> str:
    chunk_id = _compact_ws(citation.get("chunk_id")).lower()
    if chunk_id:
        return f"chunk:{chunk_id}"
    doc_id = _compact_ws(citation.get("doc_id")).lower()
    title = _compact_ws(citation.get("title")).lower()
    section_path = _compact_ws(citation.get("section_path")).lower()
    return f"doc:{doc_id}|title:{title}|section:{section_path}"


def _client_citations(citations: list[dict]) -> list[dict]:
    """Strip the full chunk `text` (LLM-only) before returning to the caller."""
    deduped: list[dict] = []
    seen: set[str] = set()
    for citation in citations:
        c = {k: v for k, v in citation.items() if k != "text"}
        c["doc_id"] = _compact_ws(c.get("doc_id"))
        c["chunk_id"] = _compact_ws(c.get("chunk_id"))
        c["title"] = _compact_ws(c.get("title")) or "Tài liệu"
        c["source"] = _compact_ws(c.get("source")) or "Kho tài liệu"
        c["snippet"] = _compact_ws(c.get("snippet"))
        if c.get("section_path"):
            c["section_path"] = _compact_ws(c.get("section_path"))

        key = _citation_identity_key(c)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)
    return deduped


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


_NO_INFO_PHRASES = (
    "không tìm thấy thông tin",
    "khong tim thay thong tin",
    "không có thông tin",
    "không có đủ thông tin",
    "chưa tìm thấy thông tin",
    "chưa tìm thấy tài liệu",
    "không tìm thấy tài liệu",
    "tài liệu không đề cập",
    "không được đề cập",
    "chưa có thông tin",
    "không có trong tài liệu",
    "không tìm thấy nội dung",
)

# Returned when RAG retrieval finds nothing at all (0 citations)
_NO_CITATIONS_ANSWER = (
    "Tôi không tìm thấy tài liệu nào liên quan đến câu hỏi này trong kho dữ liệu. "
    "Bạn có thể thử diễn đạt lại câu hỏi, hoặc liên hệ bộ phận phụ trách để "
    "bổ sung tài liệu vào hệ thống."
)

# Returned when citations exist but LLM couldn't derive a direct answer
_PARTIAL_INFO_ANSWER = (
    "Tôi tìm thấy một số tài liệu liên quan nhưng chưa có câu trả lời trực tiếp "
    "cho câu hỏi này. Dưới đây là các tài liệu có thể hữu ích:"
)


def _is_no_info_answer(answer: str) -> bool:
    text = answer.strip().lower()
    return any(phrase in text for phrase in _NO_INFO_PHRASES)


def _maybe_replace_refusal(answer: str) -> str:
    """When LLM says it couldn't find info despite having citations, replace with a clearer message."""
    if _is_no_info_answer(answer):
        return _PARTIAL_INFO_ANSWER
    return answer


def _fold_text(text: str) -> str:
    lowered = text.lower()
    normalized = unicodedata.normalize("NFD", lowered)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


REJECT_ANSWER = (
    "Câu hỏi này nằm ngoài phạm vi hỗ trợ của trợ lý. "
    "Hiện trợ lý chỉ hỗ trợ các câu hỏi về đào tạo, khảo thí, tài liệu nội bộ "
    "và các tác vụ học vụ liên quan."
)


def _reject_payload() -> dict:
    return {
        "answer": REJECT_ANSWER,
        "citations": [],
        "route": "reject",
    }


DML_DENIED_ANSWER = (
    "Lệnh xóa/cập nhật dữ liệu không được hỗ trợ. "
    "Hệ thống chỉ cho phép truy vấn dữ liệu (SELECT) thông qua Text‑to‑SQL."
)

def _dml_denied_payload() -> dict:
    return {
        "answer": DML_DENIED_ANSWER,
        "citations": [],
        "route": "dml_denied",
    }


async def _retrieve_for_rag(
    query: str,
    user: dict,
    scope_doc_ids: list[str] | None = None,
) -> tuple[list[dict], dict | None]:
    result = await retrieve_citations(query, user, scope_doc_ids=scope_doc_ids)
    if isinstance(result, list):
        return result, None
    if result.security_denied_all:
        return [], build_document_security_refusal(result.primary_denial)
    return result.citations, None


def _keyword_tokens(text: str) -> set[str]:
    folded = _fold_text(text)
    return {token for token in _TOKEN_RE.findall(folded) if token not in _STOPWORDS}


def _fallback_selected_citations(retrieved: list[dict], answer: str) -> list[dict]:
    if not retrieved:
        return []

    # 1. Separate by security
    internal = [c for c in retrieved if c.get("security_level") != "public"]
    public = [c for c in retrieved if c.get("security_level") == "public"]

    # 2. If we have internal docs, try to match them first
    candidates = internal if internal else public
    answer_tokens = _keyword_tokens(answer)
    
    if not answer_tokens:
        # No tokens to match, just take top internal docs
        return (internal[:3] if len(internal) >= 3 else internal + public[:3-len(internal)])[:3]

    # 3. Rank by token overlap
    ranked: list[tuple[int, int, dict]] = []
    for index, citation in enumerate(candidates):
        haystack = " ".join(
            [
                _compact_ws(citation.get("title")),
                _compact_ws(citation.get("source")),
                _compact_ws(citation.get("section_path")),
                _compact_ws(citation.get("snippet")),
            ]
        )
        overlap = len(answer_tokens & _keyword_tokens(haystack))
        ranked.append((overlap, -index, citation))

    ranked.sort(reverse=True)
    best_overlap = ranked[0][0]
    
    if best_overlap <= 0:
        # No overlap, return internal docs (or top public if none)
        return internal[:3] if internal else public[:3]

    # 4. Keep docs that are near the best overlap
    threshold = best_overlap if best_overlap < 2 else best_overlap - 1
    matched = [
        citation for overlap, _, citation in ranked
        if overlap > 0 and overlap >= threshold
    ]
    
    # 5. If we had internal docs but matched only public (shouldn't happen if internal had overlap)
    # We prioritize matched internal docs over public ones
    matched_internal = [c for c in matched if c.get("security_level") != "public"]
    if matched_internal:
        return matched_internal[:3]
    return matched[:3] if matched else (internal[:3] if internal else public[:3])


def _select_used_citations(
    retrieved: list[dict],
    used_chunk_ids: list[str],
    reference_chunk_ids: list[str],
    answer: str,
) -> list[dict]:
    if not retrieved:
        return []

    by_chunk = {str(c.get("chunk_id", "")).strip(): c for c in retrieved}
    ordered_ids: list[str] = []
    seen_ids: set[str] = set()
    for chunk_id in [*used_chunk_ids, *reference_chunk_ids]:
        cid = str(chunk_id).strip()
        if not cid or cid in seen_ids or cid not in by_chunk:
            continue
        seen_ids.add(cid)
        ordered_ids.append(cid)

    if not ordered_ids:
        return _fallback_selected_citations(retrieved, answer)

    selected = [by_chunk[cid] for cid in ordered_ids]
    deduped: list[dict] = []
    seen_chunks: set[str] = set()
    for citation in selected:
        key = _citation_identity_key(citation)
        if key in seen_chunks:
            continue
        seen_chunks.add(key)
        deduped.append(citation)
    return deduped


def _normalize_history_messages(messages: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for message in messages:
        role = str(message.get("role") or "").strip().lower()
        content = _compact_ws(message.get("content"))
        if role not in {"user", "assistant"} or not content:
            continue
        normalized.append({"role": role, "content": content})
    return normalized[-SESSION_CONTEXT_MAX_MESSAGES:]


def _read_session_context(session_id: str | None) -> dict | None:
    sid = _compact_ws(session_id)
    if not sid:
        return None
    try:
        payload = session_cache.get_session_context(sid)
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    messages = _normalize_history_messages(list(payload.get("messages") or []))
    return {
        "sessionId": sid,
        "userId": _compact_ws(payload.get("userId")),
        "messages": messages,
        "lastRoute": _compact_ws(payload.get("lastRoute")) or None,
        "updatedAt": _compact_ws(payload.get("updatedAt")),
    }


def _resolve_chat_history(
    session_id: str | None,
    query: str,
    incoming_messages: list[dict],
) -> list[dict]:
    history = _normalize_history_messages(incoming_messages)
    if not history:
        cached = _read_session_context(session_id)
        history = list((cached or {}).get("messages") or [])

    query_text = _compact_ws(query)
    if query_text:
        if not history or history[-1]["role"] != "user" or history[-1]["content"] != query_text:
            history = [*history, {"role": "user", "content": query_text}]

    return history[-SESSION_CONTEXT_MAX_MESSAGES:]


def _write_session_context(
    session_id: str | None,
    user: dict,
    history: list[dict],
    answer: str,
    route: str,
) -> None:
    sid = _compact_ws(session_id)
    if not sid:
        return
    messages = _normalize_history_messages(
        [*history, {"role": "assistant", "content": _compact_ws(answer)}]
    )
    payload = {
        "sessionId": sid,
        "userId": _compact_ws(user.get("userId")),
        "messages": messages,
        "lastRoute": route,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        session_cache.set_session_context(sid, payload)
    except Exception:
        return


@app.get("/health")
def health():
    return {"status": "ok", "service": "rag-engine"}


@app.post("/v1/retrieve")
async def retrieve(body: RetrieveRequest, request: Request):
    user = _resolved_user(body.user, request)
    refusal = await maybe_refuse_query(body.query, user)
    if refusal:
        return retrieve_refusal_payload(refusal)
    try:
        citations, doc_refusal = await _retrieve_for_rag(
            body.query, user, scope_doc_ids=body.docIds
        )
        if doc_refusal:
            return {
                **retrieve_refusal_payload(doc_refusal),
                "deny_reason": doc_refusal.get("deny_reason"),
                "refusal_type": doc_refusal.get("refusal_type"),
            }
        return {"citations": _client_citations(citations), "route": "rag"}
    except Exception as exc:
        raise HTTPException(503, f"retrieval failed: {exc}") from exc


@app.post("/v1/sql")
async def sql_query(body: ChatRequest, request: Request):
    """Text-to-SQL: NL -> generate -> guardrail -> scope -> execute -> markdown."""
    user = _resolved_user(body.user, request)
    refusal = await maybe_refuse_query(body.query, user)
    if refusal:
        return refusal
    try:
        return await run_sql_query(body.query, user)
    except SqlPipelineError as exc:
        code = 403 if exc.status == "deny" else 502
        raise HTTPException(code, str(exc)) from exc


@app.post("/v1/chat")
async def chat(body: ChatRequest, request: Request):
    """RAG or SQL turn based on lightweight intent router."""
    user = _resolved_user(body.user, request)
    history = _resolve_chat_history(
        body.sessionId,
        body.query,
        [m.model_dump() for m in body.messages],
    )
    refusal = await maybe_refuse_query(body.query, user)
    if refusal:
        _write_session_context(
            body.sessionId,
            user,
            history,
            str(refusal.get("answer") or ""),
            "refusal",
        )
        return refusal
    # A doc-scoped question already has a concrete target, so skip the
    # ambiguity/route detours and go straight to grounded RAG retrieval.
    clarification = None if body.docIds else await check_query_clarity(body.query)
    if clarification:
        _write_session_context(
            body.sessionId,
            user,
            history,
            str(clarification.get("answer") or ""),
            "clarify",
        )
        return clarification
    route = "rag" if body.docIds else classify_route(body.query)
    if route == "sql":
        try:
            result = await run_sql_query(body.query, user)
            if result.get("row_count", 0) > 0:
                _write_session_context(
                    body.sessionId,
                    user,
                    history,
                    str(result.get("answer") or ""),
                    "sql",
                )
                return result
            # row_count = 0 → warehouse không có dữ liệu → fallback sang RAG
        except SqlPipelineError as exc:
            if exc.status == "deny":
                raise HTTPException(403, str(exc)) from exc
            # Lỗi kỹ thuật → fallback sang RAG
    if route == "reject":
        payload = _reject_payload()
        _write_session_context(
            body.sessionId,
            user,
            history,
            str(payload.get("answer") or ""),
            "reject",
        )
        return payload
    if route == "task_assist":
        try:
            answer = await complete_task_assist(history)
        except LlmError as exc:
            raise HTTPException(502, str(exc)) from exc
        _write_session_context(body.sessionId, user, history, answer, "task_assist")
        return {
            "answer": answer,
            "citations": [],
            "route": "task_assist",
        }
    if route == "dml_denied":
        payload = _dml_denied_payload()
        _write_session_context(
            body.sessionId,
            user,
            history,
            str(payload.get("answer") or ""),
            "dml_denied",
        )
        return payload

    try:
        citations, doc_refusal = await _retrieve_for_rag(
            body.query, user, scope_doc_ids=body.docIds
        )
    except Exception as exc:
        raise HTTPException(503, f"retrieval failed: {exc}") from exc
    if doc_refusal:
        _write_session_context(
            body.sessionId,
            user,
            history,
            str(doc_refusal.get("answer") or ""),
            "refusal",
        )
        return doc_refusal
    if not citations:
        _write_session_context(body.sessionId, user, history, _NO_CITATIONS_ANSWER, "rag")
        return {"answer": _NO_CITATIONS_ANSWER, "citations": [], "route": "rag"}
    try:
        answer, used_chunk_ids, reference_chunk_ids = await complete_chat_structured(
            history, citations
        )
    except LlmError as exc:
        raise HTTPException(502, str(exc)) from exc

    selected = _select_used_citations(
        citations, used_chunk_ids, reference_chunk_ids, answer
    )
    # Keep citations even if answer is "no info" – always show retrieved sources
    if citations:
        answer = _maybe_replace_refusal(answer)
    _write_session_context(body.sessionId, user, history, answer, "rag")
    return {
        "answer": answer,
        "citations": _client_citations(selected),
        "route": "rag",
    }


@app.post("/v1/chat/stream")
async def chat_stream(body: ChatRequest, request: Request):
    """Streaming turn: SQL streams markdown answer; RAG streams citations + tokens."""
    user = _resolved_user(body.user, request)
    refusal = await maybe_refuse_query(body.query, user)
    # Doc-scoped questions skip clarify/route detours and go straight to RAG.
    clarification = (
        None if (refusal or body.docIds) else await check_query_clarity(body.query)
    )
    if refusal:
        route = "refusal"
    elif clarification:
        route = "clarify"
    elif body.docIds:
        route = "rag"
    else:
        route = classify_route(body.query)
    history = _resolve_chat_history(
        body.sessionId,
        body.query,
        [m.model_dump() for m in body.messages],
    )

    async def event_source():
        if refusal:
            answer = str(refusal.get("answer") or "")
            _write_session_context(body.sessionId, user, history, answer, "refusal")
            yield _sse("meta", {"citations": [], "route": "refusal"})
            for delta in answer:
                yield _sse("token", {"delta": delta})
            yield _sse("done", {"answer": answer, "route": "refusal"})
            return

        if clarification:
            answer = str(clarification.get("answer") or "")
            _write_session_context(body.sessionId, user, history, answer, "clarify")
            yield _sse("meta", {"citations": [], "route": "clarify"})
            for delta in answer:
                yield _sse("token", {"delta": delta})
            yield _sse("done", {"answer": answer, "route": "clarify"})
            return

        if route == "sql":
            _sql_has_data = False
            try:
                result = await run_sql_query(body.query, user)
                if result.get("row_count", 0) > 0:
                    _sql_has_data = True
                    answer = result.get("answer", "")
                    _write_session_context(body.sessionId, user, history, answer, "sql")
                    yield _sse("meta", {"citations": [], "route": "sql"})
                    for delta in answer:
                        yield _sse("token", {"delta": delta})
                    yield _sse("done", {"answer": answer, "route": "sql"})
                # row_count = 0 → fallback sang RAG
            except SqlPipelineError as exc:
                if exc.status == "deny":
                    yield _sse("error", {"message": str(exc)})
                    return
                # Lỗi kỹ thuật → fallback sang RAG
            if _sql_has_data:
                return

        if route == "reject":
            answer = REJECT_ANSWER
            _write_session_context(body.sessionId, user, history, answer, "reject")
            yield _sse("meta", {"citations": [], "route": "reject"})
            for delta in answer:
                yield _sse("token", {"delta": delta})
            yield _sse("done", {"answer": answer, "route": "reject"})
            return

        if route == "task_assist":
            try:
                answer = await complete_task_assist(history)
            except LlmError as exc:
                yield _sse("error", {"message": str(exc)})
                return
            _write_session_context(
                body.sessionId,
                user,
                history,
                answer,
                "task_assist",
            )
            yield _sse("meta", {"citations": [], "route": "task_assist"})
            for delta in answer:
                yield _sse("token", {"delta": delta})
            yield _sse("done", {"answer": answer, "route": "task_assist"})
            return

        if route == "dml_denied":
            answer = DML_DENIED_ANSWER
            _write_session_context(body.sessionId, user, history, answer, "dml_denied")
            yield _sse("meta", {"citations": [], "route": "dml_denied"})
            for delta in answer:
                yield _sse("token", {"delta": delta})
            yield _sse("done", {"answer": answer, "route": "dml_denied"})
            return

        # --- RAG flow ---
        try:
            citations, doc_refusal = await _retrieve_for_rag(
                body.query, user, scope_doc_ids=body.docIds
            )
        except Exception as exc:
            yield _sse("error", {"message": f"retrieval failed: {exc}"})
            return

        # Send citations immediately (meta event)
        client_citations = _client_citations(citations)
        yield _sse("meta", {"citations": client_citations, "route": "rag"})

        if doc_refusal:
            answer = str(doc_refusal.get("answer") or "")
            _write_session_context(body.sessionId, user, history, answer, "refusal")
            yield _sse(
                "meta",
                {
                    "citations": [],
                    "route": "refusal",
                    "refusal_type": doc_refusal.get("refusal_type"),
                    "deny_reason": doc_refusal.get("deny_reason"),
                },
            )
            for delta in answer:
                yield _sse("token", {"delta": delta})
            yield _sse("done", {"answer": answer, "route": "refusal"})
            return

        if not citations:
            _write_session_context(body.sessionId, user, history, _NO_CITATIONS_ANSWER, "rag")
            yield _sse("meta", {"citations": [], "route": "rag"})
            step = 24
            for i in range(0, len(_NO_CITATIONS_ANSWER), step):
                yield _sse("token", {"delta": _NO_CITATIONS_ANSWER[i : i + step]})
            yield _sse("done", {"answer": _NO_CITATIONS_ANSWER, "route": "rag"})
            return

        # Normal RAG: stream answer from LLM (plain text, no JSON)
        full_answer = ""
        try:
            async for delta in stream_chat(
                history,
                citations,
                require_json=False,
                force_answer_from_context=True,
                force_expand_answer=True,
            ):
                full_answer += delta
                yield _sse("token", {"delta": delta})
        except LlmError as exc:
            yield _sse("error", {"message": str(exc)})
            return

        if not full_answer:
            full_answer = "Không nhận được phản hồi từ LLM."
        # Replace refusal message if needed, but keep citations (already sent in meta)
        if citations:
            full_answer = _maybe_replace_refusal(full_answer)

        _write_session_context(body.sessionId, user, history, full_answer, "rag")
        yield _sse("done", {"answer": full_answer, "route": "rag"})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )

@app.post("/v1/summarize/stream")
async def summarize_stream(body: dict, request: Request):
    """Stream a summary for a single document."""
    # 1. Parse user from body and convert to RetrieveUser if needed
    explicit_user = body.get("user")
    if explicit_user and isinstance(explicit_user, dict):
        explicit_user = RetrieveUser(**explicit_user)
    
    # 2. Resolve user (body takes precedence over headers)
    user = _resolved_user(explicit_user, request)

    document_id = body.get("document_id")
    if not document_id:
        raise HTTPException(400, "document_id is required")

    max_chars_raw = body.get("max_chars")
    if max_chars_raw is not None:
        try:
            max_chars = int(max_chars_raw)
        except (ValueError, TypeError):
            max_chars = SUMMARY_MAX_CHARS
    else:
        max_chars = SUMMARY_MAX_CHARS

    async def event_source():
        disconnected = False

        async def check_disconnect():
            nonlocal disconnected
            if not disconnected:
                disconnected = await request.is_disconnected()
            return disconnected

        try:
            yield _sse("meta", {"document_id": document_id, "route": "summary"})

            # The generator continues even if client disconnects
            async for chunk in stream_document_summary(
                document_id,
                user,
                max_chars,
                check_disconnect=check_disconnect,
            ):
                # Only send tokens if still connected
                if not disconnected:
                    yield _sse("token", {"delta": chunk})
                # else: still consuming chunks to complete generation

            # Only send 'done' if still connected
            if not disconnected:
                yield _sse("done", {"route": "summary"})
        except Exception as exc:
            logger.error(f"Summarization failed: {exc}")
            if not disconnected:
                yield _sse("error", {"message": str(exc)})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────────────────────────────────────────────────────────────────────────
# Quizzes endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/v1/quizzes")
async def generate_quizzes_endpoint(body: dict, request: Request):
    """Generate quizzes for a document (non‑streaming). Returns JSON."""
    explicit_user = body.get("user")
    if explicit_user and isinstance(explicit_user, dict):
        explicit_user = RetrieveUser(**explicit_user)
    user = _resolved_user(explicit_user, request)

    document_id = body.get("document_id")
    if not document_id:
        raise HTTPException(400, "document_id is required")

    quiz_type = body.get("type", "multiple_choice")
    count = body.get("count", 5)
    difficulty = body.get("difficulty", "medium")
    force_refresh = body.get("force_refresh", False)

    # Validate
    if quiz_type not in ("multiple_choice", "short_answer", "true_false"):
        raise HTTPException(400, "Invalid quiz type")
    if count not in (3, 5, 10):
        raise HTTPException(400, "Count must be 3, 5, or 10")
    if difficulty not in ("easy", "medium", "hard"):
        raise HTTPException(400, "Difficulty must be easy/medium/hard")

    max_chars = body.get("max_chars") or QUIZ_MAX_CHARS
    try:
        max_chars = int(max_chars)
    except (ValueError, TypeError):
        max_chars = QUIZ_MAX_CHARS

    # Permission check (handled inside quizzes.py)
    try:
        check_document_permission(document_id, user)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(404, str(e))

    try:
        quizzes = await generate_quizzes(
            document_id,
            user,
            quiz_type,
            count,
            difficulty,
            max_chars,
            force_refresh,
        )
        return {"quizzes": quizzes}
    except ValueError as e:
        raise HTTPException(500, f"Generation failed: {str(e)}")
    except RuntimeError as e:
        raise HTTPException(503, f"Service unavailable: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in quiz generation: {e}")
        raise HTTPException(500, "Internal server error")

@app.get("/v1/quizzes/status")
async def quizzes_status(
    request: Request,
    document_id: str,
    type: str = "multiple_choice",
    count: int = 5,
    difficulty: str = "medium",
):
    """Check the status of an quiz generation job."""
    user = _resolved_user(None, request)
    try:
        check_document_permission(document_id, user)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(404, str(e))

    return get_quiz_status(document_id, type, count, difficulty)

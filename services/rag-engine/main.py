import json
import re
import unicodedata
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.generate import LlmError, complete_chat_structured
from app.retrieval import retrieve_citations
from app.router import classify_route
from app.safe_refusal import maybe_refuse_query, retrieve_refusal_payload
from app.sql_pipeline import SqlPipelineError, run_sql_query


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(title="RAG Engine", version="0.3.0", lifespan=lifespan)


class RetrieveUser(BaseModel):
    userId: str
    username: str = ""
    roles: list[str] = []
    department: str | None = None
    maxSecurityLevel: int = 1
    scopeMaHv: str | None = None
    scopeMaGv: str | None = None


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1)
    user: RetrieveUser | None = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    messages: list[ChatMessage] = []
    user: RetrieveUser | None = None


def _gateway_roles(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [role.strip() for role in raw.split(",") if role.strip()]


def _gateway_user(request: Request) -> RetrieveUser | None:
    user_id = request.headers.get("x-gateway-user-id")
    if not user_id:
        return None

    scope_payload: dict[str, object] = {}
    raw_scope = request.headers.get("x-gateway-access-scope")
    if raw_scope:
        try:
            parsed = json.loads(raw_scope)
            if isinstance(parsed, dict):
                scope_payload = parsed
        except json.JSONDecodeError:
            scope_payload = {}

    username = request.headers.get("x-gateway-username", "")
    roles = _gateway_roles(request.headers.get("x-gateway-roles"))
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


def _is_no_info_answer(answer: str) -> bool:
    text = answer.strip().lower()
    return (
        "không tìm thấy thông tin" in text
        or "khong tim thay thong tin" in text
        or "không có thông tin" in text
    )


def _fold_text(text: str) -> str:
    lowered = text.lower()
    normalized = unicodedata.normalize("NFD", lowered)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _keyword_tokens(text: str) -> set[str]:
    folded = _fold_text(text)
    return {token for token in _TOKEN_RE.findall(folded) if token not in _STOPWORDS}


def _fallback_selected_citations(retrieved: list[dict], answer: str) -> list[dict]:
    if not retrieved:
        return []

    answer_tokens = _keyword_tokens(answer)
    if not answer_tokens:
        return retrieved[:3]

    ranked: list[tuple[int, int, dict]] = []
    for index, citation in enumerate(retrieved):
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
        return retrieved[:3]

    threshold = best_overlap if best_overlap < 2 else best_overlap - 1
    matched = [
        citation for overlap, _, citation in ranked if overlap > 0 and overlap >= threshold
    ]
    if matched:
        return matched[:3]
    return retrieved[:3]


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
        citations = await retrieve_citations(body.query, user)
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
    refusal = await maybe_refuse_query(body.query, user)
    if refusal:
        return refusal
    route = classify_route(body.query)
    if route == "sql":
        try:
            return await run_sql_query(body.query, user)
        except SqlPipelineError as exc:
            raise HTTPException(
                403 if exc.status == "deny" else 502,
                str(exc),
            ) from exc

    history = [m.model_dump() for m in body.messages]
    try:
        citations = await retrieve_citations(body.query, user)
    except Exception as exc:
        raise HTTPException(503, f"retrieval failed: {exc}") from exc
    try:
        answer, used_chunk_ids, reference_chunk_ids = await complete_chat_structured(
            history, citations
        )
    except LlmError as exc:
        raise HTTPException(502, str(exc)) from exc

    selected = _select_used_citations(
        citations, used_chunk_ids, reference_chunk_ids, answer
    )
    if _is_no_info_answer(answer):
        selected = []
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
    route = "refusal" if refusal else classify_route(body.query)

    async def event_source():
        if refusal:
            answer = str(refusal.get("answer") or "")
            yield _sse("meta", {"citations": [], "route": "refusal"})
            step = 24
            for i in range(0, len(answer), step):
                yield _sse("token", {"delta": answer[i : i + step]})
            yield _sse("done", {"answer": answer, "route": "refusal"})
            return

        if route == "sql":
            try:
                result = await run_sql_query(body.query, user)
            except SqlPipelineError as exc:
                yield _sse("error", {"message": str(exc)})
                return
            answer = result.get("answer", "")
            yield _sse("meta", {"citations": [], "route": "sql"})
            step = 24
            for i in range(0, len(answer), step):
                yield _sse("token", {"delta": answer[i : i + step]})
            yield _sse("done", {"answer": answer, "route": "sql"})
            return

        history = [m.model_dump() for m in body.messages]
        try:
            citations = await retrieve_citations(body.query, user)
        except Exception as exc:
            yield _sse("error", {"message": f"retrieval failed: {exc}"})
            return

        try:
            answer, used_chunk_ids, reference_chunk_ids = await complete_chat_structured(
                history, citations
            )
        except LlmError as exc:
            yield _sse("error", {"message": str(exc)})
            return

        if not answer:
            yield _sse("error", {"message": "LLM trả về rỗng."})
            return
        selected = _select_used_citations(
            citations, used_chunk_ids, reference_chunk_ids, answer
        )
        if _is_no_info_answer(answer):
            selected = []
        yield _sse("meta", {"citations": _client_citations(selected), "route": "rag"})

        # Keep SSE contract by emitting small deltas while preserving formatting.
        step = 24
        for i in range(0, len(answer), step):
            yield _sse("token", {"delta": answer[i : i + step]})

        yield _sse("done", {"answer": answer, "route": "rag"})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )

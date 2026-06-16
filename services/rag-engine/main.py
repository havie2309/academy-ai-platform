import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.generate import LlmError, complete_chat_structured
from app.retrieval import retrieve_citations


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(title="RAG Engine", version="0.3.0", lifespan=lifespan)


class RetrieveUser(BaseModel):
    userId: str
    roles: list[str] = []
    department: str | None = None
    maxSecurityLevel: int = 1


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1)
    user: RetrieveUser


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    messages: list[ChatMessage] = []
    user: RetrieveUser


def _client_citations(citations: list[dict]) -> list[dict]:
    """Strip the full chunk `text` (LLM-only) before returning to the caller."""
    cleaned = [{k: v for k, v in c.items() if k != "text"} for c in citations]
    deduped: list[dict] = []
    seen: set[str] = set()
    for c in cleaned:
        doc_id = str(c.get("doc_id", "")).strip().lower()
        title = str(c.get("title", "")).strip().lower()
        source = str(c.get("source", "")).strip().lower()
        key = doc_id if doc_id else f"{title}|{source}"
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


def _select_used_citations(
    retrieved: list[dict], used_chunk_ids: list[str]
) -> list[dict]:
    if not retrieved:
        return []
    by_chunk = {str(c.get("chunk_id", "")).strip(): c for c in retrieved}
    valid_ids = [cid for cid in used_chunk_ids if cid in by_chunk]
    if not valid_ids:
        # Fallback to already-filtered heuristic citations.
        return retrieved
    selected = [by_chunk[cid] for cid in valid_ids]
    # Dedup source by doc_id/title+source while preserving order.
    deduped: list[dict] = []
    seen: set[str] = set()
    for c in selected:
        doc_id = str(c.get("doc_id", "")).strip().lower()
        title = str(c.get("title", "")).strip().lower()
        source = str(c.get("source", "")).strip().lower()
        key = doc_id if doc_id else f"{title}|{source}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)
    return deduped


@app.get("/health")
def health():
    return {"status": "ok", "service": "rag-engine"}


@app.post("/v1/retrieve")
async def retrieve(body: RetrieveRequest):
    try:
        citations = await retrieve_citations(body.query, body.user.model_dump())
        return {"citations": _client_citations(citations), "route": "rag"}
    except Exception as exc:
        raise HTTPException(503, f"retrieval failed: {exc}") from exc


@app.post("/v1/chat")
async def chat(body: ChatRequest):
    """Full RAG turn: retrieve -> grounded prompt -> LLM -> answer + citations."""
    user = body.user.model_dump()
    history = [m.model_dump() for m in body.messages]
    try:
        citations = await retrieve_citations(body.query, user)
    except Exception as exc:
        raise HTTPException(503, f"retrieval failed: {exc}") from exc
    try:
        answer, used_chunk_ids = await complete_chat_structured(history, citations)
    except LlmError as exc:
        raise HTTPException(502, str(exc)) from exc

    selected = _select_used_citations(citations, used_chunk_ids)
    if _is_no_info_answer(answer):
        selected = []
    return {
        "answer": answer,
        "citations": _client_citations(selected),
        "route": "rag",
    }


@app.post("/v1/chat/stream")
async def chat_stream(body: ChatRequest):
    """Streaming RAG turn over SSE: meta (selected citations) -> token deltas -> done."""
    user = body.user.model_dump()
    history = [m.model_dump() for m in body.messages]

    async def event_source():
        try:
            citations = await retrieve_citations(body.query, user)
        except Exception as exc:
            yield _sse("error", {"message": f"retrieval failed: {exc}"})
            return

        try:
            answer, used_chunk_ids = await complete_chat_structured(history, citations)
        except LlmError as exc:
            yield _sse("error", {"message": str(exc)})
            return

        if not answer:
            yield _sse("error", {"message": "LLM trả về rỗng."})
            return
        selected = _select_used_citations(citations, used_chunk_ids)
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

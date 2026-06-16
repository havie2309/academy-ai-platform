import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.generate import LlmError, complete_chat, stream_chat
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
    return [{k: v for k, v in c.items() if k != "text"} for c in citations]


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


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
        answer = await complete_chat(history, citations)
    except LlmError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {
        "answer": answer,
        "citations": _client_citations(citations),
        "route": "rag",
    }


@app.post("/v1/chat/stream")
async def chat_stream(body: ChatRequest):
    """Streaming RAG turn over SSE: meta (citations) -> token deltas -> done."""
    user = body.user.model_dump()
    history = [m.model_dump() for m in body.messages]

    async def event_source():
        try:
            citations = await retrieve_citations(body.query, user)
        except Exception as exc:
            yield _sse("error", {"message": f"retrieval failed: {exc}"})
            return

        yield _sse("meta", {"citations": _client_citations(citations), "route": "rag"})

        parts: list[str] = []
        try:
            async for delta in stream_chat(history, citations):
                parts.append(delta)
                yield _sse("token", {"delta": delta})
        except LlmError as exc:
            yield _sse("error", {"message": str(exc)})
            return

        answer = "".join(parts).strip()
        if not answer:
            yield _sse("error", {"message": "LLM trả về rỗng."})
            return
        yield _sse("done", {"answer": answer, "route": "rag"})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )

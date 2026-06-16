import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Cross-encoder reranker. Override via RERANK_MODEL for production (e.g. BAAI/bge-reranker-v2-m3).
MODEL_NAME = os.getenv(
    "RERANK_MODEL",
    "Xenova/ms-marco-MiniLM-L-6-v2",
)

_encoder = None


def get_encoder():
    global _encoder
    if _encoder is None:
        from fastembed.rerank.cross_encoder import TextCrossEncoder

        _encoder = TextCrossEncoder(model_name=MODEL_NAME)
    return _encoder


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_encoder()
    yield


app = FastAPI(title="Rerank Server", version="0.1.0", lifespan=lifespan)


class RerankRequest(BaseModel):
    query: str = Field(..., min_length=1)
    documents: list[str] = Field(..., min_length=1)


@app.get("/health")
def health():
    return {"status": "ok", "service": "rerank-server", "model": MODEL_NAME}


@app.post("/v1/rerank")
def rerank(body: RerankRequest):
    docs = [d.strip() for d in body.documents if d and d.strip()]
    if not docs:
        raise HTTPException(400, "documents must not be empty")
    if len(docs) > 64:
        raise HTTPException(400, "max 64 documents per request")

    try:
        encoder = get_encoder()
        scores = list(encoder.rerank(body.query, docs))
    except Exception as exc:
        raise HTTPException(503, f"rerank failed: {exc}") from exc

    if len(scores) != len(docs):
        raise HTTPException(503, "rerank returned unexpected score count")

    results = [
        {"index": i, "score": float(score)}
        for i, score in enumerate(scores)
    ]
    results.sort(key=lambda r: r["score"], reverse=True)

    return {"model": MODEL_NAME, "results": results}

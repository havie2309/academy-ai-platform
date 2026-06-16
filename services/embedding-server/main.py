import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "384"))

_embedder = None


def get_embedder():
    global _embedder
    if _embedder is None:
        from fastembed import TextEmbedding

        _embedder = TextEmbedding(model_name=MODEL_NAME)
    return _embedder


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_embedder()
    yield


app = FastAPI(title="Embedding Server", version="0.2.0", lifespan=lifespan)


class EmbeddingsRequest(BaseModel):
    input: str | list[str] = Field(..., description="Text or list of texts")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "embedding-server",
        "model": MODEL_NAME,
        "dimensions": EMBEDDING_DIM,
    }


@app.post("/v1/embeddings")
def create_embeddings(body: EmbeddingsRequest):
    texts = [body.input] if isinstance(body.input, str) else body.input
    if not texts:
        raise HTTPException(400, "input must not be empty")
    if len(texts) > 64:
        raise HTTPException(400, "max 64 texts per request")

    try:
        embedder = get_embedder()
        vectors = list(embedder.embed(texts))
    except Exception as exc:
        raise HTTPException(503, f"embedding failed: {exc}") from exc

    data: list[dict[str, Any]] = []
    for i, vec in enumerate(vectors):
        embedding = vec.tolist() if hasattr(vec, "tolist") else list(vec)
        data.append({"object": "embedding", "index": i, "embedding": embedding})

    return {
        "object": "list",
        "model": MODEL_NAME,
        "data": data,
        "usage": {"prompt_tokens": sum(len(t.split()) for t in texts), "total_tokens": 0},
    }

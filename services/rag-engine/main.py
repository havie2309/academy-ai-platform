from fastapi import FastAPI

app = FastAPI(title="RAG Engine", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok", "service": "rag-engine"}
    
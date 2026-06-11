from fastapi import FastAPI

app = FastAPI(title="Embedding Server", version="0.1.0")    

@app.get("/health")
def health():
    return {"status": "ok", "service": "embedding-server"}
    
from fastapi import FastAPI

app = FastAPI(title="Document Processor", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok", "service": "document-processor"}
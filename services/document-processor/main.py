import logging
import os
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from app.config import INGEST_ALLOW_DIRECT_FALLBACK, INGEST_TRANSPORT
from app.consumer import enqueue_job, run_consumer_in_background
from app.pipeline import process_document

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ENABLE_CONSUMER = os.getenv("ENABLE_RABBITMQ_CONSUMER", "true").lower() == "true"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if ENABLE_CONSUMER:
        try:
            run_consumer_in_background()
            logger.info("RabbitMQ consumer started")
        except Exception:
            logger.exception("RabbitMQ consumer failed to start — use POST /v1/process")
    yield


app = FastAPI(title="Document Processor", version="0.2.0", lifespan=lifespan)


class ProcessJob(BaseModel):
    documentId: str
    storagePath: str
    title: str = ""
    mimeType: str = ""
    securityLevel: str = "internal"
    scopeType: str = "all"
    accessRoleCodes: list[str] = []
    accessDepartmentCodes: list[str] = []
    accessUserIds: list[str] = []
    uploadedById: str = ""
    retryCount: int = 0


@app.get("/health")
def health():
    return {"status": "ok", "service": "document-processor"}


@app.post("/v1/process")
async def process_endpoint(body: ProcessJob, background_tasks: BackgroundTasks):
    job = body.model_dump()

    if INGEST_TRANSPORT == "rabbitmq":
        try:
            enqueue_job(job)
            return {"accepted": True, "documentId": body.documentId, "transport": "rabbitmq"}
        except Exception as exc:
            logger.exception("enqueue failed documentId=%s", body.documentId)
            if not INGEST_ALLOW_DIRECT_FALLBACK:
                raise HTTPException(503, f"enqueue failed: {exc}") from exc

    async def _run():
        try:
            await process_document(job)
        except Exception:
            logger.exception("process failed documentId=%s", body.documentId)

    background_tasks.add_task(_run)
    return {"accepted": True, "documentId": body.documentId, "transport": "background"}


@app.post("/v1/process/sync")
async def process_sync(body: ProcessJob):
    try:
        return await process_document(body.model_dump())
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc

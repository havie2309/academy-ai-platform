# document-processor/app/sample_consumer.py

import asyncio
import logging
import os
import shutil
from datetime import datetime, timezone

from pymongo import MongoClient

from app.config import MONGO_DB, MONGO_URI, ALLOW_ADVERSARIAL_DOCS
from app.pipeline import process_document

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _mongo():
    return MongoClient(MONGO_URI)


async def consume_sample_jobs(limit: int = 50) -> dict:
    """
    Consume queued sample jobs from processing_jobs collection.

    Args:
        limit: Maximum number of jobs to process in one run

    Returns:
        Summary of processing results
    """
    client = _mongo()
    db = client[MONGO_DB]

    query = {"status": "queued", "isSample": True}

    if not ALLOW_ADVERSARIAL_DOCS:
        query["isAdversarial"] = {"$ne": True}

    # Find queued sample jobs
    jobs = list(db.processing_jobs.find(query).limit(limit))

    if not jobs:
        logger.info("No queued sample jobs found")
        return {"processed": 0, "completed": 0, "failed": 0}

    logger.info(f"Found {len(jobs)} queued sample jobs")

    completed = 0
    failed = 0
    results = []

    for job in jobs:
        doc_id = job.get("documentId")
        storage_path = job.get("storagePath")
        title = job.get("title", doc_id)
        mime_type = job.get("mimeType", "application/pdf")

        logger.info(f"Processing sample: {doc_id}")

        try:
            # Mark as processing
            db.processing_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"status": "processing", "updatedAt": _utcnow()}}
            )

            # Build job for pipeline
            pipeline_job = {
                "documentId": doc_id,
                "storagePath": storage_path,
                "title": title,
                "mimeType": mime_type,
                "securityLevel": job.get("securityLevel", "internal"),
                "scopeType": job.get("scopeType", "all"),
                "accessRoleCodes": job.get("accessRoleCodes", []),
                "accessDepartmentCodes": job.get("accessDepartmentCodes", []),
                "accessUserIds": job.get("accessUserIds", []),
                "uploadedById": job.get("uploadedById", "system"),
            }

            # Process the document
            result = await process_document(pipeline_job)

            # Mark as completed
            db.processing_jobs.update_one(
                {"_id": job["_id"]},
                {
                    "$set": {
                        "status": "completed",
                        "updatedAt": _utcnow(),
                        "chunkCount": result.get("chunkCount", 0),
                    }
                }
            )

            completed += 1
            results.append({"documentId": doc_id, "status": "completed"})
            logger.info(f"Completed: {doc_id}")

        except Exception as e:
            logger.exception(f"Failed: {doc_id}")

            # Mark as failed
            db.processing_jobs.update_one(
                {"_id": job["_id"]},
                {
                    "$set": {
                        "status": "failed",
                        "errorMessage": str(e)[:500],
                        "updatedAt": _utcnow(),
                    }
                }
            )

            # Also update documents collection
            db.documents.update_one(
                {"docId": doc_id},
                {
                    "$set": {
                        "ingestStatus": "failed",
                        "ingestError": str(e)[:500],
                        "ingestUpdatedAt": _utcnow(),
                    }
                }
            )

            failed += 1
            results.append({"documentId": doc_id, "status": "failed", "error": str(e)})

    client.close()

    return {
        "processed": len(jobs),
        "completed": completed,
        "failed": failed,
        "results": results,
    }
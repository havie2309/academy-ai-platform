"""
Background scanner: finds documents stuck in `pending` ingest status
and requeues them automatically.

Triggered on startup and runs every REQUEUE_SCAN_INTERVAL_SEC seconds.
A document is considered stuck when its createdAt is older than
REQUEUE_AFTER_MINUTES and no active processing job exists for it.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

from app.config import MONGO_DB, MONGO_URI

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
REQUEUE_ENABLED = os.getenv("REQUEUE_ENABLED", "true").lower() != "false"
REQUEUE_AFTER_MINUTES = int(os.getenv("REQUEUE_AFTER_MINUTES", "5"))
REQUEUE_SCAN_INTERVAL_SEC = int(os.getenv("REQUEUE_SCAN_INTERVAL_SEC", "120"))
# Give up after this many requeue attempts so bad docs don't loop forever
REQUEUE_MAX_ATTEMPTS = int(os.getenv("REQUEUE_MAX_ATTEMPTS", "3"))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_job(doc: dict) -> dict:
    """Reconstruct a ProcessJob payload from a documents record."""
    doc_id = doc.get("docId") or str(doc["_id"])
    return {
        "documentId": doc_id,
        "storagePath": doc.get("storagePath") or doc.get("stored_path") or "",
        "title": doc.get("title") or doc.get("originalName") or doc_id,
        "mimeType": doc.get("mimeType") or doc.get("mime_type") or "",
        "securityLevel": doc.get("securityLevel") or "internal",
        "scopeType": doc.get("scopeType") or "all",
        "accessRoleCodes": doc.get("accessRoleCodes") or [],
        "accessDepartmentCodes": doc.get("accessDepartmentCodes") or [],
        "accessUserIds": doc.get("accessUserIds") or [],
        "uploadedById": doc.get("uploadedById") or doc.get("uploaded_by_id") or "",
        "documentType": doc.get("documentType") or doc.get("document_type") or "document",
        "domain": doc.get("domain") or "general",
        "ownerUnit": doc.get("ownerUnit") or "",
        "tags": doc.get("tags") or [],
    }


def _enqueue(job: dict) -> str:
    """
    Try RabbitMQ first; fall back to direct HTTP POST to ourselves.
    Returns the transport used: 'rabbitmq' | 'http'.
    """
    try:
        from app.consumer import enqueue_job
        enqueue_job(job)
        return "rabbitmq"
    except Exception as rmq_err:
        logger.warning("RabbitMQ enqueue failed (%s), trying HTTP fallback", rmq_err)

    import urllib.request, json as _json
    payload = _json.dumps(job).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8003/v1/process",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10):
        pass
    return "http"


def scan_and_requeue() -> dict:
    """
    One scan pass. Returns stats dict with found/requeued/skipped/errors counts.
    """
    cutoff = _utcnow() - timedelta(minutes=REQUEUE_AFTER_MINUTES)
    client = MongoClient(MONGO_URI)
    stats = {"found": 0, "requeued": 0, "skipped": 0, "errors": 0}

    try:
        db = client[MONGO_DB]

        stuck_docs = list(db.documents.find({
            "ingestStatus": "pending",
            "createdAt": {"$lt": cutoff},
            "$or": [
                {"ingestRequeueCount": {"$exists": False}},
                {"ingestRequeueCount": {"$lt": REQUEUE_MAX_ATTEMPTS}},
            ],
        }, {
            "docId": 1, "title": 1, "originalName": 1, "storagePath": 1,
            "mimeType": 1, "securityLevel": 1, "scopeType": 1,
            "accessRoleCodes": 1, "accessDepartmentCodes": 1, "accessUserIds": 1,
            "uploadedById": 1, "documentType": 1, "domain": 1, "ownerUnit": 1,
            "tags": 1, "ingestRequeueCount": 1, "createdAt": 1,
        }))

        stats["found"] = len(stuck_docs)

        for doc in stuck_docs:
            doc_id = doc.get("docId") or str(doc["_id"])

            # Skip if a processing job is actively running right now
            active_job = db.processing_jobs.find_one(
                {"documentId": doc_id, "status": "processing"}
            )
            if active_job:
                stats["skipped"] += 1
                continue

            storage_path = doc.get("storagePath") or ""
            if not storage_path:
                logger.warning("doc %s has no storagePath, skipping", doc_id)
                stats["skipped"] += 1
                continue

            attempt = (doc.get("ingestRequeueCount") or 0) + 1

            try:
                job = _build_job(doc)
                transport = _enqueue(job)

                db.documents.update_one(
                    {"docId": doc_id},
                    {"$set": {
                        "ingestRequeueCount": attempt,
                        "ingestRequeuedAt": _utcnow(),
                    }},
                )

                logger.info(
                    "Requeued stuck doc: docId=%s title=%r via=%s attempt=%d/%d",
                    doc_id,
                    doc.get("title") or doc.get("originalName"),
                    transport,
                    attempt,
                    REQUEUE_MAX_ATTEMPTS,
                )
                stats["requeued"] += 1

            except Exception as exc:
                logger.error("Failed to requeue doc %s: %s", doc_id, exc)
                stats["errors"] += 1

    finally:
        client.close()

    if stats["found"] > 0:
        logger.info(
            "Requeue scan done — found=%d requeued=%d skipped=%d errors=%d",
            stats["found"], stats["requeued"], stats["skipped"], stats["errors"],
        )
    return stats


def _loop() -> None:
    logger.info(
        "Requeue scanner running — interval=%ds, threshold=%dmin, max_attempts=%d",
        REQUEUE_SCAN_INTERVAL_SEC,
        REQUEUE_AFTER_MINUTES,
        REQUEUE_MAX_ATTEMPTS,
    )
    # First scan after a short warm-up so the consumer has time to connect
    time.sleep(30)
    while True:
        try:
            scan_and_requeue()
        except Exception:
            logger.exception("Requeue scan crashed unexpectedly")
        time.sleep(REQUEUE_SCAN_INTERVAL_SEC)


def run_requeue_in_background() -> threading.Thread | None:
    if not REQUEUE_ENABLED:
        logger.info("Requeue scanner disabled (REQUEUE_ENABLED=false)")
        return None
    thread = threading.Thread(target=_loop, daemon=True, name="requeue-scanner")
    thread.start()
    return thread

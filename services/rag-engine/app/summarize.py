"""Document summarization: fetch parent chunks in order and generate a concise summary.
Supports background generation – if the client disconnects, the generation continues
to completion and the result is cached.
"""

import asyncio
import hashlib
from datetime import datetime, timedelta, timezone
from collections.abc import AsyncIterator

from pymongo import MongoClient

from app.config import (
    MONGO_URI,
    MONGO_DB,
    SUMMARY_MAX_CHARS,
    SUMMARY_LLM_PROVIDER,
    SUMMARY_LLM_BASE_URL,
    SUMMARY_LLM_MODEL,
)
from app.generate import stream_chat
from app.access import can_view_chunk
from app.target_resolver import resolve_summary_target

# ──────────────────────────────────────────────────────────────────────────────
# Prompt template
# ──────────────────────────────────────────────────────────────────────────────

PROMPT_TEMPLATE = """Bạn là trợ lý AI của học viện. Hãy tóm tắt tài liệu dưới đây.

Yêu cầu:
- Viết bằng tiếng Việt, rõ ràng, dễ hiểu.
- Chỉ dùng thông tin có trong tài liệu.
- Tóm tắt thành 3-5 ý chính (dạng gạch đầu dòng).
- Tổng độ dài khoảng 150-200 từ.

Nội dung tài liệu:
---
{document_text}
---

Tóm tắt:"""


def _get_prompt_hash() -> str:
    """Hash of the prompt template. Used to invalidate cache when prompt changes."""
    return hashlib.md5(PROMPT_TEMPLATE.encode("utf-8")).hexdigest()


def _get_config_hash() -> str:
    config_str = f"{SUMMARY_LLM_PROVIDER}|{SUMMARY_LLM_BASE_URL}|{SUMMARY_LLM_MODEL}"
    return hashlib.md5(config_str.encode("utf-8")).hexdigest()


def build_summary_prompt(document_text: str) -> str:
    """Build the prompt for the summarization task."""
    return PROMPT_TEMPLATE.format(document_text=document_text)


# ──────────────────────────────────────────────────────────────────────────────
# Data fetching
# ──────────────────────────────────────────────────────────────────────────────

async def fetch_document_parent_chunks(doc_id: str, max_chars: int = 1500) -> str:
    """Fetch parent chunks in sequential order, truncated to max_chars."""
    client = MongoClient(MONGO_URI)
    try:
        db = client[MONGO_DB]
        collection = db["document_chunks"]
        chunks = list(
            collection.find(
                {"documentId": doc_id, "chunkType": "parent"},
                {"chunkText": 1, "chunkIndex": 1, "_id": 0},
            )
            .sort("chunkIndex", 1)
            .limit(50)  # Prevent unbounded queries
        )
    finally:
        client.close()

    if not chunks:
        return ""

    text_parts: list[str] = []
    total_len = 0
    for chunk in chunks:
        text = chunk.get("chunkText", "").strip()
        if not text:
            continue
        if total_len + len(text) > max_chars:
            remaining = max_chars - total_len
            if remaining > 50:  # Only add if we have enough space
                text_parts.append(text[:remaining])
            break
        text_parts.append(text)
        total_len += len(text)

    return "\n\n".join(text_parts)


# ──────────────────────────────────────────────────────────────────────────────
# Lock management (MongoDB as distributed lock)
# ──────────────────────────────────────────────────────────────────────────────

async def _acquire_generation_lock(client: MongoClient, doc_id: str) -> bool:
    """Try to acquire a lock to start generation. Returns True if we own the lock."""
    db = client[MONGO_DB]
    jobs = db["summary_jobs"]
    config_hash = _get_config_hash()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    result = jobs.update_one(
        {
            "documentId": doc_id,
            "status": {"$in": ["running", "pending"]},
            "configHash": config_hash,
        },
        {
            "$setOnInsert": {
                "documentId": doc_id,
                "configHash": config_hash,
                "status": "running",
                "startedAt": datetime.now(timezone.utc),
                "expiresAt": expires_at,
                "error": None,
            }
        },
        upsert=True,
    )
    return result.matched_count == 0  # inserted new → we own the lock


async def _release_generation_lock(
    client: MongoClient, doc_id: str, status: str = "completed", error: str | None = None
) -> None:
    db = client[MONGO_DB]
    jobs = db["summary_jobs"]
    jobs.update_one(
        {"documentId": doc_id},
        {
            "$set": {
                "status": status,
                "updatedAt": datetime.now(timezone.utc),
                "error": error,
                "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=1),
            }
        },
    )


async def _wait_for_generation(client: MongoClient, doc_id: str, timeout: float = 300) -> dict | None:
    """Wait for an existing generation to complete and return the cached summary.
    Polls the job status every 1 second until 'completed' or 'failed'.
    Returns None if timeout or job not found.
    """
    db = client[MONGO_DB]
    jobs = db["summary_jobs"]
    cache = db["document_summaries"]

    start = datetime.now(timezone.utc)
    config_hash = _get_config_hash()
    prompt_hash = _get_prompt_hash()

    while (datetime.now(timezone.utc) - start).total_seconds() < timeout:
        job = jobs.find_one({"documentId": doc_id})
        if not job:
            break
        status = job.get("status")
        if status == "completed":
            cached = cache.find_one({
                "documentId": doc_id,
                "configHash": config_hash,
                "promptHash": prompt_hash,
            })
            return cached
        if status == "failed":
            raise RuntimeError(f"Generation failed: {job.get('error', 'unknown error')}")
        await asyncio.sleep(1)
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Main streaming function
# ──────────────────────────────────────────────────────────────────────────────

async def stream_document_summary(
    doc_id: str,
    user: dict,
    max_chars: int = 1500,
    check_disconnect=None,
) -> AsyncIterator[str]:
    """
    Stream a summary for a document, with background generation.

    If generation is already in progress, this function waits for it to complete
    and then streams the cached result, avoiding duplicate LLM calls.

    Args:
        doc_id: Document ID
        user: User context (for permission check)
        max_chars: Maximum characters to use from the document
        check_disconnect: Optional async function that returns True if client disconnected
    """
    client = MongoClient(MONGO_URI)
    try:
        db = client[MONGO_DB]

        # 1. Permission check
        doc_collection = db["documents"]
        doc = doc_collection.find_one({"docId": doc_id})
        if not doc:
            yield "Không tìm thấy tài liệu."
            return

        # Use can_view_chunk with a minimal chunk metadata stub
        doc_meta = {
            "securityLevel": doc.get("securityLevel", "internal"),
            "scopeType": doc.get("scopeType", "all"),
            "accessRoleCodes": doc.get("accessRoleCodes", []),
            "accessDepartmentCodes": doc.get("accessDepartmentCodes", []),
            "accessUserIds": doc.get("accessUserIds", []),
            "uploadedById": doc.get("uploadedById", ""),
        }
        if not can_view_chunk(doc_meta, user):
            yield "Bạn không có quyền xem tài liệu này."
            return

        # 2. Check cache
        cache_collection = db["document_summaries"]
        config_hash = _get_config_hash()
        prompt_hash = _get_prompt_hash()
        cached = cache_collection.find_one({
            "documentId": doc_id,
            "configHash": config_hash,
            "promptHash": prompt_hash,
        })
        if cached:
            summary_text = cached.get("summary", "")
            if summary_text:
                yield summary_text
                return

        # 3. Check for existing running job
        jobs = db["summary_jobs"]
        existing_job = jobs.find_one({"documentId": doc_id, "configHash": config_hash})
        if existing_job and existing_job.get("status") in ("running", "pending"):
            yield "Đang tạo tóm tắt (đang được xử lý)...\n"
            result = await _wait_for_generation(client, doc_id)
            if result:
                yield result.get("summary", "")
                return
            yield "Tóm tắt không hoàn thành. Vui lòng thử lại."
            return

        # 4. Acquire lock to start new generation
        if not await _acquire_generation_lock(client, doc_id):
            # Someone else started while we were checking
            yield "Đang tạo tóm tắt (đang được xử lý)...\n"
            result = await _wait_for_generation(client, doc_id)
            if result:
                yield result.get("summary", "")
                return
            yield "Tóm tắt không hoàn thành. Vui lòng thử lại."
            return

        # We own the lock – start generation
        try:
            document_text = await fetch_document_parent_chunks(doc_id, max_chars)
            if not document_text:
                yield "Không thể trích xuất nội dung từ tài liệu này."
                await _release_generation_lock(client, doc_id, "failed", "No content")
                return

            prompt = build_summary_prompt(document_text)
            history = [{"role": "user", "content": prompt}]
            target = resolve_summary_target()

            full_summary = ""
            disconnected = False

            # Generate – always accumulate all tokens, even if client disconnects
            async for delta in stream_chat(
                history,
                citations=[],
                require_json=False,
                force_answer_from_context=True,
                force_expand_answer=True,
                target_override=target,
            ):
                full_summary += delta

                # Check disconnect after accumulating
                if check_disconnect and await check_disconnect():
                    disconnected = True

                # Only yield if still connected
                if not disconnected:
                    yield delta

            # After generation complete, save to cache
            if full_summary.strip():
                cache_collection.update_one(
                    {"documentId": doc_id},
                    {
                        "$set": {
                            "summary": full_summary,
                            "configHash": config_hash,
                            "promptHash": prompt_hash,
                            "generatedAt": datetime.now(timezone.utc).isoformat(),
                            "title": doc.get("title", ""),
                            "documentId": doc_id,
                        }
                    },
                    upsert=True,
                )
                await _release_generation_lock(client, doc_id, "completed")
            else:
                await _release_generation_lock(client, doc_id, "failed", "Empty summary")

        except Exception as e:
            await _release_generation_lock(client, doc_id, "failed", str(e))
            raise

    finally:
        client.close()

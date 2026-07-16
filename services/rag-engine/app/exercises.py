"""Document exercise generation: fetch parent chunks and generate exercises (non‑streaming)."""

import asyncio
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

from app.config import (
    MONGO_URI,
    MONGO_DB,
    EXERCISE_MAX_CHARS,
)
from app.generate import stream_chat
from app.access import can_view_chunk
from app.target_resolver import resolve_exercise_target

import logging
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Prompt templates (unchanged)
# ──────────────────────────────────────────────────────────────────────────────

EXERCISE_TEMPLATES = {
    "multiple_choice": """
Bạn là trợ lý AI của học viện. Tạo {count} câu hỏi trắc nghiệm (multiple choice) từ tài liệu dưới đây.

Yêu cầu:
- Dựa hoàn toàn vào nội dung tài liệu.
- Độ khó: {difficulty}.
- Mỗi câu hỏi có 4 lựa chọn (A, B, C, D) và đáp án đúng.
- Trả về **chỉ** một mảng JSON array, không có bất kỳ văn bản nào ngoài mảng đó.
- Trong JSON array, mỗi object có: "question", "options" (array), "answer" (A/B/C/D), "explanation" (ngắn gọn).

Nội dung tài liệu:
---
{document_text}
---

Đầu ra:
[
  {{
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A",
    "explanation": "..."
  }}
]
""",

    "short_answer": """
Bạn là trợ lý AI của học viện. Tạo {count} câu hỏi tự luận (short answer) từ tài liệu dưới đây.

Yêu cầu:
- Dựa hoàn toàn vào nội dung tài liệu.
- Độ khó: {difficulty}.
- Mỗi câu hỏi có đáp án gợi ý ngắn gọn.
- Trả về **chỉ** một mảng JSON array, không có bất kỳ văn bản nào ngoài mảng đó.
- Trong JSON array, mỗi object có: "question", "model_answer".

Nội dung tài liệu:
---
{document_text}
---

Đầu ra:
[
  {{
    "question": "...",
    "model_answer": "..."
  }}
]
""",

    "true_false": """
Bạn là trợ lý AI của học viện. Tạo {count} câu hỏi đúng/sai (True/False) từ tài liệu dưới đây.

Yêu cầu:
- Dựa hoàn toàn vào nội dung tài liệu.
- Độ khó: {difficulty}.
- Mỗi câu có đáp án Đúng/Sai và giải thích ngắn.
- Trả về **chỉ** một mảng JSON array, không có bất kỳ văn bản nào ngoài mảng đó.
- Trong JSON array, mỗi object có: "statement", "answer" (True/False), "explanation".

Nội dung tài liệu:
---
{document_text}
---

Đầu ra:
[
  {{
    "statement": "...",
    "answer": "True",
    "explanation": "..."
  }}
]
"""
}

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_prompt_hash() -> str:
    combined = "".join(sorted(EXERCISE_TEMPLATES.values()))
    return hashlib.md5(combined.encode("utf-8")).hexdigest()

def _get_config_hash() -> str:
    from app.config import EXERCISE_LLM_PROVIDER, EXERCISE_LLM_BASE_URL, EXERCISE_LLM_MODEL
    config_str = f"{EXERCISE_LLM_PROVIDER}|{EXERCISE_LLM_BASE_URL}|{EXERCISE_LLM_MODEL}"
    return hashlib.md5(config_str.encode("utf-8")).hexdigest()

def build_exercise_prompt(document_text: str, exercise_type: str, count: int, difficulty: str) -> str:
    template = EXERCISE_TEMPLATES.get(exercise_type)
    if not template:
        raise ValueError(f"Unknown exercise type: {exercise_type}")
    return template.format(count=count, difficulty=difficulty, document_text=document_text)

def _extract_json_object(text: str) -> dict | list | None:
    """Extract a JSON object or array from raw text, handling markdown fences."""
    raw = text.strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, (dict, list)) else None
    except json.JSONDecodeError:
        pass
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, flags=re.I)
    if fence:
        try:
            parsed = json.loads(fence.group(1))
            return parsed if isinstance(parsed, (dict, list)) else None
        except json.JSONDecodeError:
            pass
    start = raw.find('[')
    if start == -1:
        start = raw.find('{')
    if start == -1:
        return None
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(raw)):
        ch = raw[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch in '{[':
            depth += 1
        elif ch in '}]':
            depth -= 1
            if depth == 0:
                candidate = raw[start:i+1]
                try:
                    parsed = json.loads(candidate)
                    return parsed if isinstance(parsed, (dict, list)) else None
                except json.JSONDecodeError:
                    return None
    return None

# ──────────────────────────────────────────────────────────────────────────────
# Data fetching
# ──────────────────────────────────────────────────────────────────────────────

async def fetch_document_parent_chunks(doc_id: str, max_chars: int = 2000) -> str:
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
            .limit(50)
        )
    finally:
        client.close()

    if not chunks:
        return ""

    text_parts = []
    total_len = 0
    for chunk in chunks:
        text = chunk.get("chunkText", "").strip()
        if not text:
            continue
        if total_len + len(text) > max_chars:
            remaining = max_chars - total_len
            if remaining > 50:
                text_parts.append(text[:remaining])
            break
        text_parts.append(text)
        total_len += len(text)

    return "\n\n".join(text_parts)

# ──────────────────────────────────────────────────────────────────────────────
# Lock management
# ──────────────────────────────────────────────────────────────────────────────

async def _acquire_exercise_lock(
    client: MongoClient,
    doc_id: str,
    config_hash: str,
    options_hash: str,
) -> bool:
    db = client[MONGO_DB]
    jobs = db["exercise_jobs"]
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    result = jobs.update_one(
        {
            "documentId": doc_id,
            "configHash": config_hash,
            "optionsHash": options_hash,
            "status": {"$in": ["running", "pending"]},
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
    return result.matched_count == 0

async def _release_exercise_lock(client: MongoClient, doc_id: str, status: str = "completed", error: str | None = None) -> None:
    db = client[MONGO_DB]
    jobs = db["exercise_jobs"]
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

async def _wait_for_exercise_generation(
    client: MongoClient, doc_id: str, config_hash: str, options_hash: str, timeout: float = 300
) -> dict | None:
    db = client[MONGO_DB]
    jobs = db["exercise_jobs"]
    cache = db["document_exercises"]
    start = datetime.now(timezone.utc)
    while (datetime.now(timezone.utc) - start).total_seconds() < timeout:
        job = jobs.find_one({"documentId": doc_id, "configHash": config_hash, "optionsHash": options_hash})
        if not job:
            break
        status = job.get("status")
        if status == "completed":
            cached = cache.find_one({
                "documentId": doc_id,
                "configHash": config_hash,
                "optionsHash": options_hash,
            })
            return cached
        if status == "failed":
            raise RuntimeError(f"Exercise generation failed: {job.get('error', 'unknown error')}")
        await asyncio.sleep(1)
    return None

# ──────────────────────────────────────────────────────────────────────────────
# Permission check
# ──────────────────────────────────────────────────────────────────────────────

def check_document_permission(doc_id: str, user: dict) -> None:
    """Raise PermissionError if the user cannot view the document."""
    client = MongoClient(MONGO_URI)
    try:
        db = client[MONGO_DB]
        doc = db["documents"].find_one({"docId": doc_id})
        if not doc:
            raise ValueError("Document not found")
        doc_meta = {
            "securityLevel": doc.get("securityLevel", "internal"),
            "scopeType": doc.get("scopeType", "all"),
            "accessRoleCodes": doc.get("accessRoleCodes", []),
            "accessDepartmentCodes": doc.get("accessDepartmentCodes", []),
            "accessUserIds": doc.get("accessUserIds", []),
            "uploadedById": doc.get("uploadedById", ""),
        }
        if not can_view_chunk(doc_meta, user):
            raise PermissionError("User lacks permission to view this document")
    finally:
        client.close()

# ──────────────────────────────────────────────────────────────────────────────
# Status check
# ──────────────────────────────────────────────────────────────────────────────

def get_exercise_status(document_id: str, exercise_type: str, count: int, difficulty: str) -> dict:
    """
    Return the status of an exercise generation job without starting a new one.
    Returns:
        - {"status": "completed", "exercises": [...]} if cached
        - {"status": "running"} if a job is in progress
        - {"status": "not_found"} otherwise
    """
    client = MongoClient(MONGO_URI)
    try:
        db = client[MONGO_DB]
        config_hash = _get_config_hash()
        prompt_hash = _get_prompt_hash()
        options_hash = hashlib.md5(f"{exercise_type}|{count}|{difficulty}".encode()).hexdigest()

        # Check cache
        cache_collection = db["document_exercises"]
        cached = cache_collection.find_one({
            "documentId": document_id,
            "configHash": config_hash,
            "promptHash": prompt_hash,
            "optionsHash": options_hash,
        })
        if cached:
            exercises_str = cached.get("exercises")
            if exercises_str:
                try:
                    exercises = json.loads(exercises_str)
                    return {"status": "completed", "exercises": exercises}
                except json.JSONDecodeError:
                    pass  # treat cache as invalid and fall through

        # Check running job
        jobs = db["exercise_jobs"]
        job = jobs.find_one({
            "documentId": document_id,
            "configHash": config_hash,
            "optionsHash": options_hash,
            "status": {"$in": ["running", "pending"]}
        })
        if job:
            return {"status": "running"}

        return {"status": "not_found"}
    finally:
        client.close()

# ──────────────────────────────────────────────────────────────────────────────
# Main generation function (non‑streaming)
# ──────────────────────────────────────────────────────────────────────────────

async def generate_exercises(
    doc_id: str,
    user: dict,
    exercise_type: str,
    count: int,
    difficulty: str,
    max_chars: int = 2000,
    force_refresh: bool = False,
) -> list:
    """
    Generate exercises for a document and return the parsed list.
    This is the main entry point for the feature.
    """
    client = MongoClient(MONGO_URI)
    try:
        db = client[MONGO_DB]

        # 1. Build cache key
        config_hash = _get_config_hash()
        prompt_hash = _get_prompt_hash()
        options_hash = hashlib.md5(f"{exercise_type}|{count}|{difficulty}".encode()).hexdigest()
        cache_key = {
            "documentId": doc_id,
            "configHash": config_hash,
            "promptHash": prompt_hash,
            "optionsHash": options_hash,
        }

        # 2. Check cache (skip if force_refresh)
        cache_collection = db["document_exercises"]
        if not force_refresh:
            cached = cache_collection.find_one(cache_key)
            if cached:
                exercises_str = cached.get("exercises")
                if exercises_str:
                    try:
                        return json.loads(exercises_str)
                    except json.JSONDecodeError:
                        # If cache is corrupted, treat as miss
                        pass

        # 3. Check for existing running job
        jobs = db["exercise_jobs"]
        existing_job = jobs.find_one({
            "documentId": doc_id,
            "configHash": config_hash,
            "optionsHash": options_hash,
            "status": {"$in": ["running", "pending"]},
        })
        if existing_job:
            result = await _wait_for_exercise_generation(client, doc_id, config_hash, options_hash)
            if result:
                exercises_str = result.get("exercises")
                if exercises_str:
                    return json.loads(exercises_str)
            raise RuntimeError("Existing job failed to complete")

        # 4. Acquire lock
        if not await _acquire_exercise_lock(client, doc_id, config_hash, options_hash):
            result = await _wait_for_exercise_generation(client, doc_id, config_hash, options_hash)
            if result:
                exercises_str = result.get("exercises")
                if exercises_str:
                    return json.loads(exercises_str)
            raise RuntimeError("Concurrent job failed to complete")

        # 5. We own the lock – start generation
        try:
            doc = db["documents"].find_one({"docId": doc_id})
            if not doc:
                raise ValueError("Document not found")
            title = doc.get("title", "Tài liệu")

            document_text = await fetch_document_parent_chunks(doc_id, max_chars)
            if not document_text:
                raise ValueError("No content extracted from document")

            prompt = build_exercise_prompt(document_text, exercise_type, count, difficulty)
            history = [{"role": "user", "content": prompt}]
            target = resolve_exercise_target()

            full_response = ""
            async for delta in stream_chat(
                history,
                citations=[],
                require_json=False,
                force_answer_from_context=True,
                force_expand_answer=True,
                target_override=target,
            ):
                full_response += delta

            # Parse and cache
            parsed = _extract_json_object(full_response)
            if not parsed or not isinstance(parsed, list):
                logger.error(f"Failed to parse exercise JSON. Raw response: {full_response[:500]}")
                raise ValueError("Generated output is not a valid JSON array")

            exercises_str = json.dumps(parsed, ensure_ascii=False)
            cache_collection.update_one(
                cache_key,
                {
                    "$set": {
                        "exercises": exercises_str,
                        "configHash": config_hash,
                        "promptHash": prompt_hash,
                        "optionsHash": options_hash,
                        "generatedAt": datetime.now(timezone.utc).isoformat(),
                        "title": title,
                        "documentId": doc_id,
                    }
                },
                upsert=True,
            )
            await _release_exercise_lock(client, doc_id, "completed")
            return parsed

        except Exception as e:
            await _release_exercise_lock(client, doc_id, "failed", str(e))
            raise

    finally:
        client.close()

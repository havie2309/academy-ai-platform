from __future__ import annotations

import asyncio
import time
import unicodedata

import asyncpg
import httpx

from app.config import (
    ADMIN_CONFIG_CACHE_TTL_SECONDS,
    ADMIN_CONFIG_INTERNAL_KEY,
    ADMIN_CONFIG_URL,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)

DEFAULT_SAFE_REFUSAL = (
    "Xin loi, toi khong the tra loi cau hoi nay theo chinh sach an toan hien tai."
)
DEFAULT_BLACKLIST = [
    "de thi mat",
    "dap an de thi",
    "mat khau he thong",
    "bypass quyen",
    "vuot quyen truy cap",
]
RAG_POLICY_KEY = "rag_policy"

_POLICY_LOCK = asyncio.Lock()
_POLICY_CACHE: dict[str, object] = {
    "value": {
        "enabled": True,
        "blacklistKeywords": DEFAULT_BLACKLIST[:],
        "safeRefusalMessage": DEFAULT_SAFE_REFUSAL,
    },
    "expires_at": 0.0,
}


def _fold_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def normalize_keywords(values: list[str] | None) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for value in values or []:
        item = str(value).strip()
        if not item:
            continue
        key = _fold_text(item)
        if not key or key in seen:
            continue
        seen.add(key)
        normalized.append(item)
    return normalized


def match_blacklist(query: str, keywords: list[str] | None) -> str | None:
    folded_query = _fold_text(query)
    for keyword in normalize_keywords(keywords):
        if _fold_text(keyword) in folded_query:
            return keyword
    return None


def _policy_from_payload(payload: dict) -> dict:
    value = payload.get("value") if isinstance(payload, dict) else None
    source = value if isinstance(value, dict) else payload
    safe_refusal = str(source.get("safeRefusalMessage") or "").strip()
    return {
        "enabled": bool(source.get("enabled", True)),
        "blacklistKeywords": normalize_keywords(
            source.get("blacklistKeywords") or DEFAULT_BLACKLIST
        ),
        "safeRefusalMessage": safe_refusal or DEFAULT_SAFE_REFUSAL,
    }


async def _fetch_remote_policy() -> dict:
    if not ADMIN_CONFIG_URL or not ADMIN_CONFIG_INTERNAL_KEY:
        return _policy_from_payload({})

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(
            f"{ADMIN_CONFIG_URL.rstrip('/')}/api/admin-config/internal/rag-policy",
            headers={"x-admin-config-key": ADMIN_CONFIG_INTERNAL_KEY},
        )
        response.raise_for_status()
        return _policy_from_payload(response.json())


async def get_rag_policy(force_refresh: bool = False) -> dict:
    now = time.monotonic()
    expires_at = float(_POLICY_CACHE.get("expires_at") or 0.0)
    cached = dict(_POLICY_CACHE.get("value") or {})
    if cached and not force_refresh and now < expires_at:
        return cached

    async with _POLICY_LOCK:
        now = time.monotonic()
        expires_at = float(_POLICY_CACHE.get("expires_at") or 0.0)
        cached = dict(_POLICY_CACHE.get("value") or {})
        if cached and not force_refresh and now < expires_at:
            return cached

        try:
            policy = await _fetch_remote_policy()
        except Exception:
            _POLICY_CACHE["expires_at"] = now + min(
                max(ADMIN_CONFIG_CACHE_TTL_SECONDS, 5), 15
            )
            return cached or _policy_from_payload({})

        _POLICY_CACHE["value"] = policy
        _POLICY_CACHE["expires_at"] = now + max(ADMIN_CONFIG_CACHE_TTL_SECONDS, 5)
        return dict(policy)


async def log_policy_event(
    *,
    user: dict | None,
    question: str,
    matched_keyword: str,
    status: str = "blocked",
) -> None:
    conn = None
    try:
        conn = await asyncpg.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            database=POSTGRES_DB,
        )
        await conn.execute(
            """
            INSERT INTO policy_events (
              policy_key, matched_keyword, user_id, question, status
            ) VALUES ($1, $2, $3, $4, $5)
            """,
            RAG_POLICY_KEY,
            matched_keyword,
            (user or {}).get("userId"),
            question,
            status,
        )
    except Exception:
        return
    finally:
        if conn is not None:
            await conn.close()


async def maybe_refuse_query(query: str, user: dict | None = None) -> dict | None:
    policy = await get_rag_policy()
    if not policy.get("enabled", True):
        return None

    matched_keyword = match_blacklist(query, policy.get("blacklistKeywords"))
    if not matched_keyword:
        return None

    await log_policy_event(
        user=user,
        question=query,
        matched_keyword=matched_keyword,
        status="blocked",
    )
    return {
        "answer": str(policy.get("safeRefusalMessage") or DEFAULT_SAFE_REFUSAL),
        "citations": [],
        "route": "refusal",
        "blocked_keyword": matched_keyword,
    }


def retrieve_refusal_payload(refusal: dict) -> dict:
    return {
        "citations": [],
        "route": "refusal",
        "message": refusal.get("answer") or DEFAULT_SAFE_REFUSAL,
        "blocked_keyword": refusal.get("blocked_keyword"),
    }

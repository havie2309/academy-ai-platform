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
DEFAULT_GUARDRAIL_RULE = {
    "id": "default-keyword-blocklist",
    "label": "Danh sach tu khoa bi chan",
    "enabled": True,
    "phrases": DEFAULT_BLACKLIST[:],
}

_POLICY_LOCK = asyncio.Lock()
_POLICY_CACHE: dict[str, object] = {
    "value": {
        "enabled": True,
        "guardrailRules": [DEFAULT_GUARDRAIL_RULE.copy()],
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


def normalize_guardrail_rules(rules: list[dict] | None) -> list[dict]:
    normalized: list[dict] = []
    seen: set[str] = set()
    for index, rule in enumerate(rules or []):
        if not isinstance(rule, dict):
            continue
        phrases = normalize_keywords(rule.get("phrases"))
        if not phrases:
            continue
        rule_id = str(rule.get("id") or f"rule-{index + 1}").strip()
        if not rule_id or rule_id in seen:
            continue
        seen.add(rule_id)
        normalized.append(
            {
                "id": rule_id,
                "label": str(rule.get("label") or f"Rule {index + 1}").strip(),
                "enabled": bool(rule.get("enabled", True)),
                "phrases": phrases,
            }
        )
    return normalized or [DEFAULT_GUARDRAIL_RULE.copy()]


def match_blacklist(query: str, keywords: list[str] | None) -> str | None:
    folded_query = _fold_text(query)
    for keyword in normalize_keywords(keywords):
        if _fold_text(keyword) in folded_query:
            return keyword
    return None


def match_guardrail_rules(query: str, rules: list[dict] | None) -> tuple[str, str] | None:
    folded_query = _fold_text(query)
    for rule in normalize_guardrail_rules(rules):
        if not rule.get("enabled", True):
            continue
        for phrase in normalize_keywords(rule.get("phrases")):
            if _fold_text(phrase) in folded_query:
                return str(rule.get("id") or ""), phrase
    return None


def _policy_from_payload(payload: dict) -> dict:
    value = payload.get("value") if isinstance(payload, dict) else None
    source = value if isinstance(value, dict) else payload
    safe_refusal = str(source.get("safeRefusalMessage") or "").strip()
    guardrail_rules = source.get("guardrailRules")
    blacklist_keywords = source.get("blacklistKeywords") or DEFAULT_BLACKLIST
    return {
        "enabled": bool(source.get("enabled", True)),
        "guardrailRules": normalize_guardrail_rules(
            guardrail_rules
            if isinstance(guardrail_rules, list)
            else [
                {
                    "id": DEFAULT_GUARDRAIL_RULE["id"],
                    "label": DEFAULT_GUARDRAIL_RULE["label"],
                    "enabled": True,
                    "phrases": blacklist_keywords,
                }
            ]
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
    matched_rule_id: str,
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
              policy_key, matched_keyword, user_id, question, status, reason
            ) VALUES ($1, $2, $3, $4, $5, $6)
            """,
            RAG_POLICY_KEY,
            matched_keyword,
            (user or {}).get("userId"),
            question,
            status,
            matched_rule_id,
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

    matched = match_guardrail_rules(query, policy.get("guardrailRules"))
    if not matched:
        return None
    matched_rule_id, matched_keyword = matched

    await log_policy_event(
        user=user,
        question=query,
        matched_rule_id=matched_rule_id,
        matched_keyword=matched_keyword,
        status="blocked",
    )
    return {
        "answer": str(policy.get("safeRefusalMessage") or DEFAULT_SAFE_REFUSAL),
        "citations": [],
        "route": "refusal",
        "blocked_keyword": matched_keyword,
        "blocked_rule_id": matched_rule_id,
    }


def retrieve_refusal_payload(refusal: dict) -> dict:
    return {
        "citations": [],
        "route": "refusal",
        "message": refusal.get("answer") or DEFAULT_SAFE_REFUSAL,
        "blocked_keyword": refusal.get("blocked_keyword"),
        "blocked_rule_id": refusal.get("blocked_rule_id"),
    }

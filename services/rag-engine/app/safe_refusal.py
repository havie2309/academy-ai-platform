from __future__ import annotations

import json
import time
import unicodedata
from datetime import datetime

import asyncpg
import httpx

from app.config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.generate import _llm_target
from app.guardrails.normalize import normalize_guardrail_rules, normalize_keywords
from app.guardrails.pipeline import evaluate_guardrails
from app.guardrails.policy_store import get_rag_policy
from app.guardrails.rule_match import match_blacklist, match_guardrail_rules
from app.guardrails.types import (
    DEFAULT_BLACKLIST,
    DEFAULT_SAFE_REFUSAL,
    RAG_POLICY_KEY,
)

__all__ = [
    "DEFAULT_BLACKLIST",
    "DEFAULT_SAFE_REFUSAL",
    "RAG_POLICY_KEY",
    "get_rag_policy",
    "llm_safety_classify",
    "log_policy_event",
    "match_blacklist",
    "match_guardrail_rules",
    "maybe_refuse_query",
    "normalize_guardrail_rules",
    "normalize_keywords",
    "retrieve_refusal_payload",
]

_BORDERLINE_HINTS = (
    "dap an",
    "đáp án",
    "de thi",
    "đề thi",
    "noi dung bai thi",
    "nội dung bài thi",
    "bai kiem tra",
    "bài kiểm tra",
)

DEFAULT_POLICY_RULES = """
Ban la bo loc an toan cua he thong hoc vien. Phan loai cau hoi la ALLOW hoac BLOCK.
Nam hoc hien tai: {current_year}

Quy tac:
- BLOCK neu hoi de thi / dap an cua nam hoc dang dien ra ({current_year})
- ALLOW neu hoi de thi / dap an cua nam hoc cu (truoc {current_year})
- BLOCK neu co bypass he thong, leo thang quyen truy cap
- ALLOW neu la cau hoi hoc thuat binh thuong (on tap, mau de thi, cau truc thi)

Chi tra ve JSON: {{"decision": "ALLOW" hoac "BLOCK", "reason": "ly do ngan gon"}}
""".strip()

_SAFETY_CACHE: dict[str, tuple[str, float]] = {}
_SAFETY_CACHE_TTL = 3600.0


def _fold_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _current_academic_year() -> str:
    now = datetime.now()
    year, month = now.year, now.month
    return f"{year}-{year + 1}" if month >= 8 else f"{year - 1}-{year}"


def _is_borderline(folded_query: str) -> bool:
    return any(_fold_text(hint) in folded_query for hint in _BORDERLINE_HINTS)


def _get_cached_safety(folded_query: str) -> str | None:
    entry = _SAFETY_CACHE.get(folded_query)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    return None


def _set_cached_safety(folded_query: str, decision: str) -> None:
    _SAFETY_CACHE[folded_query] = (decision, time.monotonic() + _SAFETY_CACHE_TTL)


async def _call_llm_for_safety(system_prompt: str, query: str) -> str:
    url, model, headers = _llm_target()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": query},
    ]
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            url,
            headers=headers,
            json={"model": model, "messages": messages, "temperature": 0.1},
        )
        res.raise_for_status()
        return (res.json().get("choices") or [{}])[0].get("message", {}).get("content", "")


async def llm_safety_classify(query: str, policy_rules: str) -> bool:
    """True = ALLOW (safe), False = BLOCK. Fail open if LLM errors."""
    try:
        raw = await _call_llm_for_safety(policy_rules, query)
        parsed = json.loads(raw.strip())
        return parsed.get("decision", "ALLOW").upper() != "BLOCK"
    except Exception:
        return True


async def log_policy_event(
    *,
    user: dict | None,
    question: str,
    matched_rule_id: str,
    matched_keyword: str,
    status: str = "blocked",
    audit_reason: str | None = None,
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
            audit_reason or matched_rule_id,
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

    refusal_message = str(policy.get("safeRefusalMessage") or DEFAULT_SAFE_REFUSAL)

    matched = await evaluate_guardrails(query, policy.get("guardrailRules"), user=user)
    if matched:
        await log_policy_event(
            user=user,
            question=query,
            matched_rule_id=matched.rule_id,
            matched_keyword=matched.matched_phrase,
            status="blocked",
            audit_reason=matched.audit_reason(),
        )
        return {
            "answer": refusal_message,
            "citations": [],
            "route": "refusal",
            "blocked_keyword": matched.matched_phrase,
            "blocked_rule_id": matched.rule_id,
            "match_layer": matched.match_layer,
            "match_score": matched.score,
        }

    folded = _fold_text(query)
    if not _is_borderline(folded):
        return None

    cached = _get_cached_safety(folded)
    if cached is None:
        rules = policy.get("policyRules") or DEFAULT_POLICY_RULES.format(
            current_year=_current_academic_year()
        )
        is_safe = await llm_safety_classify(query, rules)
        cached = "ALLOW" if is_safe else "BLOCK"
        _set_cached_safety(folded, cached)

    if cached == "BLOCK":
        await log_policy_event(
            user=user,
            question=query,
            matched_rule_id="llm_classifier",
            matched_keyword="llm_classifier",
            status="blocked",
            audit_reason="borderline_llm_block",
        )
        return {
            "answer": refusal_message,
            "citations": [],
            "route": "refusal",
            "blocked_keyword": "llm_classifier",
            "blocked_rule_id": "llm_classifier",
            "match_layer": "llm_classifier",
        }

    return None


def retrieve_refusal_payload(refusal: dict) -> dict:
    payload: dict = {
        "citations": [],
        "route": "refusal",
        "message": refusal.get("answer") or DEFAULT_SAFE_REFUSAL,
    }
    for key in (
        "blocked_keyword",
        "blocked_rule_id",
        "match_layer",
        "match_score",
        "deny_reason",
        "denyReason",
        "refusal_type",
        "matchedRuleId",
    ):
        value = refusal.get(key)
        if value is not None:
            payload[key] = value
    return payload

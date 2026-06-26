from __future__ import annotations

import asyncio
import time

import httpx

from app.config import (
    ADMIN_CONFIG_CACHE_TTL_SECONDS,
    ADMIN_CONFIG_INTERNAL_KEY,
    ADMIN_CONFIG_URL,
)
from app.guardrails.normalize import policy_from_payload, rules_to_dicts
from app.guardrails.types import DEFAULT_SAFE_REFUSAL, default_guardrail_rule

_POLICY_LOCK = asyncio.Lock()
_POLICY_CACHE: dict[str, object] = {
    "value": {
        "enabled": True,
        "guardrailRules": rules_to_dicts([default_guardrail_rule()]),
        "safeRefusalMessage": DEFAULT_SAFE_REFUSAL,
    },
    "expires_at": 0.0,
}


async def _fetch_remote_policy() -> dict:
    if not ADMIN_CONFIG_URL or not ADMIN_CONFIG_INTERNAL_KEY:
        return policy_from_payload({})

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(
            f"{ADMIN_CONFIG_URL.rstrip('/')}/api/admin-config/internal/rag-policy",
            headers={"x-admin-config-key": ADMIN_CONFIG_INTERNAL_KEY},
        )
        response.raise_for_status()
        return policy_from_payload(response.json())


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
            return cached or policy_from_payload({})

        _POLICY_CACHE["value"] = policy
        _POLICY_CACHE["expires_at"] = now + max(ADMIN_CONFIG_CACHE_TTL_SECONDS, 5)
        return dict(policy)

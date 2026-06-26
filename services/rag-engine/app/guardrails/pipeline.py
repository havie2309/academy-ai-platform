from __future__ import annotations

from collections.abc import Awaitable, Callable

from app.config import (
    GUARDRAIL_FUZZY_ENABLED,
    GUARDRAIL_FUZZY_THRESHOLD,
    GUARDRAIL_HEURISTIC_POLICY_ENABLED,
    GUARDRAIL_LLM_ENABLED,
    GUARDRAIL_SEMANTIC_ENABLED,
    GUARDRAIL_SEMANTIC_THRESHOLD,
)
from app.guardrails.fuzzy_match import match_fuzzy
from app.guardrails.normalize import normalize_rules
from app.guardrails.policy_judge import match_policy_review
from app.guardrails.rule_match import match_substring
from app.guardrails.semantic_match import match_semantic
from app.guardrails.types import GuardrailRule, MatchResult

EmbedFn = Callable[[str], Awaitable[list[float]]]


async def evaluate_guardrails(
    query: str,
    rules: list[dict] | list[GuardrailRule] | None,
    *,
    user: dict | None = None,
    enable_fuzzy: bool | None = None,
    enable_semantic: bool | None = None,
    enable_policy_review: bool | None = None,
    embed_fn: EmbedFn | None = None,
    judge_fn=None,
) -> MatchResult | None:
    normalized = normalize_rules(rules)
    fuzzy_enabled = GUARDRAIL_FUZZY_ENABLED if enable_fuzzy is None else enable_fuzzy
    semantic_enabled = (
        GUARDRAIL_SEMANTIC_ENABLED if enable_semantic is None else enable_semantic
    )
    policy_review_enabled = (
        (GUARDRAIL_LLM_ENABLED or GUARDRAIL_HEURISTIC_POLICY_ENABLED)
        if enable_policy_review is None
        else enable_policy_review
    )

    matched = match_substring(query, normalized)
    if matched:
        return matched

    if fuzzy_enabled:
        matched = match_fuzzy(
            query,
            normalized,
            default_threshold=GUARDRAIL_FUZZY_THRESHOLD,
        )
        if matched:
            return matched

    if semantic_enabled:
        kwargs: dict = {"default_threshold": GUARDRAIL_SEMANTIC_THRESHOLD}
        if embed_fn is not None:
            kwargs["embed_fn"] = embed_fn
        matched = await match_semantic(query, normalized, **kwargs)
        if matched:
            return matched

    if policy_review_enabled:
        kwargs = {}
        if judge_fn is not None:
            kwargs["judge_fn"] = judge_fn
        return await match_policy_review(query, normalized, user, **kwargs)

    return None

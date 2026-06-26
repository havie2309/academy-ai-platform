from __future__ import annotations

import asyncio
import math
from collections.abc import Awaitable, Callable

from app.config import GUARDRAIL_SEMANTIC_TIMEOUT_SECONDS
from app.embeddings import embed_query
from app.guardrails.types import GuardrailRule, MatchResult

EmbedFn = Callable[[str], Awaitable[list[float]]]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return dot / (left_norm * right_norm)


async def _embed_with_timeout(
    text: str,
    embed_fn: EmbedFn,
) -> list[float] | None:
    try:
        return await asyncio.wait_for(
            embed_fn(text),
            timeout=GUARDRAIL_SEMANTIC_TIMEOUT_SECONDS,
        )
    except Exception:
        return None


async def match_semantic(
    query: str,
    rules: list[GuardrailRule],
    *,
    embed_fn: EmbedFn = embed_query,
    default_threshold: float = 0.78,
) -> MatchResult | None:
    semantic_rules = [rule for rule in rules if rule.enabled and rule.match_mode == "semantic"]
    if not semantic_rules:
        return None

    query_vec = await _embed_with_timeout(query, embed_fn)
    if query_vec is None:
        return None

    best: MatchResult | None = None
    for rule in semantic_rules:
        threshold = rule.semantic_threshold or default_threshold
        for phrase in rule.all_phrases():
            phrase_vec = await _embed_with_timeout(phrase, embed_fn)
            if phrase_vec is None:
                continue
            score = cosine_similarity(query_vec, phrase_vec)
            if score < threshold:
                continue
            if best is None or score > best.score:
                best = MatchResult(rule.id, phrase, "semantic", score)
    return best

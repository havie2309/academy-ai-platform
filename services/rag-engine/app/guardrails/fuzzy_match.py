from __future__ import annotations

from rapidfuzz import fuzz

from app.guardrails.normalize import fold_text
from app.guardrails.types import GuardrailRule, MatchResult


def _fuzzy_score(query: str, phrase: str) -> float:
    folded_query = fold_text(query)
    folded_phrase = fold_text(phrase)
    if not folded_query or not folded_phrase:
        return 0.0
    if folded_phrase in folded_query:
        return 1.0
    return fuzz.partial_ratio(folded_phrase, folded_query) / 100.0


def match_fuzzy(
    query: str,
    rules: list[GuardrailRule],
    *,
    default_threshold: float = 0.85,
) -> MatchResult | None:
    best: MatchResult | None = None
    for rule in rules:
        if not rule.enabled:
            continue
        if rule.match_mode != "fuzzy":
            continue
        threshold = rule.fuzzy_threshold or default_threshold
        for phrase in rule.all_phrases():
            score = _fuzzy_score(query, phrase)
            if score < threshold:
                continue
            if best is None or score > best.score:
                best = MatchResult(rule.id, phrase, "fuzzy", score)
    return best

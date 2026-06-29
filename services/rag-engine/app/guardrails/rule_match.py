from __future__ import annotations

from app.guardrails.normalize import fold_text, normalize_phrases, normalize_rules
from app.guardrails.types import GuardrailRule, MatchResult


def _substring_modes(rule: GuardrailRule) -> bool:
    return rule.match_mode in ("substring", "exact", "")


def match_substring(query: str, rules: list[GuardrailRule]) -> MatchResult | None:
    folded_query = fold_text(query)
    for rule in rules:
        if not rule.enabled or not _substring_modes(rule):
            continue
        for phrase in rule.all_phrases():
            if fold_text(phrase) in folded_query:
                return MatchResult(rule.id, phrase, "substring", 1.0)
    return None


def match_blacklist(query: str, keywords: list[str] | None) -> str | None:
    rule = GuardrailRule(
        id="legacy-blacklist",
        label="Legacy blacklist",
        enabled=True,
        phrases=normalize_phrases(keywords),
    )
    if not rule.phrases:
        return None
    matched = match_substring(query, [rule])
    return matched.matched_phrase if matched else None


def match_guardrail_rules(
    query: str,
    rules: list[dict] | None,
) -> tuple[str, str] | None:
    matched = match_substring(query, normalize_rules(rules))
    if not matched:
        return None
    return matched.rule_id, matched.matched_phrase

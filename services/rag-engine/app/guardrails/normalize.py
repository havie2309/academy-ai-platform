from __future__ import annotations

import unicodedata

from app.guardrails.types import (
    DEFAULT_BLACKLIST,
    DEFAULT_GUARDRAIL_RULE_ID,
    DEFAULT_GUARDRAIL_RULE_LABEL,
    DEFAULT_SAFE_REFUSAL,
    GuardrailRule,
    MatchMode,
    default_guardrail_rule,
)

_VALID_MATCH_MODES: set[str] = {"substring", "exact", "fuzzy", "semantic"}


def fold_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", (text or "").lower())
    folded = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return folded.replace("đ", "d")


def normalize_phrases(values: list[str] | None) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for value in values or []:
        item = str(value).strip()
        if not item:
            continue
        key = fold_text(item)
        if not key or key in seen:
            continue
        seen.add(key)
        normalized.append(item)
    return normalized


def _read_match_mode(raw: object) -> MatchMode:
    mode = str(raw or "substring").strip().lower()
    if mode in _VALID_MATCH_MODES:
        return mode  # type: ignore[return-value]
    return "substring"


def _read_threshold(raw: object, default: float) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return default
    return min(max(value, 0.0), 1.0)


def rule_from_dict(raw: dict, *, index: int) -> GuardrailRule | None:
    phrases = normalize_phrases(raw.get("phrases"))
    if not phrases:
        return None
    rule_id = str(raw.get("id") or f"rule-{index + 1}").strip()
    if not rule_id:
        return None
    synonyms = normalize_phrases(raw.get("synonyms"))
    return GuardrailRule(
        id=rule_id,
        label=str(raw.get("label") or f"Rule {index + 1}").strip(),
        enabled=bool(raw.get("enabled", True)),
        phrases=phrases,
        match_mode=_read_match_mode(raw.get("matchMode", raw.get("match_mode"))),
        fuzzy_threshold=_read_threshold(
            raw.get("fuzzyThreshold", raw.get("fuzzy_threshold")),
            0.85,
        ),
        semantic_threshold=_read_threshold(
            raw.get("semanticThreshold", raw.get("semantic_threshold")),
            0.78,
        ),
        synonyms=synonyms,
    )


def normalize_rules(rules: list[dict] | list[GuardrailRule] | None) -> list[GuardrailRule]:
    if not rules:
        return [default_guardrail_rule()]

    normalized: list[GuardrailRule] = []
    seen: set[str] = set()
    for index, rule in enumerate(rules):
        parsed = rule if isinstance(rule, GuardrailRule) else rule_from_dict(rule, index=index)
        if parsed is None or parsed.id in seen:
            continue
        seen.add(parsed.id)
        normalized.append(parsed)
    return normalized or [default_guardrail_rule()]


def rules_to_dicts(rules: list[GuardrailRule]) -> list[dict]:
    return [
        {
            "id": rule.id,
            "label": rule.label,
            "enabled": rule.enabled,
            "phrases": rule.phrases,
            "matchMode": rule.match_mode,
            "fuzzyThreshold": rule.fuzzy_threshold,
            "semanticThreshold": rule.semantic_threshold,
            "synonyms": rule.synonyms,
        }
        for rule in rules
    ]


def policy_from_payload(payload: dict) -> dict:
    value = payload.get("value") if isinstance(payload, dict) else None
    source = value if isinstance(value, dict) else payload
    safe_refusal = str(source.get("safeRefusalMessage") or "").strip()
    guardrail_rules = source.get("guardrailRules")
    blacklist_keywords = source.get("blacklistKeywords") or DEFAULT_BLACKLIST
    if isinstance(guardrail_rules, list) and guardrail_rules:
        rules = normalize_rules(guardrail_rules)
    else:
        rules = normalize_rules(
            [
                {
                    "id": DEFAULT_GUARDRAIL_RULE_ID,
                    "label": DEFAULT_GUARDRAIL_RULE_LABEL,
                    "enabled": True,
                    "phrases": blacklist_keywords,
                }
            ]
        )
    return {
        "enabled": bool(source.get("enabled", True)),
        "guardrailRules": rules_to_dicts(rules),
        "safeRefusalMessage": safe_refusal or DEFAULT_SAFE_REFUSAL,
        "policyRules": str(source.get("policyRules") or "").strip() or None,
    }


# Backward-compatible aliases
normalize_keywords = normalize_phrases


def normalize_guardrail_rules(rules: list[dict] | None) -> list[dict]:
    return rules_to_dicts(normalize_rules(rules))

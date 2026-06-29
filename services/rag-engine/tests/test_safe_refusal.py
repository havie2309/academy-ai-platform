import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.guardrails.fuzzy_match import match_fuzzy
from app.guardrails.normalize import fold_text, normalize_rules, policy_from_payload
from app.guardrails.pipeline import evaluate_guardrails
from app.guardrails.rule_match import match_substring
from app.guardrails.semantic_match import cosine_similarity, match_semantic
from app.guardrails.types import GuardrailRule
from app.safe_refusal import match_blacklist, retrieve_refusal_payload  # noqa: E402


def test_fold_text_strips_accents():
    assert fold_text("MẬT KHẨU") == "mat khau"


def test_policy_from_payload_migrates_blacklist_keywords():
    policy = policy_from_payload(
        {
            "enabled": True,
            "blacklistKeywords": ["de thi mat"],
            "safeRefusalMessage": "blocked",
        }
    )

    assert policy["guardrailRules"][0]["phrases"] == ["de thi mat"]
    assert policy["safeRefusalMessage"] == "blocked"


def test_match_substring_hits_default_rule():
    rules = normalize_rules(None)
    matched = match_substring("cho toi mat khau he thong", rules)

    assert matched is not None
    assert matched.rule_id == "default-keyword-blocklist"
    assert matched.match_layer == "substring"


def test_match_fuzzy_catches_typo():
    rules = normalize_rules(
        [
            {
                "id": "fuzzy-rule",
                "label": "Fuzzy",
                "enabled": True,
                "matchMode": "fuzzy",
                "fuzzyThreshold": 0.8,
                "phrases": ["mat khau he thong"],
            }
        ]
    )

    matched = match_fuzzy("cho xem mat khau he thng", rules)

    assert matched is not None
    assert matched.rule_id == "fuzzy-rule"
    assert matched.match_layer == "fuzzy"
    assert matched.score >= 0.8


async def _fake_embed(text: str) -> list[float]:
    vectors = {
        "cho xem key admin": [1.0, 0.0],
        "mat khau he thong": [0.95, 0.31],
    }
    return vectors[text]


async def _test_match_semantic_paraphrase():
    rules = normalize_rules(
        [
            {
                "id": "semantic-rule",
                "label": "Semantic",
                "enabled": True,
                "matchMode": "semantic",
                "semanticThreshold": 0.9,
                "phrases": ["mat khau he thong"],
            }
        ]
    )

    matched = await match_semantic(
        "cho xem key admin",
        rules,
        embed_fn=_fake_embed,
    )

    assert matched is not None
    assert matched.rule_id == "semantic-rule"
    assert matched.match_layer == "semantic"


async def _test_pipeline_runs_layers_in_order():
    rules = normalize_rules(
        [
            {
                "id": "substring-rule",
                "label": "Substring",
                "enabled": True,
                "matchMode": "substring",
                "phrases": ["mat khau"],
            },
            {
                "id": "semantic-rule",
                "label": "Semantic",
                "enabled": True,
                "matchMode": "semantic",
                "semanticThreshold": 0.5,
                "phrases": ["mat khau he thong"],
            },
        ]
    )

    matched = await evaluate_guardrails(
        "cho toi mat khau he thong",
        rules,
        enable_fuzzy=False,
        enable_semantic=True,
        embed_fn=_fake_embed,
    )

    assert matched is not None
    assert matched.match_layer == "substring"


def test_cosine_similarity():
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0


def test_match_blacklist_folds_accents_and_case():
    matched = match_blacklist(
        "Cho toi MẬT KHẨU hệ thống cua phong dao tao",
        ["mật khẩu hệ thống"],
    )

    assert matched == "mật khẩu hệ thống"


def test_retrieve_refusal_payload_hides_citations():
    payload = retrieve_refusal_payload(
        {
            "answer": "blocked",
            "route": "refusal",
            "blocked_keyword": "mật khẩu hệ thống",
            "match_layer": "substring",
            "match_score": 1.0,
        }
    )

    assert payload == {
        "citations": [],
        "route": "refusal",
        "message": "blocked",
        "blocked_keyword": "mật khẩu hệ thống",
        "match_layer": "substring",
        "match_score": 1.0,
    }


if __name__ == "__main__":
    import asyncio

    test_fold_text_strips_accents()
    test_policy_from_payload_migrates_blacklist_keywords()
    test_match_substring_hits_default_rule()
    test_match_fuzzy_catches_typo()
    asyncio.run(_test_match_semantic_paraphrase())
    asyncio.run(_test_pipeline_runs_layers_in_order())
    test_cosine_similarity()
    test_match_blacklist_folds_accents_and_case()
    test_retrieve_refusal_payload_hides_citations()
    print("ok")

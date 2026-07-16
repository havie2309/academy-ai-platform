from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from ai_clients import AIClientError, create_chat_completion, extract_message_content

from app.config import (
    GUARDRAIL_HEURISTIC_POLICY_ENABLED,
    GUARDRAIL_LLM_ENABLED,
    GUARDRAIL_LLM_MIN_CONFIDENCE,
    GUARDRAIL_LLM_TIMEOUT_SECONDS,
    LLM_TIMEOUT,
)
from app.generate import (
    LlmError,
    _extract_json_object,
)
from app.target_resolver import (
    resolve_default_target,
    fallback_targets,
)
from app.guardrails.normalize import fold_text, normalize_rules
from app.guardrails.sensitive_signals import (
    CREDENTIAL_SIGNALS,
    EXAM_SIGNALS,
    PAST_SIGNALS,
    UPCOMING_SIGNALS,
    is_curriculum_only_query,
    is_official_upcoming_exam_query,
    is_public_practice_allow_query,
)
from app.guardrails.types import GuardrailRule, MatchResult

PolicyJudgeFn = Callable[[str, list[GuardrailRule], dict | None], Awaitable[dict[str, Any]]]

POLICY_JUDGE_SYSTEM = """
Ban la bo loc chinh sach an toan AI cua hoc vien.
Nhiem vu: phan loai cau hoi co vi pham chinh sach hay khong, dac biet voi noi dung de thi, dap an, mat khau, lich thi.

Quy tac:
- Chan neu nguoi dung muon xem/lay de thi sap toi, dap an hien tai, tai lieu mat, mat khau he thong, bypass quyen.
- Cho phep neu chi hoi chinh sach/quy trinh, de cuong mon hoc, de thi/bai thi qua khu, hoac de thi thu/de luyen da cong khai cho hoc sinh on tap.
- "de cuong" khac "de thi"; khong chan nham de cuong mon hoc.
- "de thi thu tuan sau" / "de luyen cong khai" => allow.
- "bai kiem tra tuan toi" / "de thi sap toi" (de chinh thuc) => block.
- "de thi nam ngoai" / "de cu cua ky truoc" => allow neu chi tham khao qua khu.

Tra ve DUY NHAT JSON hop le:
{
  "decision": "block" | "allow" | "uncertain",
  "category": "exam_content" | "credential" | "policy_question" | "curriculum" | "other",
  "temporal": "past" | "current" | "upcoming" | "unknown",
  "intent": "access_upcoming_exam" | "review_past_material" | "general_policy_question" | "curriculum_lookup" | "credential_access" | "other",
  "confidence": 0.0,
  "matched_concept": "cum tu hoac khai niem chinh",
  "reason": "ly do ngan"
}
""".strip()


def heuristic_policy_judge(query: str) -> dict[str, Any]:
    folded = fold_text(query)
    if is_curriculum_only_query(folded):
        return {
            "decision": "allow",
            "category": "curriculum",
            "temporal": "unknown",
            "intent": "curriculum_lookup",
            "confidence": 0.95,
            "matched_concept": "de cuong",
            "reason": "Cau hoi ve de cuong mon hoc",
        }

    if is_public_practice_allow_query(folded):
        return {
            "decision": "allow",
            "category": "exam_content",
            "temporal": "upcoming",
            "intent": "other",
            "confidence": 0.92,
            "matched_concept": "de thi thu cong khai",
            "reason": "De thi thu/luyen tap da cong khai cho hoc sinh",
        }

    if any(signal in folded for signal in CREDENTIAL_SIGNALS):
        return {
            "decision": "block",
            "category": "credential",
            "temporal": "current",
            "intent": "credential_access",
            "confidence": 0.93,
            "matched_concept": "thong tin nhay cam",
            "reason": "Yeu cau lien quan mat khau/tai lieu mat",
        }

    exam_hit = any(signal in folded for signal in EXAM_SIGNALS) or (
        "bai kiem tra" in folded or "bai thi" in folded
    )
    upcoming_hit = any(signal in folded for signal in UPCOMING_SIGNALS)
    past_hit = any(signal in folded for signal in PAST_SIGNALS)

    if is_official_upcoming_exam_query(folded):
        return {
            "decision": "block",
            "category": "exam_content",
            "temporal": "upcoming",
            "intent": "access_upcoming_exam",
            "confidence": 0.9,
            "matched_concept": "de thi chinh thuc sap toi",
            "reason": "Yeu cau noi dung thi chinh thuc sap dien ra",
        }

    if exam_hit and past_hit:
        return {
            "decision": "allow",
            "category": "exam_content",
            "temporal": "past",
            "intent": "review_past_material",
            "confidence": 0.88,
            "matched_concept": "de thi qua khu",
            "reason": "Tham khao de thi qua khu",
        }

    if "chinh sach" in folded or "quy trinh" in folded or "quy dinh" in folded:
        return {
            "decision": "allow",
            "category": "policy_question",
            "temporal": "unknown",
            "intent": "general_policy_question",
            "confidence": 0.86,
            "matched_concept": "chinh sach",
            "reason": "Cau hoi ve chinh sach/quy trinh",
        }

    if exam_hit:
        return {
            "decision": "uncertain",
            "category": "exam_content",
            "temporal": "unknown",
            "intent": "other",
            "confidence": 0.55,
            "matched_concept": "de thi",
            "reason": "Co tin hieu de thi nhung chua ro thoi gian",
        }

    return {
        "decision": "allow",
        "category": "other",
        "temporal": "unknown",
        "intent": "other",
        "confidence": 0.7,
        "matched_concept": "",
        "reason": "Khong co tin hieu nhay cam",
    }


def _normalize_judgment(raw: dict[str, Any] | None) -> dict[str, Any]:
    source = raw or {}
    decision = str(source.get("decision") or "uncertain").strip().lower()
    if decision not in {"block", "allow", "uncertain"}:
        decision = "uncertain"
    try:
        confidence = float(source.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = min(max(confidence, 0.0), 1.0)
    return {
        "decision": decision,
        "category": str(source.get("category") or "other").strip() or "other",
        "temporal": str(source.get("temporal") or "unknown").strip() or "unknown",
        "intent": str(source.get("intent") or "other").strip() or "other",
        "confidence": confidence,
        "matched_concept": str(source.get("matched_concept") or "").strip(),
        "reason": str(source.get("reason") or "").strip(),
    }


def judgment_to_match_result(
    judgment: dict[str, Any],
    *,
    min_confidence: float = GUARDRAIL_LLM_MIN_CONFIDENCE,
    fail_closed: bool = True,
) -> MatchResult | None:
    normalized = _normalize_judgment(judgment)
    decision = normalized["decision"]
    confidence = normalized["confidence"]

    if decision == "allow":
        return None
    if decision == "block" and confidence >= min_confidence:
        concept = normalized["matched_concept"] or normalized["reason"] or "policy_violation"
        return MatchResult(
            rule_id="llm-policy-judge",
            matched_phrase=concept,
            match_layer="llm",
            score=confidence,
        )
    if fail_closed and decision == "uncertain" and confidence >= min_confidence:
        concept = normalized["matched_concept"] or "uncertain_policy_signal"
        return MatchResult(
            rule_id="llm-policy-judge",
            matched_phrase=concept,
            match_layer="llm",
            score=confidence,
        )
    return None


async def complete_llm_policy_judge(
    query: str,
    rules: list[GuardrailRule],
    user: dict | None = None,
) -> dict[str, Any]:
    url, model, headers = _llm_target()
    roles = ", ".join((user or {}).get("roles") or []) or "unknown"
    rules_summary = [
        {
            "id": rule.id,
            "label": rule.label,
            "phrases": rule.phrases[:8],
            "synonyms": rule.synonyms[:8],
        }
        for rule in rules
        if rule.enabled
    ]
    user_prompt = json.dumps(
        {
            "query": query,
            "user_roles": roles,
            "guardrail_rules": rules_summary,
        },
        ensure_ascii=False,
    )
    timeout = min(GUARDRAIL_LLM_TIMEOUT_SECONDS, LLM_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            url,
            headers=headers,
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": POLICY_JUDGE_SYSTEM},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.0,
            },
        )
    if response.status_code >= 400:
        raise LlmError(f"Policy LLM loi ({response.status_code})")
    content = (response.json().get("choices") or [{}])[0].get("message", {}).get("content")
    parsed = _extract_json_object(str(content or ""))
    if not parsed:
        raise LlmError("Policy LLM khong tra ve JSON hop le")
    return _normalize_judgment(parsed)


async def judge_policy(
    query: str,
    rules: list[GuardrailRule],
    user: dict | None = None,
    *,
    judge_fn: PolicyJudgeFn | None = None,
) -> dict[str, Any]:
    if judge_fn is not None:
        return _normalize_judgment(await judge_fn(query, rules, user))

    if GUARDRAIL_LLM_ENABLED:
        try:
            return await asyncio.wait_for(
                complete_llm_policy_judge(query, rules, user),
                timeout=GUARDRAIL_LLM_TIMEOUT_SECONDS,
            )
        except Exception:
            if not GUARDRAIL_HEURISTIC_POLICY_ENABLED:
                return _normalize_judgment(
                    {
                        "decision": "uncertain",
                        "confidence": 0.8,
                        "matched_concept": "policy_judge_error",
                        "reason": "LLM policy judge failed",
                    }
                )

    if GUARDRAIL_HEURISTIC_POLICY_ENABLED:
        return _normalize_judgment(heuristic_policy_judge(query))

    return _normalize_judgment({"decision": "allow", "confidence": 0.0})


async def match_policy_review(
    query: str,
    rules: list[dict] | list[GuardrailRule] | None,
    user: dict | None = None,
    *,
    judge_fn: PolicyJudgeFn | None = None,
) -> MatchResult | None:
    normalized = normalize_rules(rules)
    from app.guardrails.sensitive_signals import has_sensitive_signal

    if not has_sensitive_signal(query, normalized):
        return None

    judgment = await judge_policy(query, normalized, user, judge_fn=judge_fn)
    return judgment_to_match_result(judgment)


async def complete_llm_policy_judge(
    query: str,
    rules: list[GuardrailRule],
    user: dict | None = None,
) -> dict[str, Any]:
    target = resolve_default_target()
    roles = ", ".join((user or {}).get("roles") or []) or "unknown"
    rules_summary = [
        {
            "id": rule.id,
            "label": rule.label,
            "phrases": rule.phrases[:8],
            "synonyms": rule.synonyms[:8],
        }
        for rule in rules
        if rule.enabled
    ]
    user_prompt = json.dumps(
        {
            "query": query,
            "user_roles": roles,
            "guardrail_rules": rules_summary,
        },
        ensure_ascii=False,
    )
    timeout = min(GUARDRAIL_LLM_TIMEOUT_SECONDS, LLM_TIMEOUT)
    try:
        data = await create_chat_completion(
            target,
            [
                {"role": "system", "content": POLICY_JUDGE_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            timeout=timeout,
            fallback_targets=fallback_targets(),
        )
    except (AIClientError, httpx.HTTPError) as exc:
        raise LlmError(str(exc)) from exc
    content = extract_message_content(data)
    parsed = _extract_json_object(str(content or ""))
    if not parsed:
        raise LlmError("Policy LLM khong tra ve JSON hop le")
    return _normalize_judgment(parsed)

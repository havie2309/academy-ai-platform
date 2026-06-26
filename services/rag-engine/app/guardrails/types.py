from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

MatchMode = Literal["substring", "exact", "fuzzy", "semantic"]

DEFAULT_SAFE_REFUSAL = (
    "Xin lỗi, tôi không thể trả lời câu hỏi này theo chính sách an toàn hiện tại."
)
DEFAULT_BLACKLIST = [
    "đề thi mất",
    "đáp án đề thi",
    "mật khẩu hệ thống",
    "bypass quyền",
    "vượt quyền truy cập",
]
RAG_POLICY_KEY = "rag_policy"
DEFAULT_GUARDRAIL_RULE_ID = "default-keyword-blocklist"
DEFAULT_GUARDRAIL_RULE_LABEL = "Danh sách từ khóa bị chặn"


@dataclass(frozen=True)
class GuardrailRule:
    id: str
    label: str
    enabled: bool
    phrases: list[str]
    match_mode: MatchMode = "substring"
    fuzzy_threshold: float = 0.85
    semantic_threshold: float = 0.78
    synonyms: list[str] = field(default_factory=list)

    def all_phrases(self) -> list[str]:
        return [*self.phrases, *self.synonyms]


@dataclass(frozen=True)
class MatchResult:
    rule_id: str
    matched_phrase: str
    match_layer: str
    score: float = 1.0

    def audit_reason(self) -> str:
        return f"{self.rule_id}|{self.match_layer}|{self.score:.3f}"


def default_guardrail_rule() -> GuardrailRule:
    return GuardrailRule(
        id=DEFAULT_GUARDRAIL_RULE_ID,
        label=DEFAULT_GUARDRAIL_RULE_LABEL,
        enabled=True,
        phrases=DEFAULT_BLACKLIST[:],
    )

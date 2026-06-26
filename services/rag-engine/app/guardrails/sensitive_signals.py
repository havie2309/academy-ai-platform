from __future__ import annotations

from app.guardrails.normalize import fold_text
from app.guardrails.types import GuardrailRule

EXAM_SIGNALS = (
    "de thi",
    "bai kiem tra",
    "bai thi",
    "dap an de",
    "dap an bai",
    "de thi mat",
    "lo de",
)
CREDENTIAL_SIGNALS = (
    "mat khau he thong",
    "pass admin",
    "key he thong",
    "tai lieu mat",
    "bypass quyen",
)
UPCOMING_SIGNALS = (
    "tuan toi",
    "tuan sau",
    "nam toi",
    "nam sau",
    "sap toi",
    "ky nay",
    "hom nay",
    "ngay mai",
    "truoc khi thi",
    "truoc gio thi",
)
PAST_SIGNALS = (
    "nam ngoai",
    "nam truoc",
    "ky truoc",
    "lan truoc",
    "de cu",
    "de thi cu",
    "bai thi cu",
)
CURRICULUM_SAFE_SIGNALS = (
    "de cuong",
    "syllabus",
    "chuong trinh mon",
)
PRACTICE_EXAM_SIGNALS = (
    "de thi thu",
    "de thu",
    "de luyen",
    "bai luyen",
    "on tap",
    "luyen thi",
    "luyen tap",
    "bai tap luyen",
)
PUBLICATION_ALLOW_SIGNALS = (
    "cong khai",
    "da cong bo",
    "phat cho hoc sinh",
    "hoc sinh luyen",
    "de luyen tap",
    "bai luyen tap",
    "da phat hanh",
)
LEAK_OVERRIDE_SIGNALS = (
    "dap an",
    "de thi mat",
    "lo de",
    "bi ro ri",
    "key de thi",
    "lo bai thi",
)


def is_curriculum_only_query(folded_query: str) -> bool:
    if not any(signal in folded_query for signal in CURRICULUM_SAFE_SIGNALS):
        return False
    return not any(
        signal in folded_query
        for signal in (*EXAM_SIGNALS, *CREDENTIAL_SIGNALS, "dap an", "mat khau")
    )


def has_leak_override_signal(folded_query: str) -> bool:
    return any(signal in folded_query for signal in LEAK_OVERRIDE_SIGNALS)


def is_public_practice_allow_query(folded_query: str) -> bool:
    if has_leak_override_signal(folded_query):
        return False

    practice_hit = any(signal in folded_query for signal in PRACTICE_EXAM_SIGNALS)
    if practice_hit:
        return True

    publication_hit = any(signal in folded_query for signal in PUBLICATION_ALLOW_SIGNALS)
    exam_context = any(
        token in folded_query for token in ("de thi", "bai kiem tra", "bai thi")
    )
    return publication_hit and exam_context


def is_official_upcoming_exam_query(folded_query: str) -> bool:
    if is_public_practice_allow_query(folded_query):
        return False
    exam_hit = any(signal in folded_query for signal in EXAM_SIGNALS) or (
        "bai kiem tra" in folded_query or "bai thi" in folded_query
    )
    upcoming_hit = any(signal in folded_query for signal in UPCOMING_SIGNALS)
    return exam_hit and upcoming_hit


def has_sensitive_signal(query: str, rules: list[GuardrailRule] | None = None) -> bool:
    folded = fold_text(query)
    if not folded:
        return False
    if is_curriculum_only_query(folded):
        return False
    if is_public_practice_allow_query(folded):
        return False

    exam_hit = any(signal in folded for signal in EXAM_SIGNALS)
    credential_hit = any(signal in folded for signal in CREDENTIAL_SIGNALS)
    upcoming_hit = any(signal in folded for signal in UPCOMING_SIGNALS)

    if credential_hit:
        return True
    if exam_hit and upcoming_hit:
        return True
    if exam_hit and any(signal in folded for signal in PAST_SIGNALS):
        return True
    if "bai kiem tra" in folded or "bai thi" in folded:
        return True
    if "de thi" in folded:
        return True

    for rule in rules or []:
        if not rule.enabled:
            continue
        for phrase in rule.all_phrases():
            folded_phrase = fold_text(phrase)
            if len(folded_phrase) >= 4 and folded_phrase in folded:
                return True
    return False

from __future__ import annotations

import asyncio
import re
import time
import unicodedata
from datetime import datetime

import asyncpg
import numpy as np
from ai_clients import create_embeddings

from app.config import (
    ADMIN_CONFIG_CACHE_TTL_SECONDS,
    ADMIN_CONFIG_INTERNAL_KEY,
    ADMIN_CONFIG_URL,
    EMBEDDING_BASE_URL,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from app.guardrails.normalize import normalize_guardrail_rules, normalize_keywords
from app.guardrails.pipeline import evaluate_guardrails
from app.guardrails.policy_store import get_rag_policy
from app.guardrails.rule_match import match_blacklist, match_guardrail_rules
from app.guardrails.types import (
    DEFAULT_BLACKLIST,
    DEFAULT_SAFE_REFUSAL,
    RAG_POLICY_KEY,
)

__all__ = [
    "CLARIFICATION_TEMPLATES",
    "DEFAULT_BLACKLIST",
    "DEFAULT_SAFE_REFUSAL",
    "RAG_POLICY_KEY",
    "check_query_clarity",
    "get_rag_policy",
    "log_policy_event",
    "match_blacklist",
    "match_guardrail_rules",
    "maybe_refuse_query",
    "normalize_guardrail_rules",
    "normalize_keywords",
    "retrieve_refusal_payload",
]

CLARIFICATION_TEMPLATES: dict[str, str] = {
    "time": (
        "Bạn muốn hỏi về năm học nào hoặc học kỳ nào? "
        "Ví dụ: năm học 2024-2025, học kỳ 1 hoặc học kỳ 2."
    ),
    "subject": "Bạn muốn hỏi về môn học nào cụ thể?",
    "person": "Bạn muốn tra cứu thông tin của sinh viên hoặc giảng viên nào?",
    "default": "Bạn có thể cung cấp thêm thông tin cụ thể hơn không?",
}

# Per-topic clarification messages for TIME ambiguity — keyed by the matched hint
_TIME_CLARIFICATION_BY_TOPIC: dict[str, str] = {
    "lich thi":           "Bạn muốn xem **lịch thi** của năm học và học kỳ nào? Ví dụ: năm học 2025-2026, học kỳ 1.",
    "lịch thi":           "Bạn muốn xem **lịch thi** của năm học và học kỳ nào? Ví dụ: năm học 2025-2026, học kỳ 1.",
    "thoi khoa bieu":     "Bạn muốn xem **thời khóa biểu** năm học và học kỳ nào?",
    "thời khóa biểu":     "Bạn muốn xem **thời khóa biểu** năm học và học kỳ nào?",
    "hoc phi":            "Học phí thay đổi theo từng năm. Bạn muốn biết **học phí** năm học nào?",
    "học phí":            "Học phí thay đổi theo từng năm. Bạn muốn biết **học phí** năm học nào?",
    "dang ky tin chi":    "Bạn muốn biết thông tin **đăng ký tín chỉ** của năm học và học kỳ nào?",
    "đăng ký tín chỉ":    "Bạn muốn biết thông tin **đăng ký tín chỉ** của năm học và học kỳ nào?",
    "dang ky hoc phan":   "Bạn muốn biết thông tin **đăng ký học phần** của năm học và học kỳ nào?",
    "đăng ký học phần":   "Bạn muốn biết thông tin **đăng ký học phần** của năm học và học kỳ nào?",
    "lich hoc":           "Bạn muốn xem **lịch học** của năm học và học kỳ nào?",
    "lịch học":           "Bạn muốn xem **lịch học** của năm học và học kỳ nào?",
    "thi cuoi ky":        "Bạn muốn biết thông tin **thi cuối kỳ** của năm học và học kỳ nào?",
    "thi cuối kỳ":        "Bạn muốn biết thông tin **thi cuối kỳ** của năm học và học kỳ nào?",
    "kiem tra cuoi ky":   "Bạn muốn biết thông tin **kiểm tra cuối kỳ** của năm học và học kỳ nào?",
    "kiểm tra cuối kỳ":   "Bạn muốn biết thông tin **kiểm tra cuối kỳ** của năm học và học kỳ nào?",
    "tuyen sinh":         "Bạn muốn biết thông tin **tuyển sinh** năm học nào?",
    "tuyển sinh":         "Bạn muốn biết thông tin **tuyển sinh** năm học nào?",
    "hoc bong":           "Tiêu chí **học bổng** có thể thay đổi theo năm. Bạn muốn biết thông tin năm học nào?",
    "học bổng":           "Tiêu chí **học bổng** có thể thay đổi theo năm. Bạn muốn biết thông tin năm học nào?",
    "deadline nop":       "Bạn muốn biết **deadline nộp** của năm học và học kỳ nào?",
    "hạn nộp":            "Bạn muốn biết **hạn nộp** của năm học và học kỳ nào?",
    "han nop":            "Bạn muốn biết **hạn nộp** của năm học và học kỳ nào?",
    "tot nghiep":         "Bạn muốn biết thông tin **tốt nghiệp** của năm học nào?",
    "tốt nghiệp":         "Bạn muốn biết thông tin **tốt nghiệp** của năm học nào?",
    "bao ve luan van":    "Bạn muốn biết lịch **bảo vệ luận văn** của năm học nào?",
    "bảo vệ luận văn":    "Bạn muốn biết lịch **bảo vệ luận văn** của năm học nào?",
}

# Chỉ các từ liên quan đáp án/nội dung thi mới cần check year.
# "lịch thi", "mẫu đề thi", "ôn tập" KHÔNG nằm ở đây → để guardrail thường xử lý.
_ANSWER_HINTS = (
    "dap an",
    "đáp án",
    "noi dung bai thi",
    "nội dung bài thi",
    "noi dung de thi",
    "nội dung đề thi",
    "bai thi",
    "bài thi",
    "cau hoi thi",
    "câu hỏi thi",
    "de kiem tra",
    "đề kiểm tra",
)

# Match cặp năm học dạng "2024-2025", "2024/2025", "2024 2025"
_YEAR_PAIR_RE = re.compile(r"(20\d{2})[^\d]+(20\d{2})")

# "năm ngoái", "kỳ trước" → rõ ràng là năm cũ → ALLOW
_PAST_RELATIVE_HINTS = (
    "nam ngoai",
    "năm ngoái",
    "nam truoc",
    "năm trước",
    "ky truoc",
    "kỳ trước",
    "hoc ky truoc",
    "học kỳ trước",
    "truoc day",
    "trước đây",
)

# "năm nay", "kỳ này" → năm hiện tại → BLOCK
_CURRENT_RELATIVE_HINTS = (
    "nam nay",
    "năm nay",
    "ky nay",
    "kỳ này",
    "hoc ky nay",
    "học kỳ này",
    "nam hoc nay",
    "năm học này",
    "hien tai",
    "hiện tại",
    "sap toi",
    "sắp tới",
    "tuan toi",
    "tuần tới",
    "tuan sau",
    "tuần sau",
    "nam toi",
    "năm tới",
    "nam sau",
    "năm sau",
)

# Queries about schedules/fees/exams without year/semester → TIME ambiguous
_TIME_SENSITIVE_HINTS = (
    "lich thi",
    "lịch thi",
    "thoi khoa bieu",
    "thời khóa biểu",
    "hoc phi",
    "học phí",
    "dang ky tin chi",
    "đăng ký tín chỉ",
    "dang ky hoc phan",
    "đăng ký học phần",
    "lich hoc",
    "lịch học",
    "thi cuoi ky",
    "thi cuối kỳ",
    "kiem tra cuoi ky",
    "kiểm tra cuối kỳ",
    "tuyen sinh",
    "tuyển sinh",
    "hoc bong",
    "học bổng",
    "deadline nop",
    "han nop",
    "hạn nộp",
    "tot nghiep",
    "tốt nghiệp",
    "bao ve luan van",
    "bảo vệ luận văn",
)

# Queries asking about a course without naming which → SUBJECT ambiguous
_SUBJECT_SENSITIVE_HINTS = (
    "de cuong mon",
    "đề cương môn",
    "tai lieu mon",
    "tài liệu môn",
    "noi dung mon",
    "nội dung môn",
    "diem thi mon",
    "điểm thi môn",
    "thi mon",
    "thi môn",
)

# Terminators in folded form (no diacritics)
_SUBJECT_TERMINATORS = (
    "cua", "trong", "nam", "hoc", "ky", "cuoi", "giua", "nay", "do", "moi", "cu", "nay",
    "sau", "truoc", "toi", "thi", "ket", "qua", "diem", "de", "cuong", "tai", "lieu",
    "noi", "dung", "chuong", "trinh", "mon", "phan", "sinh", "vien", "giang", "day",
    "tap", "on", "luyen", "tham", "khao", "chinh", "thuc", "bo", "sung", "them", "nhat",
    "thuong", "tren", "duoi", "vao", "ra", "di", "den", "tu", "ve", "voi", "cho", "va",
    "hoac", "hay", "roi", "thi", "ma", "neu", "khi", "nhung", "boi", "vi", "do", "tai",
    "theo", "qua", "sau", "truoc", "ngoai", "ben", "canh", "bang",
)
_TERMINATOR_PATTERN = "|".join(re.escape(w) for w in _SUBJECT_TERMINATORS)

# Generic words in folded form (used to trim trailing noise)
_GENERIC_SUBJECT_WORDS = {
    "hoc", "moi", "cu", "nay", "do", "ky", "thi", "cuoi", "giua", "tren", "duoi",
    "cua", "trong", "va", "cho", "voi",
}

# Only trigger PERSON clarification when the query explicitly leaves "who" open
# ("ai" = who). Avoids false positives for "điểm của Nguyễn Văn A".
_PERSON_SENSITIVE_HINTS = (
    "diem cua ai",
    "điểm của ai",
    "ket qua cua ai",
    "kết quả của ai",
    "thong tin cua ai",
    "thông tin của ai",
    "ho so cua ai",
    "hồ sơ của ai",
)

# Labeled examples cho KNN embedding classifier
_SAFETY_EXAMPLES: list[tuple[str, str]] = [
    # BLOCK — hỏi đáp án kỳ thi hiện tại
    ("đáp án đề thi năm nay", "BLOCK"),
    ("đáp án đề thi kỳ này", "BLOCK"),
    ("nội dung bài thi hiện tại", "BLOCK"),
    ("cho tôi xem đáp án kỳ thi đang diễn ra", "BLOCK"),
    ("chia sẻ đáp án kỳ thi sắp tới", "BLOCK"),
    ("đề thi môn toán học kỳ này", "BLOCK"),
    ("gửi cho tôi đáp án đề thi", "BLOCK"),
    ("nội dung đề thi kỳ đang thi", "BLOCK"),
    # ALLOW — hỏi đáp án kỳ thi cũ
    ("đáp án đề thi năm ngoái", "ALLOW"),
    ("đáp án đề thi kỳ trước", "ALLOW"),
    ("nội dung bài thi năm cũ", "ALLOW"),
    ("ôn tập với đề thi cũ", "ALLOW"),
    ("tham khảo đề thi các năm trước", "ALLOW"),
    ("đề thi cũ để ôn luyện", "ALLOW"),
    ("xem lại đáp án bài thi đã qua", "ALLOW"),
    ("đề thi năm học trước để ôn", "ALLOW"),
    # ALLOW — lịch thi, cấu trúc, mẫu (không phải đáp án thật)
    ("lịch thi học kỳ này", "ALLOW"),
    ("cấu trúc đề thi môn toán", "ALLOW"),
    ("mẫu đề thi tham khảo", "ALLOW"),
    ("hướng dẫn ôn tập thi cuối kỳ", "ALLOW"),
    ("thông tin lịch thi 2025-2026", "ALLOW"),
]

_EMBED_EXAMPLES: list[tuple[list[float], str]] | None = None
_EMBED_LOCK = asyncio.Lock()


async def _embed_text(text: str) -> list[float]:
    return (
        await create_embeddings(
            base_url=EMBEDDING_BASE_URL,
            inputs=[text],
            timeout=10.0,
        )
    )[0]


def _cosine_sim(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=float)
    vb = np.array(b, dtype=float)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom > 1e-9 else 0.0


async def _load_example_embeddings() -> list[tuple[list[float], str]]:
    global _EMBED_EXAMPLES
    if _EMBED_EXAMPLES is not None:
        return _EMBED_EXAMPLES
    async with _EMBED_LOCK:
        if _EMBED_EXAMPLES is not None:
            return _EMBED_EXAMPLES
        result = []
        for text, label in _SAFETY_EXAMPLES:
            try:
                vec = await _embed_text(text)
                result.append((vec, label))
            except Exception:
                pass
        _EMBED_EXAMPLES = result
        return result


async def _embedding_classify(query: str, top_k: int = 5, threshold: float = 0.45) -> str:
    """KNN vote từ top_k examples gần nhất. Conservative = BLOCK nếu không confident."""
    try:
        query_vec = await _embed_text(query)
        examples = await _load_example_embeddings()
        if not examples:
            return "BLOCK"
        sims = sorted(
            [(_cosine_sim(query_vec, vec), label) for vec, label in examples],
            reverse=True,
        )
        if sims[0][0] < threshold:
            return "BLOCK"
        top = sims[:top_k]
        block_score = sum(s for s, label in top if label == "BLOCK")
        allow_score = sum(s for s, label in top if label == "ALLOW")
        return "BLOCK" if block_score > allow_score else "ALLOW"
    except Exception:
        return "BLOCK"


def _fold_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _current_academic_year() -> str:
    now = datetime.now()
    year, month = now.year, now.month
    return f"{year}-{year + 1}" if month >= 8 else f"{year - 1}-{year}"


def _extract_academic_year(folded: str) -> str | None:
    """Trả về '2024-2025' nếu tìm thấy cặp năm học hợp lệ, None nếu không."""
    m = _YEAR_PAIR_RE.search(folded)
    if not m:
        return None
    y1, y2 = int(m.group(1)), int(m.group(2))
    if abs(y2 - y1) == 1:
        return f"{min(y1, y2)}-{max(y1, y2)}"
    return None


def _extract_single_year(folded: str) -> str | None:
    """Extract a standalone 4-digit year (e.g., '2025') from the folded text."""
    m = re.search(r"\b(20\d{2})\b", folded)
    if m:
        return m.group(1)
    return None


def _extract_subject_from_query(folded: str) -> str | None:
    """
    Extract a subject name that follows the word "môn".
    Looks for "môn <subject>" and returns the subject if not generic.
    """
    pattern = r"mon\s+([a-zà-ỹ][a-zà-ỹ\s]*?)(?=\s+(?:%s)\b|$)" % _TERMINATOR_PATTERN
    match = re.search(pattern, folded)
    if match:
        subject = match.group(1).strip()
        # Trim trailing generic words (e.g., "học" from "môn học")
        words = subject.split()
        while words and words[-1] in _GENERIC_SUBJECT_WORDS:
            words.pop()
        if words:
            return " ".join(words)
    return None


def _has_answer_hint(folded: str) -> bool:
    return any(_fold_text(hint) in folded for hint in _ANSWER_HINTS)


def _has_temporal_qualifier(folded: str) -> bool:
    """Returns True if query already specifies which year/semester."""
    if _extract_single_year(folded) or _extract_academic_year(folded):
        return True
    if re.search(r"hoc ky \d", folded) or re.search(r"\bky \d\b", folded):
        return True
    return any(
        _fold_text(h) in folded
        for h in (*_PAST_RELATIVE_HINTS, *_CURRENT_RELATIVE_HINTS)
    )


def _detect_ambiguity_type(folded: str) -> tuple[str, str] | None:
    """
    Rule-based: returns (ambiguity_type, matched_hint) if query is ambiguous, None if clear.

    Layer 1 (active): keyword + missing-qualifier pattern matching.
    Layer 2 (placeholder): Qwen classify — swap _detect_ambiguity_type for an
    async LLM call that returns TIME/SUBJECT/PERSON/CLEAR to handle open-ended
    phrasing that keywords miss, without changing the callers.
    """
    for h in _TIME_SENSITIVE_HINTS:
        if _fold_text(h) in folded:
            if not _has_temporal_qualifier(folded):
                return ("time", h)
    for h in _SUBJECT_SENSITIVE_HINTS:
        if _fold_text(h) in folded:
            if not _extract_subject_from_query(folded):
                return ("subject", h)
    for h in _PERSON_SENSITIVE_HINTS:
        if _fold_text(h) in folded:
            return ("person", h)
    return None


def _build_clarification_message(ambiguity_type: str, matched_hint: str) -> str:
    """Build a topic-aware clarification message instead of a generic one."""
    if ambiguity_type == "time":
        return _TIME_CLARIFICATION_BY_TOPIC.get(
            matched_hint,
            CLARIFICATION_TEMPLATES["time"],
        )
    return CLARIFICATION_TEMPLATES.get(ambiguity_type, CLARIFICATION_TEMPLATES["default"])


async def check_query_clarity(query: str) -> dict | None:
    """
    Returns a clarification response dict if query is too ambiguous for RAG,
    or None if the query is specific enough to proceed.
    Skips queries already handled by the answer-hint year policy.
    """
    folded = _fold_text(query)
    if _has_answer_hint(folded):
        return None
    result = _detect_ambiguity_type(folded)
    if result is None:
        return None
    ambiguity_type, matched_hint = result
    message = _build_clarification_message(ambiguity_type, matched_hint)
    return {
        "answer": message,
        "citations": [],
        "route": "clarify",
        "clarification_type": ambiguity_type,
    }


def _classify_year_context(folded: str, current_year: str) -> str:
    """
    ALLOW    → rõ năm cũ (explicit past year hoặc relative past hint)
    BLOCK    → rõ năm hiện tại (explicit current year hoặc relative current hint)
    AMBIGUOUS → không rõ năm → để embedding classifier xử lý
    """
    explicit = _extract_academic_year(folded)
    if explicit is not None:
        return "ALLOW" if explicit != current_year else "BLOCK"
    
    single_year = _extract_single_year(folded)
    if single_year is not None:
        current_calendar_year = str(datetime.now().year)
        return "ALLOW" if single_year != current_calendar_year else "BLOCK"

    if any(_fold_text(h) in folded for h in _PAST_RELATIVE_HINTS):
        return "ALLOW"

    if any(_fold_text(h) in folded for h in _CURRENT_RELATIVE_HINTS):
        return "BLOCK"

    return "AMBIGUOUS"


async def log_policy_event(
    *,
    user: dict | None,
    question: str,
    matched_rule_id: str,
    matched_keyword: str,
    status: str = "blocked",
    audit_reason: str | None = None,
) -> None:
    conn = None
    try:
        conn = await asyncpg.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            database=POSTGRES_DB,
        )
        await conn.execute(
            """
            INSERT INTO policy_events (
              policy_key, matched_keyword, user_id, question, status, reason
            ) VALUES ($1, $2, $3, $4, $5, $6)
            """,
            RAG_POLICY_KEY,
            matched_keyword,
            (user or {}).get("userId"),
            question,
            status,
            audit_reason or matched_rule_id,
        )
    except Exception:
        return
    finally:
        if conn is not None:
            await conn.close()


async def maybe_refuse_query(query: str, user: dict | None = None) -> dict | None:
    policy = await get_rag_policy()
    if not policy.get("enabled", True):
        return None

    refusal_message = str(policy.get("safeRefusalMessage") or DEFAULT_SAFE_REFUSAL)
    folded = _fold_text(query)

    # "đáp án" / "nội dung bài thi" → check year để phân biệt năm cũ/hiện tại.
    # "lịch thi", "mẫu đề", "ôn tập" không có _ANSWER_HINTS → xuống guardrail bình thường.
    if _has_answer_hint(folded):
        current_year = _current_academic_year()
        decision = _classify_year_context(folded, current_year)
        if decision == "AMBIGUOUS":
            return {
                "answer": (
                    "Bạn muốn hỏi đáp án đề thi năm học nào? "
                    "Ví dụ: năm học 2023-2024 hay 2024-2025?"
                ),
                "citations": [],
                "route": "clarify",
                "clarification_type": "answer_year",
            }
        if decision == "BLOCK":
            await log_policy_event(
                user=user,
                question=query,
                matched_rule_id="year_policy",
                matched_keyword="answer_current_year",
                status="blocked",
                audit_reason=f"answer_hint current={current_year}",
            )
            return {
                "answer": refusal_message,
                "citations": [],
                "route": "refusal",
                "blocked_keyword": "answer_current_year",
                "blocked_rule_id": "year_policy",
                "match_layer": "year_policy",
            }
        return None

    # Không phải "đáp án" → để keyword/guardrail xử lý bình thường
    matched = await evaluate_guardrails(query, policy.get("guardrailRules"), user=user)
    if matched:
        await log_policy_event(
            user=user,
            question=query,
            matched_rule_id=matched.rule_id,
            matched_keyword=matched.matched_phrase,
            status="blocked",
            audit_reason=matched.audit_reason(),
        )
        return {
            "answer": refusal_message,
            "citations": [],
            "route": "refusal",
            "blocked_keyword": matched.matched_phrase,
            "blocked_rule_id": matched.rule_id,
            "match_layer": matched.match_layer,
            "match_score": matched.score,
        }

    return None


def retrieve_refusal_payload(refusal: dict) -> dict:
    payload: dict = {
        "citations": [],
        "route": "refusal",
        "message": refusal.get("answer") or DEFAULT_SAFE_REFUSAL,
    }
    for key in (
        "blocked_keyword",
        "blocked_rule_id",
        "match_layer",
        "match_score",
        "deny_reason",
        "denyReason",
        "refusal_type",
        "matchedRuleId",
    ):
        value = refusal.get(key)
        if value is not None:
            payload[key] = value
    return payload

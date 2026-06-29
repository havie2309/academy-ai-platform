from __future__ import annotations

import asyncio
import re
import time
import unicodedata
from datetime import datetime

import asyncpg
import httpx
import numpy as np

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
    "DEFAULT_BLACKLIST",
    "DEFAULT_SAFE_REFUSAL",
    "RAG_POLICY_KEY",
    "get_rag_policy",
    "log_policy_event",
    "match_blacklist",
    "match_guardrail_rules",
    "maybe_refuse_query",
    "normalize_guardrail_rules",
    "normalize_keywords",
    "retrieve_refusal_payload",
]

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
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{EMBEDDING_BASE_URL.rstrip('/')}/v1/embeddings",
            json={"input": text},
        )
        res.raise_for_status()
        return res.json()["data"][0]["embedding"]


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


def _has_answer_hint(folded: str) -> bool:
    return any(_fold_text(hint) in folded for hint in _ANSWER_HINTS)


def _classify_year_context(folded: str, current_year: str) -> str:
    """
    ALLOW    → rõ năm cũ (explicit past year hoặc relative past hint)
    BLOCK    → rõ năm hiện tại (explicit current year hoặc relative current hint)
    AMBIGUOUS → không rõ năm → để embedding classifier xử lý
    """
    explicit = _extract_academic_year(folded)
    if explicit is not None:
        return "ALLOW" if explicit != current_year else "BLOCK"

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
            decision = await _embedding_classify(query)
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

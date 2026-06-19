from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

_NO_INFO_PATTERNS = (
    "toi khong tim thay thong tin nay trong tai lieu duoc cung cap",
    "khong tim thay thong tin nay trong tai lieu duoc cung cap",
    "khong tim thay thong tin",
    "khong co thong tin",
)


def load_eval_cases(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def iter_eval_cases(payload: dict):
    for group_name, cases in payload.items():
        if not isinstance(cases, list):
            continue
        for case in cases:
            if isinstance(case, dict):
                yield group_name, case


def _compact_ws(text: object) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _fold(text: object) -> str:
    compact = _compact_ws(text).lower()
    normalized = unicodedata.normalize("NFD", compact)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def is_refusal_answer(answer: str) -> bool:
    folded = _fold(answer)
    return any(pattern in folded for pattern in _NO_INFO_PATTERNS)


def evaluate_response(
    response: dict,
    expected: dict,
    *,
    case_name: str = "",
    category: str = "",
) -> dict:
    answer = _compact_ws(response.get("answer"))
    citations = response.get("citations") if isinstance(response.get("citations"), list) else []
    actual_citation_chunk_ids = [
        _compact_ws(citation.get("chunk_id"))
        for citation in citations
        if _compact_ws(citation.get("chunk_id"))
    ]
    expected_citation_chunk_ids = [
        _compact_ws(chunk_id)
        for chunk_id in expected.get("citation_chunk_ids", [])
        if _compact_ws(chunk_id)
    ]
    expected_refusal = bool(expected.get("refusal", False))
    missing_terms = [
        term
        for term in expected.get("answer_contains", [])
        if _fold(term) not in _fold(answer)
    ]
    refusal_detected = is_refusal_answer(answer)

    citation_ok = actual_citation_chunk_ids == expected_citation_chunk_ids
    refusal_ok = refusal_detected == expected_refusal
    if expected_refusal and actual_citation_chunk_ids:
        refusal_ok = False
    answer_ok = not missing_terms and (
        refusal_detected if expected_refusal else bool(answer) and not refusal_detected
    )

    passed = citation_ok and refusal_ok and answer_ok
    return {
        "name": case_name,
        "category": category,
        "passed": passed,
        "citation_ok": citation_ok,
        "refusal_ok": refusal_ok,
        "answer_ok": answer_ok,
        "expected_refusal": expected_refusal,
        "answer": answer,
        "missing_terms": missing_terms,
        "actual_citation_chunk_ids": actual_citation_chunk_ids,
        "expected_citation_chunk_ids": expected_citation_chunk_ids,
    }


def summarize_results(results: list[dict]) -> dict:
    total = len(results)
    passed = sum(1 for result in results if result.get("passed"))
    answer_passed = sum(1 for result in results if result.get("answer_ok"))
    citation_passed = sum(1 for result in results if result.get("citation_ok"))

    refusal_cases = [result for result in results if result.get("expected_refusal")]
    refusal_total = len(refusal_cases)
    refusal_passed = sum(1 for result in refusal_cases if result.get("refusal_ok"))

    by_category: dict[str, dict[str, int]] = {}
    for result in results:
        category = str(result.get("category") or "unknown")
        stats = by_category.setdefault(category, {"total": 0, "passed": 0})
        stats["total"] += 1
        if result.get("passed"):
            stats["passed"] += 1

    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "answer_passed": answer_passed,
        "citation_passed": citation_passed,
        "refusal_total": refusal_total,
        "refusal_passed": refusal_passed,
        "by_category": by_category,
    }


def format_result_failure(result: dict) -> str:
    return (
        f"name={result.get('name')} "
        f"category={result.get('category')} "
        f"missing_terms={result.get('missing_terms')} "
        f"actual_citations={result.get('actual_citation_chunk_ids')} "
        f"expected_citations={result.get('expected_citation_chunk_ids')} "
        f"answer={result.get('answer')!r}"
    )

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Set

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


def _citation_ids(citations: List[dict], key: str = "chunk_id") -> Set[str]:
    """Extract a set of unique IDs from a citation list."""
    return {_compact_ws(c.get(key)) for c in citations if _compact_ws(c.get(key))}


def evaluate_response(
    response: dict,
    expected: dict,
    *,
    case_name: str = "",
    category: str = "",
) -> dict:
    """
    Evaluate a single RAG response against expected values.
    For authority cases (acceptable_doc_ids or forbidden_doc_id present),
    citation correctness is based on document IDs, not chunk IDs.
    """
    answer = _compact_ws(response.get("answer"))
    citations = response.get("citations") if isinstance(response.get("citations"), list) else []

    actual_chunk_ids = _citation_ids(citations, "chunk_id")
    actual_doc_ids = _citation_ids(citations, "doc_id")

    expected_chunk_ids = set(
        _compact_ws(cid) for cid in expected.get("citation_chunk_ids", []) if _compact_ws(cid)
    )
    expected_refusal = bool(expected.get("refusal", False))
    missing_terms = [
        term
        for term in expected.get("answer_contains", [])
        if _fold(term) not in _fold(answer)
    ]
    refusal_detected = is_refusal_answer(answer)

    # --- Citation metrics (chunk level) ---
    if not expected_chunk_ids:
        citation_ok = True
        precision = 1.0 if not actual_chunk_ids else 0.0
        recall = 1.0
    else:
        intersection = actual_chunk_ids & expected_chunk_ids
        precision = len(intersection) / len(actual_chunk_ids) if actual_chunk_ids else 0.0
        recall = len(intersection) / len(expected_chunk_ids)
        citation_ok = recall == 1.0   # all expected chunks must be cited

    # --- Refusal check ---
    refusal_ok = refusal_detected == expected_refusal
    if expected_refusal and actual_chunk_ids:
        refusal_ok = False

    # --- Answer quality ---
    answer_ok = not missing_terms and (
        refusal_detected if expected_refusal else bool(answer) and not refusal_detected
    )

    # --- Authority selection (document level) ---
    authority_ok = True
    acceptable_ids = expected.get("acceptable_doc_ids", [])
    forbidden = expected.get("forbidden_doc_id")
    
    if acceptable_ids:
        if not (set(actual_doc_ids) & set(acceptable_ids)):
            authority_ok = False
            missing_terms.append(f"missing_required_doc_{acceptable_ids}")
    if forbidden:
        if forbidden in actual_doc_ids:
            authority_ok = False
            missing_terms.append(f"found_forbidden_doc_{forbidden}")

    # --- Determine final pass ---
    # For authority cases, citation_ok is overridden by authority_ok
    is_authority_case = bool(acceptable_ids or forbidden)
    if is_authority_case:
        passed = refusal_ok and answer_ok and authority_ok
        # Keep citation metrics for stats, but don't fail on chunk mismatch
        citation_ok = True  # we don't care about chunk IDs for authority
    else:
        passed = refusal_ok and answer_ok and citation_ok

    return {
        "name": case_name,
        "category": category,
        "passed": passed,
        "citation_ok": citation_ok,
        "refusal_ok": refusal_ok,
        "answer_ok": answer_ok,
        "authority_ok": authority_ok,
        "expected_refusal": expected_refusal,
        "answer": answer,
        "missing_terms": missing_terms,
        "actual_citation_chunk_ids": sorted(actual_chunk_ids),
        "expected_citation_chunk_ids": sorted(expected_chunk_ids),
        "actual_citation_doc_ids": sorted(actual_doc_ids),
        "acceptable_doc_ids": acceptable_ids,
        "forbidden_doc_id": forbidden,
        # Metrics
        "precision": precision,
        "recall": recall,
        "f1": 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0,
    }


def summarize_results(results: list[dict]) -> dict:
    """Aggregate evaluation results with per-category and overall metrics."""
    total = len(results)
    passed = sum(1 for r in results if r.get("passed"))
    answer_passed = sum(1 for r in results if r.get("answer_ok"))
    citation_passed = sum(1 for r in results if r.get("citation_ok"))
    authority_passed = sum(1 for r in results if r.get("authority_ok"))

    refusal_cases = [r for r in results if r.get("expected_refusal")]
    refusal_total = len(refusal_cases)
    refusal_passed = sum(1 for r in refusal_cases if r.get("refusal_ok"))

    # Precision/Recall/F1 averages (overall and by category)
    precisions = [r.get("precision", 0.0) for r in results]
    recalls = [r.get("recall", 0.0) for r in results]
    f1s = [r.get("f1", 0.0) for r in results]

    avg_precision = sum(precisions) / total if total else 0.0
    avg_recall = sum(recalls) / total if total else 0.0
    avg_f1 = sum(f1s) / total if total else 0.0

    by_category: dict[str, dict[str, float | int]] = {}
    for r in results:
        cat = str(r.get("category") or "unknown")
        stats = by_category.setdefault(cat, {
            "total": 0,
            "passed": 0,
            "precision_sum": 0.0,
            "recall_sum": 0.0,
            "f1_sum": 0.0,
        })
        stats["total"] += 1
        if r.get("passed"):
            stats["passed"] += 1
        stats["precision_sum"] += r.get("precision", 0.0)
        stats["recall_sum"] += r.get("recall", 0.0)
        stats["f1_sum"] += r.get("f1", 0.0)

    # Compute averages per category
    for cat, stats in by_category.items():
        n = stats["total"]
        stats["avg_precision"] = stats["precision_sum"] / n if n else 0.0
        stats["avg_recall"] = stats["recall_sum"] / n if n else 0.0
        stats["avg_f1"] = stats["f1_sum"] / n if n else 0.0
        # Remove raw sums
        del stats["precision_sum"]
        del stats["recall_sum"]
        del stats["f1_sum"]

    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "answer_passed": answer_passed,
        "citation_passed": citation_passed,
        "authority_passed": authority_passed,
        "refusal_total": refusal_total,
        "refusal_passed": refusal_passed,
        "avg_precision": avg_precision,
        "avg_recall": avg_recall,
        "avg_f1": avg_f1,
        "by_category": by_category,
    }


def format_result_failure(result: dict) -> str:
    return (
        f"name={result.get('name')} "
        f"category={result.get('category')} "
        f"missing_terms={result.get('missing_terms')} "
        f"actual_citations={result.get('actual_citation_chunk_ids')} "
        f"expected_citations={result.get('expected_citation_chunk_ids')} "
        f"actual_docs={result.get('actual_citation_doc_ids')} "
        f"must_cite={result.get('acceptable_doc_ids')} "
        f"forbidden={result.get('forbidden_doc_id')} "
        f"precision={result.get('precision'):.2f} recall={result.get('recall'):.2f} "
        f"f1={result.get('f1'):.2f} "
        f"answer={result.get('answer')!r}"
    )


def print_summary(summary: dict) -> None:
    """Pretty-print the evaluation summary."""
    print("\n" + "=" * 80)
    print("RAG EVALUATION SUMMARY")
    print("=" * 80)
    print(f"Total cases     : {summary['total']}")
    print(f"Passed          : {summary['passed']}")
    print(f"Failed          : {summary['failed']}")
    print(f"Answer quality  : {summary['answer_passed']}/{summary['total']}")
    print(f"Citation quality: {summary['citation_passed']}/{summary['total']}")
    print(f"Authority check : {summary['authority_passed']}/{summary['total']}")
    print(f"Refusal handling: {summary['refusal_passed']}/{summary['refusal_total']} (when expected)")
    print("\n-- Overall Citation Metrics --")
    print(f"Avg Precision   : {summary['avg_precision']:.3f}")
    print(f"Avg Recall      : {summary['avg_recall']:.3f}")
    print(f"Avg F1          : {summary['avg_f1']:.3f}")

    if summary.get("by_category"):
        print("\n-- Per‑Category --")
        for cat, stats in summary["by_category"].items():
            print(f"  {cat}: passed {stats['passed']}/{stats['total']}, "
                  f"P={stats['avg_precision']:.2f} R={stats['avg_recall']:.2f} F1={stats['avg_f1']:.2f}")
    print("=" * 80)

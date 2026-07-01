#!/usr/bin/env python3
"""
Chunk quality evaluation pipeline.

This script processes all sample documents (both normal and adversarial) through the
existing chunker and produces a detailed report.

Supports: .pdf, .docx, .txt, .md, .pptx, .xlsx

Usage:
    python -m services.document_processor.tests.test_chunk_quality_eval
    python -m services.document_processor.tests.test_chunk_quality_eval --format md
    python -m services.document_processor.tests.test_chunk_quality_eval --format json
    python -m services.document_processor.tests.test_chunk_quality_eval --format both

It respects the environment variables defined in .env.example:
    CHUNK_MAX_PARENT_SIZE, CHUNK_MAX_CHILD_SIZE, CHUNK_OVERLAP
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, List, Any

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chunker import chunk_document_parent_child, _HEADER_PATTERNS
from app.extract import extract_text
from app.config import (
    CHUNK_MAX_PARENT_SIZE,
    CHUNK_MAX_CHILD_SIZE,
    CHUNK_OVERLAP,
)

# Directory containing sample documents
SAMPLE_DOCS_DIR = Path(__file__).resolve().parents[3] / "data" / "sample-docs"
NORMAL_DIR = SAMPLE_DOCS_DIR / "normal"
ADVERSARIAL_DIR = SAMPLE_DOCS_DIR / "adversarial"

_SENTENCE_END_PUNCTUATION = {'.', '!', '?'}

# Vietnamese diacritic characters (lowercase and uppercase)
_VIETNAMESE_DIACRITICS = set(
    "áàảãạâầẩẫậăằẳẵặđéèẻẽẹêềểễệíìỉĩịóòỏõọôồổỗộơờởỡợúùủũụưừửữựýỳỷỹỵ"
    "ÁÀẢÃẠÂẦẨẪẬĂẰẲẴẶĐÉÈẺẼẸÊỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỒỔỖỘƠỜỞỠỢÚÙỦŨỤƯỪỬỮỰÝỲỶỸỴ"
)


def is_sentence_end(text: str) -> bool:
    """Return True if the stripped text ends with a sentence-ending punctuation."""
    text = text.strip()
    if not text:
        return False
    return text[-1] in _SENTENCE_END_PUNCTUATION


def ends_with_heading(text: str) -> bool:
    """
    Return True if the last non-empty line of text matches any structural heading pattern.
    Uses the same patterns as the chunker.
    """
    lines = text.splitlines()
    last_line = ""
    for line in reversed(lines):
        if line.strip():
            last_line = line.strip()
            break
    if not last_line:
        return False
    for _level, pattern in _HEADER_PATTERNS:
        if pattern.match(last_line):
            return True
    return False


def count_headings(text: str) -> int:
    """Count lines that look like structural headings, using the chunker's own patterns."""
    lines = text.split("\n")
    count = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        for _level, pattern in _HEADER_PATTERNS:
            if pattern.match(stripped):
                count += 1
                break
    return count


def count_vietnamese_diacritics(text: str) -> int:
    """Count Vietnamese diacritic characters in the text."""
    return sum(1 for c in text if c in _VIETNAMESE_DIACRITICS)


def diacritic_density(text: str) -> float:
    """Compute ratio of diacritic characters to total alphabetic characters."""
    alphabetic = sum(1 for c in text if c.isalpha())
    if alphabetic == 0:
        return 0.0
    diacritics = count_vietnamese_diacritics(text)
    return diacritics / alphabetic


def evaluate_document(
    file_path: Path,
    include_samples: bool = True,
    max_parent_samples: int = 3,
    max_child_samples: int = 5,
) -> Dict[str, Any]:
    """
    Evaluate chunk quality for a single document.
    Checks structural integrity, mid-sentence cuts, and diacritic quality for scanned PDFs.
    """
    is_adversarial = "adversarial" in str(file_path.parent).lower()
    is_pdf = file_path.suffix.lower() == ".pdf"

    try:
        raw_text = extract_text(str(file_path), mime_type="")
    except Exception as e:
        return {
            "document_name": file_path.name,
            "file_path": str(file_path.relative_to(Path.cwd())),
            "is_adversarial": is_adversarial,
            "error": f"Extraction failed: {e}",
        }

    if not raw_text.strip():
        return {
            "document_name": file_path.name,
            "file_path": str(file_path.relative_to(Path.cwd())),
            "is_adversarial": is_adversarial,
            "error": "Empty extracted text",
        }

    # Compute diacritic metrics (especially useful for scanned PDFs)
    diacritic_count = count_vietnamese_diacritics(raw_text)
    diacritic_density_value = diacritic_density(raw_text)

    total_headings = count_headings(raw_text)

    try:
        result = chunk_document_parent_child(
            raw_text,
            max_child_size=CHUNK_MAX_CHILD_SIZE,
            max_parent_size=CHUNK_MAX_PARENT_SIZE,
            overlap=CHUNK_OVERLAP,
        )
    except Exception as e:
        return {
            "document_name": file_path.name,
            "file_path": str(file_path.relative_to(Path.cwd())),
            "is_adversarial": is_adversarial,
            "error": f"Chunking failed: {e}",
            "diacritic_density": round(diacritic_density_value, 3),
            "diacritic_count": diacritic_count,
        }

    parent_nodes = result.get("parent_nodes", [])
    child_nodes = result.get("child_nodes", [])
    num_parents = len(parent_nodes)
    num_children = len(child_nodes)

    if num_children == 0:
        return {
            "document_name": file_path.name,
            "file_path": str(file_path.relative_to(Path.cwd())),
            "is_adversarial": is_adversarial,
            "error": "No child chunks generated",
            "diacritic_density": round(diacritic_density_value, 3),
            "diacritic_count": diacritic_count,
        }

    child_sizes = [len(child.get("text", "")) for child in child_nodes]
    parent_sizes = [len(parent.get("text", "")) for parent in parent_nodes]

    # Structural checks
    section_path_present_parent = all(
        bool(parent.get("metadata", {}).get("section_path"))
        for parent in parent_nodes
    )
    section_path_present_child = all(
        bool(child.get("metadata", {}).get("section_path"))
        for child in child_nodes
    )
    parent_preview_present = all(
        bool(child.get("metadata", {}).get("parent_preview"))
        for child in child_nodes
    )
    parent_id_valid = all(
        child.get("parent_id") and any(p.get("id") == child.get("parent_id") for p in parent_nodes)
        for child in child_nodes
    )

    headings_in_parents = sum(
        count_headings(parent.get("text", "")) for parent in parent_nodes
    )
    heading_detection_ratio = (
        headings_in_parents / total_headings if total_headings > 0 else 1.0
    )

    has_headings = total_headings > 0

    # Mid-sentence cuts detection
    mid_sentence_cuts = 0
    mid_sentence_chunk_ids = []
    for i, child in enumerate(child_nodes):
        if i == len(child_nodes) - 1:
            break
        child_text = child.get("text", "").strip()
        if not child_text:
            continue
        if ends_with_heading(child_text):
            continue
        meta = child.get("metadata", {})
        section_path = meta.get("section_path", "")
        if section_path == "Document Title" or "Document Title" in section_path:
            continue
        if not is_sentence_end(child_text):
            mid_sentence_cuts += 1
            mid_sentence_chunk_ids.append(child.get("id"))

    errors = []

    # Structural errors
    if has_headings:
        if not section_path_present_parent:
            errors.append("Some parents missing section_path (headings detected but not captured)")
        if not section_path_present_child:
            errors.append("Some children missing section_path (headings detected but not captured)")
        if heading_detection_ratio < 0.5:
            errors.append(
                f"Low heading detection: {headings_in_parents}/{total_headings} headings captured"
            )
    else:
        heading_detection_ratio = 1.0

    if not parent_preview_present:
        errors.append("Some children missing parent_preview")
    if not parent_id_valid:
        errors.append("Some children have invalid parent_id")

    if mid_sentence_cuts > 0:
        errors.append(f"Mid-sentence cuts: {mid_sentence_cuts} chunks (e.g. {', '.join(mid_sentence_chunk_ids[:3])})")

    # Diacritic quality check (only for PDFs, as OCR may be involved)
    if is_pdf:
        # Vietnamese documents typically have > 2% diacritic density
        # Scanned PDFs with poor OCR may drop below 0.5%
        if diacritic_density_value < 0.005:
            errors.append(
                f"Very low diacritic density ({diacritic_density_value:.3f}) – OCR may have failed or text is not Vietnamese"
            )
        elif diacritic_density_value < 0.02:
            errors.append(
                f"Low diacritic density ({diacritic_density_value:.3f}) – OCR quality may be suboptimal"
            )

    result_dict = {
        "document_name": file_path.name,
        "file_path": str(file_path.relative_to(Path.cwd())),
        "is_adversarial": is_adversarial,
        "num_parents": num_parents,
        "num_children": num_children,
        "avg_child_size": round(sum(child_sizes) / num_children, 1) if child_sizes else 0,
        "max_child_size": max(child_sizes) if child_sizes else 0,
        "min_child_size": min(child_sizes) if child_sizes else 0,
        "avg_parent_size": round(sum(parent_sizes) / num_parents, 1) if parent_sizes else 0,
        "max_parent_size": max(parent_sizes) if parent_sizes else 0,
        "section_path_presence_parent": section_path_present_parent,
        "section_path_presence_child": section_path_present_child,
        "parent_preview_presence": parent_preview_present,
        "heading_detection_ratio": round(heading_detection_ratio, 2),
        "mid_sentence_cuts": mid_sentence_cuts,
        "diacritic_count": diacritic_count,
        "diacritic_density": round(diacritic_density_value, 3),
        "errors": errors,
    }

    if include_samples:
        samples = {
            "parents": [
                {
                    "id": p.get("id"),
                    "section_path": p.get("metadata", {}).get("section_path", ""),
                    "text": p.get("text", ""),
                    "child_count": len(p.get("child_ids", [])),
                }
                for p in parent_nodes[:max_parent_samples]
            ],
            "children": [
                {
                    "id": c.get("id"),
                    "parent_id": c.get("parent_id"),
                    "section_path": c.get("metadata", {}).get("section_path", ""),
                    "parent_preview": c.get("metadata", {}).get("parent_preview", "")[:200],
                    "text": c.get("text", ""),
                    "index": c.get("index"),
                }
                for c in child_nodes[:max_child_samples]
            ],
        }
        result_dict["samples"] = samples

    # Debug dump for structural errors
    if has_headings and (not section_path_present_parent or not section_path_present_child):
        debug_dir = Path("eval/debug")
        debug_dir.mkdir(parents=True, exist_ok=True)
        debug_file = debug_dir / f"{file_path.stem}_debug.txt"
        with open(debug_file, "w", encoding="utf-8") as f:
            f.write(f"=== RAW EXTRACTED TEXT ===\n")
            f.write(raw_text)
            f.write(f"\n\n=== PARENT METADATA ===\n")
            for p in parent_nodes:
                f.write(f"ID: {p.get('id')}\n")
                f.write(f"  section_path: {p.get('metadata', {}).get('section_path')}\n")
                f.write(f"  text preview: {p.get('text', '')}\n")
                f.write(f"  child_ids: {p.get('child_ids')}\n\n")
            f.write(f"\n=== CHILD METADATA ===\n")
            for c in child_nodes:
                f.write(f"ID: {c.get('id')}\n")
                f.write(f"  parent_id: {c.get('parent_id')}\n")
                f.write(f"  section_path: {c.get('metadata', {}).get('section_path')}\n")
                f.write(f"  text preview: {c.get('text', '')}\n\n")
        print(f"  [DEBUG] Dumped raw data to {debug_file}")

    return result_dict


def evaluate_corpus(doc_paths: List[Path], include_samples: bool = True) -> Dict[str, Any]:
    """Evaluate all documents in the given list."""
    results = []
    supported_extensions = {".pdf", ".docx", ".txt", ".md", ".pptx", ".xlsx"}
    for path in doc_paths:
        if path.suffix.lower() not in supported_extensions:
            continue
        res = evaluate_document(path, include_samples=include_samples)
        results.append(res)

    total = len(results)
    with_errors = [r for r in results if r.get("errors")]
    adversarial = [r for r in results if r.get("is_adversarial")]
    total_mid_sentence_cuts = sum(r.get("mid_sentence_cuts", 0) for r in results)
    total_diacritic_density = sum(r.get("diacritic_density", 0) for r in results)

    summary = {
        "total_documents": total,
        "documents_with_errors": len(with_errors),
        "adversarial_count": len(adversarial),
        "average_heading_detection": round(
            sum(r.get("heading_detection_ratio", 0) for r in results) / total if total else 0, 2
        ),
        "average_child_size": round(
            sum(r.get("avg_child_size", 0) for r in results) / total if total else 0, 1
        ),
        "average_parent_size": round(
            sum(r.get("avg_parent_size", 0) for r in results) / total if total else 0, 1
        ),
        "total_mid_sentence_cuts": total_mid_sentence_cuts,
        "average_mid_sentence_cuts": round(total_mid_sentence_cuts / total if total else 0, 2),
        "average_diacritic_density": round(total_diacritic_density / total if total else 0, 3),
        "results": results,
    }
    return summary


def generate_markdown(summary: Dict[str, Any], output_path: Path) -> None:
    """Generate a human-readable Markdown report."""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Chunk Quality Evaluation Report\n\n")

        f.write("## Summary\n\n")
        f.write("| Metric | Value |\n")
        f.write("|--------|-------|\n")
        f.write(f"| Total Documents | {summary['total_documents']} |\n")
        f.write(f"| Documents with Errors | {summary['documents_with_errors']} |\n")
        f.write(f"| Adversarial Documents | {summary['adversarial_count']} |\n")
        f.write(f"| Average Heading Detection | {summary['average_heading_detection']} |\n")
        f.write(f"| Average Child Size (chars) | {summary['average_child_size']} |\n")
        f.write(f"| Average Parent Size (chars) | {summary['average_parent_size']} |\n")
        f.write(f"| Total Mid-Sentence Cuts | {summary['total_mid_sentence_cuts']} |\n")
        f.write(f"| Average Mid-Sentence Cuts per Doc | {summary['average_mid_sentence_cuts']} |\n")
        f.write(f"| Average Diacritic Density (OCR quality proxy) | {summary['average_diacritic_density']} |\n")
        f.write("\n---\n\n")

        f.write("## Per-Document Results\n\n")

        for idx, doc in enumerate(summary["results"], 1):
            f.write(f"### {idx}. {doc['document_name']}\n\n")

            f.write("**Metadata:**\n")
            f.write(f"- Path: `{doc['file_path']}`\n")
            f.write(f"- Adversarial: `{doc.get('is_adversarial', False)}`\n")
            if "error" in doc:
                f.write(f"- **ERROR**: {doc['error']}\n\n")
                continue

            f.write("**Statistics:**\n")
            f.write(f"- Parents: {doc['num_parents']}, Children: {doc['num_children']}\n")
            f.write(f"- Child size (avg/min/max): {doc['avg_child_size']} / {doc['min_child_size']} / {doc['max_child_size']}\n")
            f.write(f"- Parent size (avg/max): {doc['avg_parent_size']} / {doc['max_parent_size']}\n")
            f.write(f"- Heading detection ratio: {doc['heading_detection_ratio']}\n")
            f.write(f"- Section path present (parents): {doc['section_path_presence_parent']}\n")
            f.write(f"- Section path present (children): {doc['section_path_presence_child']}\n")
            f.write(f"- Parent preview present: {doc['parent_preview_presence']}\n")
            f.write(f"- Mid-sentence cuts: {doc.get('mid_sentence_cuts', 0)}\n")
            f.write(f"- Diacritic count: {doc.get('diacritic_count', 0)}\n")
            f.write(f"- Diacritic density: {doc.get('diacritic_density', 0.0):.3f}\n")

            if doc.get("errors"):
                f.write("\n**Errors:**\n")
                for err in doc["errors"]:
                    f.write(f"- ❌ {err}\n")

            if "samples" in doc:
                samples = doc["samples"]
                if samples["parents"]:
                    f.write("\n**Parent Chunk Samples:**\n")
                    for p in samples["parents"]:
                        f.write(f"\n- **ID:** `{p['id']}`\n")
                        f.write(f"  - **Section Path:** `{p['section_path']}`\n")
                        f.write(f"  - **Child Count:** {p['child_count']}\n")
                        f.write("  - **Text:**\n")
                        f.write(f"```text\n{p['text']}\n```\n")

                if samples["children"]:
                    f.write("\n**Child Chunk Samples:**\n")
                    for c in samples["children"]:
                        f.write(f"\n- **ID:** `{c['id']}`\n")
                        f.write(f"  - **Parent ID:** `{c['parent_id']}`\n")
                        f.write(f"  - **Section Path:** `{c['section_path']}`\n")
                        f.write(f"  - **Index:** {c['index']}\n")
                        f.write("  - **Text:**\n")
                        f.write(f"```text\n{c['text']}\n```\n")

            f.write("\n---\n\n")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Evaluate chunk quality on sample documents.")
    parser.add_argument(
        "--output",
        default="eval/chunk_quality_report",
        help="Output file base name (without extension). Default: eval/chunk_quality_report",
    )
    parser.add_argument(
        "--normal-only",
        action="store_true",
        help="Only evaluate normal documents (exclude adversarial)",
    )
    parser.add_argument(
        "--format",
        choices=["json", "md", "both"],
        default="both",
        help="Output format: json, md, or both. Default: both",
    )
    args = parser.parse_args()

    doc_paths = []
    if NORMAL_DIR.exists():
        doc_paths.extend(NORMAL_DIR.glob("*.*"))
    if not args.normal_only and ADVERSARIAL_DIR.exists():
        doc_paths.extend(ADVERSARIAL_DIR.glob("*.*"))

    if not doc_paths:
        print("No sample documents found.", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(doc_paths)} documents. Evaluating...")
    summary = evaluate_corpus(doc_paths, include_samples=True)

    output_base = Path(args.output)
    output_base.parent.mkdir(parents=True, exist_ok=True)

    if args.format in ("json", "both"):
        json_path = output_base.with_suffix(".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        print(f"JSON report saved to {json_path}")

    if args.format in ("md", "both"):
        md_path = output_base.with_suffix(".md")
        generate_markdown(summary, md_path)
        print(f"Markdown report saved to {md_path}")

    print(f"\nSummary: {summary['total_documents']} documents, "
          f"{summary['documents_with_errors']} with errors, "
          f"average heading detection {summary['average_heading_detection']}, "
          f"total mid-sentence cuts {summary['total_mid_sentence_cuts']}, "
          f"average diacritic density {summary['average_diacritic_density']:.3f}")


if __name__ == "__main__":
    main()

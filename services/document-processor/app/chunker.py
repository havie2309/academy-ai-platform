from __future__ import annotations

import re
import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    text: str
    metadata: dict
    section_path: str = ""


_HEADER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    # Markdown headings — MarkItDown DOCX/HTML output
    ("l1", re.compile(r"^#\s+\S")),
    ("l2", re.compile(r"^##\s+\S")),
    ("l3", re.compile(r"^###\s+\S")),
    ("l4", re.compile(r"^####\s+\S")),
    # Vietnamese legal structure
    ("l1", re.compile(r"^(?:Phần|Phan)\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    ("l2", re.compile(r"^(?:Chương|Chuong)\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    ("l3", re.compile(r"^(?:Điều|Dieu)\s+\d+\b", re.IGNORECASE)),
    ("l4", re.compile(r"^(?:Mục|Muc)\s+\d+\b", re.IGNORECASE)),
    # English legal / academic structure
    ("l1", re.compile(r"^Part\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    ("l2", re.compile(r"^Chapter\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    ("l3", re.compile(r"^Section\s+\d+(?:\.\d+)?\b", re.IGNORECASE)),
    # Numbered sections — "1.1." → l2, "1.1.1." → l3  (single "1." too ambiguous)
    ("l2", re.compile(r"^\d+\.\d+\.\s+\S")),
    ("l3", re.compile(r"^\d+\.\d+\.\d+\.\s+\S")),
)

_LEVEL_CLEARS: dict[str, tuple[str, ...]] = {
    "l1": ("l2", "l3", "l4"),
    "l2": ("l3", "l4"),
    "l3": ("l4",),
    "l4": (),
}


def _match_header(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped:
        return None
    for level, pattern in _HEADER_PATTERNS:
        if pattern.match(stripped):
            return level, stripped
    return None


def _format_section_path(path: dict[str, str]) -> str:
    parts = [path[key] for key in ("l1", "l2", "l3", "l4") if path.get(key)]
    return " > ".join(parts)


def _split_into_sections(text: str) -> list[dict]:
    """Split a document into structural sections with stable section paths."""
    lines = text.replace("\r\n", "\n").split("\n")
    path: dict[str, str] = {"l1": "", "l2": "", "l3": "", "l4": ""}
    sections: list[dict] = []
    buffer: list[str] = []
    active_level = ""
    found_structure = False

    def flush() -> None:
        body = "\n".join(buffer).strip()
        if not body:
            return
        section_path = _format_section_path(path)
        sections.append(
            {
                "text": body,
                "metadata": {
                    "section_path": section_path,
                    "headers": [part for part in section_path.split(" > ") if part],
                    "section_type": active_level,
                    "chapter_header": path.get("l2") or path.get("l1") or "",
                },
            }
        )

    for line in lines:
        header = _match_header(line)
        if header:
            found_structure = True
            flush()
            buffer = []
            level, title = header
            for clear_level in _LEVEL_CLEARS[level]:
                path[clear_level] = ""
            path[level] = title
            active_level = level
            buffer.append(line.strip())
            continue
        buffer.append(line)

    flush()

    if not found_structure:
        cleaned = text.strip()
        return (
            [
                {
                    "text": cleaned,
                    "metadata": {
                        "section_path": "",
                        "headers": [],
                        "section_type": "",
                        "chapter_header": "",
                    },
                }
            ]
            if cleaned
            else []
        )
    return sections


def _with_section_prefix(body: str, section_path: str) -> str:
    if not section_path:
        return body
    return f"{section_path}\n\n{body}"


def chunk_document(
    text: str,
    max_size: int = 500,
    overlap_ratio: float = 0.2,
) -> list[Chunk]:
    """
    Backward-compatible structure-aware chunking for existing tests/tooling.

    The parent-child ingest path below uses `_split_into_sections`, but some
    tests and fallback code still expect the older `chunk_document` contract.
    """
    cleaned = text.replace("\r\n", "\n").strip()
    if not cleaned:
        return []

    sections = _split_into_sections(cleaned)
    if not sections:
        return []

    if len(sections) == 1 and not sections[0]["metadata"]["section_path"]:
        return [
            Chunk(text=piece, metadata={}, section_path="")
            for piece in chunk_by_length(cleaned, max_size, overlap_ratio)
        ]

    result: list[Chunk] = []
    for section in sections:
        section_path = section["metadata"]["section_path"]
        body = section["text"]
        if len(body) <= max_size:
            result.append(
                Chunk(
                    text=_with_section_prefix(body, section_path),
                    metadata={"section_path": section_path},
                    section_path=section_path,
                )
            )
            continue
        for piece in chunk_by_length(body, max_size, overlap_ratio):
            result.append(
                Chunk(
                    text=_with_section_prefix(piece, section_path),
                    metadata={"section_path": section_path},
                    section_path=section_path,
                )
            )
    return result


def chunk_text(text: str, max_size: int = 400, overlap_ratio: float = 0.1) -> list[str]:
    return [chunk.text for chunk in chunk_document(text, max_size, overlap_ratio)]


def chunk_document_parent_child(
    text: str,
    max_child_size: int = 200,
    max_parent_size: int = 1000,
    overlap: float = 0.1,
) -> dict:
    """
    Parent-child chunking for academic documents.

    Parent nodes keep section-level context in MongoDB, while child nodes stay
    small for embedding and Milvus lookup.
    **Note**: 'Phan' / 'Chuong' sections are now processed (they were previously skipped).
    They will create a parent node truncated to `max_parent_size` to avoid loss of content.
    """
    cleaned = text.replace("\r\n", "\n").strip()
    if not cleaned:
        return {"parent_nodes": [], "child_nodes": []}

    sections = _split_into_sections(cleaned)
    parent_nodes: list[dict] = []
    child_nodes: list[dict] = []

    for section in sections:
        metadata = section["metadata"]
        section_type = metadata.get("section_type", "")
        section_text = section["text"].strip()

        if not section_text:
            continue

        # All sections, including 'phan' and 'chuong', are processed.
        parent_id = f"parent-{uuid.uuid4().hex[:8]}"
        parent_text = (
            f"{section_text[:max_parent_size]}..."
            if len(section_text) > max_parent_size
            else section_text
        )
        parent_preview = parent_text[:200]

        parent_nodes.append(
            {
                "id": parent_id,
                "text": parent_text,
                "metadata": {
                    **metadata,
                    "chunk_type": "parent",
                    "full_text": section_text[:500],
                    "original_length": len(section_text),
                },
                "child_ids": [],
            }
        )

        child_chunks = chunk_by_length(section_text, max_child_size, overlap)
        for idx, child_text in enumerate(child_chunks):
            if not child_text.strip():
                continue
            child_id = f"child-{uuid.uuid4().hex[:8]}"
            child_nodes.append(
                {
                    "id": child_id,
                    "parent_id": parent_id,
                    "text": child_text,
                    "index": idx,
                    "metadata": {
                        **metadata,
                        "chunk_type": "child",
                        "parent_id": parent_id,
                        "chunk_index": idx,
                        "parent_preview": parent_preview,
                    },
                }
            )
            parent_nodes[-1]["child_ids"].append(child_id)

    return {"parent_nodes": parent_nodes, "child_nodes": child_nodes}


# ============================================================
#  Word-boundary helpers
# ============================================================

_BOUNDARY_RE = re.compile(r'[\s\.,;!?:"\'()\-]')


def _prev_word_boundary(text: str, pos: int) -> int:
    """
    Return the index of the last whitespace or punctuation character before `pos`.
    If none is found, return 0.
    """
    match = _BOUNDARY_RE.search(text[:pos][::-1])
    if match:
        return pos - 1 - match.start()
    return 0


def _next_word_boundary(text: str, pos: int) -> int:
    """
    Return the smallest index >= pos that is a whitespace or punctuation character.
    If none is found, return len(text).
    """
    match = _BOUNDARY_RE.search(text[pos:])
    if match:
        return pos + match.start()
    return len(text)


def chunk_by_length(text: str, max_size: int, overlap_ratio: float = 0.1) -> list[str]:
    """
    Split text into chunks of approximately `max_size` characters,
    with overlap, and ensure no chunk cuts a word in half.

    If the entire text is shorter than or equal to max_size, it is returned as one chunk.
    """
    if not text:
        return []

    text = text.strip()
    if not text:
        return []

    # If the whole text fits in one chunk, return it as is.
    if len(text) <= max_size:
        return [text]

    overlap = max(0, int(max_size * overlap_ratio))
    # Limit overlap to at most half of max_size to avoid excessive overlapping.
    overlap = min(overlap, max_size // 2)

    chunks: list[str] = []
    start = 0
    text_len = len(text)

    while start < text_len:
        # Tentative end
        tentative_end = min(start + max_size, text_len)

        # Adjust end to the last boundary before or at tentative_end
        boundary_idx = _prev_word_boundary(text, tentative_end)
        if boundary_idx > start:
            end = boundary_idx + 1  # include the boundary character
        else:
            # No boundary found, fallback to tentative_end
            end = tentative_end

        # Ensure we don't go past text length
        if end > text_len:
            end = text_len

        # Extract chunk and strip
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # If we've reached the end, break
        if end >= text_len:
            break

        # Prepare next start with overlap, but ensure we always advance at least 1.
        next_start = end - overlap
        if next_start <= start:
            next_start = start + 1
        next_start = _next_word_boundary(text, next_start)
        if next_start <= start:
            next_start = start + 1

        # Safety: if the next_start is not less than text_len, break to avoid infinite loop.
        if next_start >= text_len:
            # Take the remaining text as the last chunk
            remaining = text[start:].strip()
            if remaining:
                chunks.append(remaining)
            break

        start = next_start

    return chunks
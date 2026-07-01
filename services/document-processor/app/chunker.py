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
        # If we haven't seen any structure yet, this is the document title/intro
        if not found_structure and not any(path.values()):
            section_path = "Document Title"  # Or "Introduction" / "Preface"
            section_type = "title"
        else:
            section_path = _format_section_path(path)
            section_type = active_level
        
        sections.append({
            "text": body,
            "metadata": {
                "section_path": section_path,
                "headers": [part for part in section_path.split(" > ") if part],
                "section_type": section_type,
                "chapter_header": path.get("l2") or path.get("l1") or "",
            },
        })

    for line in lines:
        header = _match_header(line)
        if header:
            flush()
            found_structure = True
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


# ============================================================
#  Text cleaning helpers
# ============================================================

def _clean_markdown_and_whitespace(text: str) -> str:
    """
    Clean text for child chunks (embedding & retrieval).
    Removes all Markdown syntax while preserving the underlying text.
    """
    # 1. Remove code blocks (``` ... ```) but keep the content inside.
    #    We do this first to avoid interfering with inline backticks.
    text = re.sub(r'```[\s\S]*?```', lambda m: m.group(0).strip('`').strip(), text)
    # Also handle ~~~ code blocks
    text = re.sub(r'~~~[\s\S]*?~~~', lambda m: m.group(0).strip('~').strip(), text)

    # 2. Remove inline code (`code`) -> keep code text.
    text = re.sub(r'`([^`]+)`', r'\1', text)

    # 3. Remove image syntax ![alt](url) -> keep alt text if present.
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', r'\1', text)

    # 4. Remove link syntax [text](url) -> keep link text.
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)

    # 5. Remove bold/italic markers: **, __, *, _ (but keep the text).
    #    Important: do not remove asterisks used as bullet points or multiplication.
    #    We only remove when they are paired and immediately adjacent to word characters.
    #    Simple approach: remove all ** and __ pairs.
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'__(.+?)__', r'\1', text)      # __bold__
    text = re.sub(r'\*(.+?)\*', r'\1', text)      # *italic*
    text = re.sub(r'_(.+?)_', r'\1', text)        # _italic_

    # 6. Remove heading markers (#, ##, ###, etc.) - already covered, but ensure it's done.
    text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)

    # 7. Remove horizontal rules: ---, ***, ___
    text = re.sub(r'^[-\*_]{3,}\s*$', '', text, flags=re.MULTILINE)

    # 8. Remove extra spaces and newlines to save tokens.
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            # Collapse multiple spaces within the line to single spaces
            stripped = re.sub(r' +', ' ', stripped)
            cleaned_lines.append(stripped)
        # else skip completely empty lines to save tokens

    # Join with a single newline (preserves sentence boundaries, saves tokens)
    result = '\n'.join(cleaned_lines)
    # Collapse multiple newlines to a single newline (just in case)
    result = re.sub(r'\n{2,}', '\n', result)
    return result.strip()


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

    - Parent nodes keep raw text (including Markdown headers) for LLM grounding.
    - Child nodes are cleaned of Markdown syntax for cleaner embedding/retrieval.
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
        
        # Raw text for the parent (keeps Markdown headers like '## Điều 1')
        raw_section_text = section["text"].strip()
        if not raw_section_text:
            continue

        # Cleaned text for child chunks (removes Markdown markers)
        clean_section_text = _clean_markdown_and_whitespace(raw_section_text)

        parent_id = f"parent-{uuid.uuid4().hex[:8]}"
        parent_text = (
            f"{raw_section_text[:max_parent_size]}..."
            if len(raw_section_text) > max_parent_size
            else raw_section_text
        )
        parent_preview = parent_text[:200]

        parent_nodes.append(
            {
                "id": parent_id,
                "text": parent_text,  # RAW: Contains Markdown headers (##, ###)
                "metadata": {
                    **metadata,
                    "chunk_type": "parent",
                    "full_text": raw_section_text[:500],
                    "original_length": len(raw_section_text),
                },
                "child_ids": [],
            }
        )

        # Child chunks are generated from the CLEANED text
        child_chunks = chunk_by_length(clean_section_text, max_child_size, overlap)
        for idx, child_text in enumerate(child_chunks):
            if not child_text.strip():
                continue
            child_id = f"child-{uuid.uuid4().hex[:8]}"
            child_nodes.append(
                {
                    "id": child_id,
                    "parent_id": parent_id,
                    "text": child_text,  # CLEAN: No Markdown markers, minimal whitespace
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


# ============================================================
#  Sentence-boundary detection (new)
# ============================================================

# Patterns for sentence boundaries: strong (.!? followed by whitespace or end)
_SENTENCE_STRONG = re.compile(r'[.!?]\s+')
# Medium (;: followed by whitespace)
_SENTENCE_MEDIUM = re.compile(r'[;:]\s+')
# Weak (comma followed by whitespace)
_SENTENCE_WEAK = re.compile(r',\s+')


def _find_sentence_boundary(
    text: str,
    start: int,
    max_size: int,
    grace_ratio: float = 0.2,
) -> int:
    """
    Find the best cut point near `start + max_size`.
    Prefers (in order):
      1. Last strong boundary (.!?) before target (within grace zone)
      2. First strong boundary after target
      3. Last medium boundary before target
      4. First medium boundary after target
      5. Last weak boundary before target
      6. First weak boundary after target
      7. Fallback to word/punctuation boundary (including punctuation in the chunk)
    """
    target = start + max_size
    lower = start + int(max_size * (1 - grace_ratio))
    upper = start + int(max_size * (1 + grace_ratio))
    text_len = len(text)

    if lower < 0:
        lower = 0
    if upper > text_len:
        upper = text_len
    if target > text_len:
        target = text_len

    def last_match(pattern: re.Pattern, lower: int, upper: int):
        segment = text[lower:upper]
        matches = list(pattern.finditer(segment))
        if not matches:
            return None
        m = matches[-1]
        return lower + m.end()

    def first_match(pattern: re.Pattern, target: int, upper: int):
        segment = text[target:upper]
        m = pattern.search(segment)
        if not m:
            return None
        return target + m.end()

    # 1. Strong before
    pos = last_match(_SENTENCE_STRONG, lower, target)
    if pos is not None:
        return pos

    # 2. Strong after
    pos = first_match(_SENTENCE_STRONG, target, upper)
    if pos is not None:
        return pos

    # 3. Medium before
    pos = last_match(_SENTENCE_MEDIUM, lower, target)
    if pos is not None:
        return pos

    # 4. Medium after
    pos = first_match(_SENTENCE_MEDIUM, target, upper)
    if pos is not None:
        return pos

    # 5. Weak before
    pos = last_match(_SENTENCE_WEAK, lower, target)
    if pos is not None:
        return pos

    # 6. Weak after
    pos = first_match(_SENTENCE_WEAK, target, upper)
    if pos is not None:
        return pos

    # 7. Fallback: word/punctuation boundary
    # Find the last boundary before or at target
    pos = _prev_word_boundary(text, target)
    
    # CRITICAL FIX: If the boundary is a punctuation mark, include it in the chunk
    if 0 < pos < text_len and text[pos] in ".,;!?:)":
        pos = pos + 1
    
    if pos <= start:
        # No boundary found before target; cut at target (but ensure we don't go past upper)
        pos = min(target, upper)
        if pos <= start:
            pos = min(text_len, start + max_size)
    return pos


def chunk_by_length(text: str, max_size: int, overlap_ratio: float = 0.1) -> list[str]:
    """
    Split text into chunks of approximately `max_size` characters,
    with overlap, and with strong preference for sentence boundaries.
    Avoids duplication and isolated punctuation chunks.
    """
    if not text:
        return []

    text = text.strip()
    if not text:
        return []

    if len(text) <= max_size:
        return [text]

    overlap = max(0, int(max_size * overlap_ratio))
    overlap = min(overlap, max_size // 2)

    chunks: list[str] = []
    start = 0
    text_len = len(text)

    while start < text_len:
        # Find best cut point using sentence-boundary logic
        end = _find_sentence_boundary(text, start, max_size, grace_ratio=0.2)

        # Safety: ensure we make progress and don't cut mid‑word
        if end <= start:
            end = min(start + max_size, text_len)
            # Try to find a boundary after end to avoid mid-word cut
            next_boundary = _next_word_boundary(text, end)
            if next_boundary > end and next_boundary < text_len:
                end = next_boundary
            # else keep end as exact character count (fallback for no-boundary text)
            if end <= start:
                end = min(text_len, start + max_size)
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= text_len:
            break

        # Check if remaining text is only the overlap portion
        remaining = text_len - end
        if remaining <= overlap:
            remaining_text = text[end:].strip()
            if remaining_text:
                # If the remaining text is short (likely punctuation or a fragment),
                # append it to the last chunk instead of creating a new one.
                if len(remaining_text) < 10 and any(c in ".,;!?:)" for c in remaining_text):
                    if chunks:
                        chunks[-1] = chunks[-1] + " " + remaining_text
                    else:
                        chunks.append(remaining_text)
                else:
                    chunks.append(remaining_text)
            break

        # Compute next start with overlap, but ensure we don't go backwards
        next_start = end - overlap
        if next_start <= start:
            next_start = end  # No overlap, just move forward

        # Align to a word boundary for clean start, but only if it doesn't skip to the end
        next_boundary = _next_word_boundary(text, next_start)
        if next_boundary > next_start and next_boundary < text_len:
            next_start = next_boundary
        # else keep the raw next_start (may be mid-word, but that's okay for texts without boundaries)

        if next_start <= start:
            next_start = start + 1

        start = next_start

    return chunks

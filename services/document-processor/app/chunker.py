"""Document chunking: structure-aware split (Chương/Điều/Mục) then recursive size split."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Vietnamese legal / regulation headings (line-start).
_HEADER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    # Support both Vietnamese with accent and OCR/no-accent variants.
    ("phan", re.compile(r"^(?:Phần|Phan)\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    ("chuong", re.compile(r"^(?:Chương|Chuong)\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    ("dieu", re.compile(r"^(?:Điều|Dieu)\s+\d+\b", re.IGNORECASE)),
    ("muc", re.compile(r"^(?:Mục|Muc)\s+\d+\b", re.IGNORECASE)),
)

# Clearing lower levels when a higher-level heading appears.
_LEVEL_CLEARS: dict[str, tuple[str, ...]] = {
    "phan": ("chuong", "dieu", "muc"),
    "chuong": ("dieu", "muc"),
    "dieu": ("muc",),
    "muc": (),
}


@dataclass(frozen=True)
class TextChunk:
    text: str
    section_path: str = ""


def _match_header(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped:
        return None
    for level, pattern in _HEADER_PATTERNS:
        if pattern.match(stripped):
            return level, stripped
    return None


def _format_section_path(path: dict[str, str]) -> str:
    parts = [path[k] for k in ("phan", "chuong", "dieu", "muc") if path.get(k)]
    return " > ".join(parts)


def _char_chunk(text: str, max_size: int, overlap_ratio: float) -> list[str]:
    cleaned = text.replace("\r\n", "\n").strip()
    if not cleaned:
        return []

    overlap = max(0, int(max_size * overlap_ratio))
    chunks: list[str] = []
    start = 0
    length = len(cleaned)

    while start < length:
        end = min(start + max_size, length)
        piece = cleaned[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= length:
            break
        start = max(0, end - overlap)

    return chunks


def _is_table_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    return "\t" in stripped or "|" in stripped or bool(re.search(r"\S+\s{2,}\S+", stripped))


def _line_chunk(text: str, max_size: int, overlap_ratio: float) -> list[str]:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n") if line.strip()]
    if not lines:
        return []

    overlap_lines = max(0, int(max(1, len(lines)) * min(overlap_ratio, 0.25)))
    chunks: list[str] = []
    index = 0
    total = len(lines)

    while index < total:
        current: list[str] = []
        current_len = 0
        next_index = index
        while next_index < total:
            line = lines[next_index]
            projected = current_len + len(line) + (1 if current else 0)
            if current and projected > max_size:
                break
            current.append(line)
            current_len = projected
            next_index += 1

        if not current:
            current = [lines[index][:max_size]]
            next_index = index + 1

        chunks.append("\n".join(current).strip())
        if next_index >= total:
            break
        index = max(index + 1, next_index - overlap_lines)

    return chunks


def _best_effort_chunk(text: str, max_size: int, overlap_ratio: float) -> list[str]:
    if any(_is_table_line(line) for line in text.splitlines()):
        return _line_chunk(text, max_size, overlap_ratio)
    return _char_chunk(text, max_size, overlap_ratio)


def _split_into_sections(text: str) -> list[tuple[str, str]]:
    """Return (section_path, body) pairs split by structural headings."""
    lines = text.replace("\r\n", "\n").split("\n")
    path: dict[str, str] = {"phan": "", "chuong": "", "dieu": "", "muc": ""}
    sections: list[tuple[str, str]] = []
    buffer: list[str] = []
    found_structure = False

    def flush() -> None:
        body = "\n".join(buffer).strip()
        if body:
            sections.append((_format_section_path(path), body))

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
            buffer.append(line)
            continue
        buffer.append(line)

    flush()

    if not found_structure:
        return [("", text.strip())] if text.strip() else []
    return sections


def _with_section_prefix(body: str, section_path: str) -> str:
    if not section_path:
        return body
    return f"{section_path}\n\n{body}"


def chunk_document(
    text: str,
    max_size: int = 500,
    overlap_ratio: float = 0.2,
) -> list[TextChunk]:
    """Split by Chương/Điều/Mục, then recursively by size when a section is too long."""
    cleaned = text.replace("\r\n", "\n").strip()
    if not cleaned:
        return []

    sections = _split_into_sections(cleaned)
    if not sections:
        return []

    # Plain text with no headings — fall back to character chunking only.
    if len(sections) == 1 and not sections[0][0]:
        return [
            TextChunk(text=piece, section_path="")
            for piece in _best_effort_chunk(cleaned, max_size, overlap_ratio)
        ]

    result: list[TextChunk] = []
    for section_path, body in sections:
        if len(body) <= max_size:
            result.append(
                TextChunk(
                    text=_with_section_prefix(body, section_path),
                    section_path=section_path,
                )
            )
            continue
        for piece in _best_effort_chunk(body, max_size, overlap_ratio):
            result.append(
                TextChunk(
                    text=_with_section_prefix(piece, section_path),
                    section_path=section_path,
                )
            )
    return result


def chunk_text(text: str, max_size: int = 400, overlap_ratio: float = 0.1) -> list[str]:
    """Backward-compatible wrapper returning plain text chunks."""
    return [c.text for c in chunk_document(text, max_size, overlap_ratio)]

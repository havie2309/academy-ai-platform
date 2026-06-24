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
    ("phan", re.compile(r"^(?:Phần|Phan)\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    (
        "chuong",
        re.compile(r"^(?:Chương|Chuong)\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE),
    ),
    ("dieu", re.compile(r"^(?:Điều|Dieu)\s+\d+\b", re.IGNORECASE)),
    ("muc", re.compile(r"^(?:Mục|Muc)\s+\d+\b", re.IGNORECASE)),
)

_LEVEL_CLEARS: dict[str, tuple[str, ...]] = {
    "phan": ("chuong", "dieu", "muc"),
    "chuong": ("dieu", "muc"),
    "dieu": ("muc",),
    "muc": (),
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
    parts = [path[key] for key in ("phan", "chuong", "dieu", "muc") if path.get(key)]
    return " > ".join(parts)


def _split_into_sections(text: str) -> list[dict]:
    """Split a document into structural sections with stable section paths."""
    lines = text.replace("\r\n", "\n").split("\n")
    path: dict[str, str] = {"phan": "", "chuong": "", "dieu": "", "muc": ""}
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

    The parent-child ingest path below now uses `_split_into_sections`, but some
    tests and fallback code still expect the old `chunk_document` contract.
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
    small for embedding/Milvus lookup.
    """
    cleaned = text.replace("\r\n", "\n").strip()
    if not cleaned:
        return {"parent_nodes": [], "child_nodes": []}

    sections = _split_into_sections(cleaned)
    parent_nodes: list[dict] = []
    child_nodes: list[dict] = []

    for section in sections:
        section_text = section["text"]
        metadata = section["metadata"]
        if len(section_text) < 20:
            continue

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


def chunk_by_length(text: str, max_size: int, overlap_ratio: float = 0.1) -> list[str]:
    """Simple length-based chunking with overlap."""
    if not text:
        return []

    overlap = max(0, int(max_size * overlap_ratio))
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return chunks

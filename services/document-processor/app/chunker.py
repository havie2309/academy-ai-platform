import re
import uuid
from dataclasses import dataclass
from typing import Optional

@dataclass
class Chunk:
    text: str
    metadata: dict
    section_path: Optional[str] = None

@dataclass
class ParentNode:
    id: str
    text: str
    metadata: dict
    child_ids: list[str]

@dataclass
class ChildNode:
    id: str
    parent_id: str
    text: str
    metadata: dict
    index: int

# Existing header patterns (Vietnamese + OCR)
_HEADER_PATTERNS = (
    ("phan", re.compile(r"^(?:Phần|Phan)\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    ("chuong", re.compile(r"^(?:Chương|Chuong)\s+(?:[IVXLCDM]+|\d+)\b", re.IGNORECASE)),
    ("dieu", re.compile(r"^(?:Điều|Dieu)\s+\d+\b", re.IGNORECASE)),
    ("muc", re.compile(r"^(?:Mục|Muc)\s+\d+\b", re.IGNORECASE)),
)

# Track section hierarchy
class SectionHierarchy:
    def __init__(self):
        self.stack: list[str] = []
    
    def push(self, section: str):
        self.stack.append(section)
    
    def pop(self):
        if self.stack:
            return self.stack.pop()
        return None
    
    def get_path(self) -> str:
        return " > ".join(self.stack) if self.stack else ""


def detect_header(line: str) -> Optional[str]:
    """Detect if line is a header and return its type."""
    for header_type, pattern in _HEADER_PATTERNS:
        if pattern.match(line.strip()):
            return header_type
    return None


def chunk_document_parent_child(
    text: str,
    max_child_size: int = 200,
    max_parent_size: int = 1000,
    overlap: float = 0.1
) -> dict:
    """
    Parent-Child chunking for academic documents.
    
    Algorithm B (modified):
    - Parent: Only created at Điều/Mục level (NOT Phần/Chương).
    - Phần/Chương are stored as metadata (`chapter_header`) and in the section_path.
    - Child: Small chunks for vector search.
    
    Returns:
    {
        "parent_nodes": [{"id": "parent-xxx", "text": "...", "metadata": {...}, "child_ids": [...]}],
        "child_nodes": [{"id": "child-xxx", "parent_id": "parent-xxx", "text": "...", "metadata": {...}}]
    }
    """
    if not text or not text.strip():
        return {"parent_nodes": [], "child_nodes": []}
    
    cleaned = text.replace("\r\n", "\n").strip()
    lines = cleaned.split("\n")
    
    parent_nodes = []
    child_nodes = []
    hierarchy = SectionHierarchy()
    
    # Section accumulator (flushed only on Điều/Mục)
    current_text = ""
    current_headers: list[str] = []
    last_chapter = ""
    current_section_type = ""
    
    # Helper to flush a section into a parent node
    def flush_section():
        nonlocal current_text, current_headers, last_chapter, current_section_type
        if not current_text.strip():
            return
        
        # Build section metadata
        metadata = {
            "section_path": hierarchy.get_path(),
            "headers": current_headers.copy(),
            "chapter_header": last_chapter,
            "section_type": current_section_type,
        }
        
        # Create parent node
        parent_id = f"parent-{uuid.uuid4().hex[:8]}"
        parent_text = current_text.strip()
        if len(parent_text) > max_parent_size:
            parent_text = parent_text[:max_parent_size] + "..."
        
        parent_nodes.append({
            "id": parent_id,
            "text": parent_text,
            "metadata": {
                **metadata,
                "chunk_type": "parent",
                "full_text": current_text.strip()[:500],
                "original_length": len(current_text.strip()),
            },
            "child_ids": []
        })
        
        # Create child chunks from this section's text
        child_chunks = chunk_by_length(current_text.strip(), max_child_size, overlap)
        for idx, child_text in enumerate(child_chunks):
            if not child_text.strip():
                continue
            child_id = f"child-{uuid.uuid4().hex[:8]}"
            child_nodes.append({
                "id": child_id,
                "parent_id": parent_id,
                "text": child_text,
                "index": idx,
                "metadata": {
                    **metadata,
                    "chunk_type": "child",
                    "parent_id": parent_id,
                    "chunk_index": idx,
                    "parent_preview": parent_text[:200],
                }
            })
            parent_nodes[-1]["child_ids"].append(child_id)
        
        # Reset accumulator
        current_text = ""
        current_headers = []
        current_section_type = ""
    
    # Main loop
    for line in lines:
        stripped = line.strip()
        if not stripped:
            current_text += "\n"
            continue
        
        header_type = detect_header(stripped)
        
        if header_type:
            if header_type in ("phan", "chuong"):
                # Update hierarchy and chapter context, but DO NOT flush
                hierarchy.push(stripped)
                last_chapter = stripped
                # DO NOT add to current_text – prevents chapter from becoming a parent itself
                continue
            else:  # dieu or muc
                # Flush the previous section before starting a new one
                flush_section()
                
                # Start new section with this header
                current_text = stripped + "\n"
                current_headers = [stripped]
                current_section_type = header_type
                # Ensure hierarchy path includes the new header (push it)
                hierarchy.push(stripped)
        else:
            current_text += line + "\n"
    
    # Flush the last section
    flush_section()
    
    return {
        "parent_nodes": parent_nodes,
        "child_nodes": child_nodes
    }


def chunk_by_length(text: str, max_size: int, overlap_ratio: float = 0.1) -> list[str]:
    """Simple length-based chunking with overlap."""
    if not text:
        return []
    
    overlap = max(0, int(max_size * overlap_ratio))
    chunks = []
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

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
    
    Algorithm B:
    - Parent: Full section (e.g., entire Article) → stored in MongoDB
    - Child: Small chunks for vector search → stored in Milvus
    
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
    
    current_section = ""
    current_metadata = {"section_path": ""}
    current_headers: list[str] = []
    
    # Step 1: Split by headers and build sections
    sections: list[dict] = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            current_section += "\n"
            continue
        
        header_type = detect_header(stripped)
        
        if header_type:
            # If we have accumulated content, save it
            if current_section.strip():
                sections.append({
                    "text": current_section.strip(),
                    "metadata": {
                        "section_path": hierarchy.get_path(),
                        "headers": current_headers.copy(),
                        "section_type": header_type,
                    }
                })
            
            # Update hierarchy
            current_headers.append(stripped)
            hierarchy.push(stripped)
            current_section = stripped + "\n"
        else:
            current_section += line + "\n"
    
    # Don't forget the last section
    if current_section.strip():
        sections.append({
            "text": current_section.strip(),
            "metadata": {
                "section_path": hierarchy.get_path(),
                "headers": current_headers.copy(),
            }
        })
    
    # Step 2: Build parent and child nodes
    for section in sections:
        section_text = section["text"]
        metadata = section["metadata"]
        
        # Skip if section is too short
        if len(section_text) < 20:
            continue
        
        parent_id = f"parent-{uuid.uuid4().hex[:8]}"
        
        # Truncate parent if too long
        if len(section_text) > max_parent_size:
            parent_text = section_text[:max_parent_size] + "..."
        else:
            parent_text = section_text
        
        # Create parent node
        parent_nodes.append({
            "id": parent_id,
            "text": parent_text,
            "metadata": {
                **metadata,
                "chunk_type": "parent",
                "full_text": section_text[:500],  # Store preview
                "original_length": len(section_text),
            },
            "child_ids": []
        })
        
        # Step 3: Break parent into child chunks
        child_chunks = chunk_by_length(section_text, max_child_size, overlap)
        
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

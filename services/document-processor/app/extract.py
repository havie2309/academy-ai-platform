from pathlib import Path


def extract_text(storage_path: str, mime_type: str = "") -> str:
    path = Path(storage_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {storage_path}")

    ext = path.suffix.lower()
    if ext in (".txt", ".md", ".csv"):
        return path.read_text(encoding="utf-8", errors="replace")

    if ext == ".pdf" or "pdf" in mime_type:
        import fitz

        doc = fitz.open(str(path))
        try:
            return "\n".join(page.get_text() for page in doc).strip()
        finally:
            doc.close()

    raise ValueError(f"Định dạng chưa hỗ trợ ingest: {ext or mime_type}")

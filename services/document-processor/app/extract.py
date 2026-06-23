from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

from app.config import (
    MINERU_BACKEND,
    MINERU_CLI,
    MINERU_ENABLED,
    MINERU_TIMEOUT_SEC,
    PADDLEOCR_ENABLED,
    PADDLEOCR_LANG,
    PDF_OCR_MIN_TEXT_CHARS,
)

_MARKITDOWN_EXTS = {".docx", ".pptx", ".xlsx", ".html", ".htm"}
_MARKITDOWN_MIMES = ("wordprocessingml", "presentationml", "spreadsheetml", "html")


def _has_meaningful_text(text: str) -> bool:
    compact = re.sub(r"\s+", "", text or "")
    if len(compact) < PDF_OCR_MIN_TEXT_CHARS:
        return False
    return bool(re.search(r"[0-9A-Za-zÀ-ỹ]", compact))


def _markitdown(path: Path) -> str:
    from markitdown import MarkItDown

    result = MarkItDown().convert(str(path))
    return (result.text_content or "").strip()


def _collect_mineru_output(output_dir: Path) -> str:
    candidates = list(output_dir.rglob("*.md")) + list(output_dir.rglob("*.txt"))
    if not candidates:
        return ""
    best = max(candidates, key=lambda p: p.stat().st_size)
    return best.read_text(encoding="utf-8", errors="replace").strip()


def _pdf_text_mineru(path: Path) -> str:
    if not MINERU_ENABLED:
        return ""
    command = [MINERU_CLI, "-p", str(path), "-o"]
    with tempfile.TemporaryDirectory(prefix="pm2-mineru-") as tmpdir:
        command.append(tmpdir)
        if MINERU_BACKEND:
            command.extend(["-b", MINERU_BACKEND])
        try:
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                timeout=MINERU_TIMEOUT_SEC,
            )
        except Exception:
            return ""
        return _collect_mineru_output(Path(tmpdir))


def _pdf_text_paddleocr(path: Path) -> str:
    if not PADDLEOCR_ENABLED:
        return ""
    try:
        import fitz
        from paddleocr import PaddleOCR
    except Exception:
        return ""

    doc = fitz.open(str(path))
    ocr = PaddleOCR(use_angle_cls=False, lang=PADDLEOCR_LANG, show_log=False)
    page_texts: list[str] = []
    try:
        with tempfile.TemporaryDirectory(prefix="pm2-ocr-") as tmpdir:
            for index, page in enumerate(doc, start=1):
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                image_path = Path(tmpdir) / f"page-{index}.png"
                pix.save(str(image_path))
                result = ocr.ocr(str(image_path), cls=False) or []
                lines: list[str] = []
                for block in result:
                    if not block:
                        continue
                    for item in block:
                        try:
                            text = str(item[1][0]).strip()
                        except Exception:
                            text = ""
                        if text:
                            lines.append(text)
                if lines:
                    page_texts.append(f"Trang {index}\n" + "\n".join(lines))
    finally:
        doc.close()
    return "\n\n".join(page_texts).strip()


def extract_text(storage_path: str, mime_type: str = "") -> str:
    path = Path(storage_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {storage_path}")

    ext = path.suffix.lower()

    # Plain text: đọc trực tiếp, không cần MarkItDown
    if ext in (".txt", ".md", ".csv", ".tsv"):
        return path.read_text(encoding="utf-8", errors="replace").strip()

    # PDF: fitz đọc thẳng text layer — chuẩn dấu tiếng Việt hơn pdfminer của MarkItDown.
    # OCR fallback cho scanned PDF (fitz trả về rỗng).
    if ext == ".pdf" or "pdf" in mime_type:
        import fitz

        doc = fitz.open(str(path))
        try:
            native = "\n\n".join(
                p for p in (page.get_text().strip() for page in doc) if p
            ).strip()
        finally:
            doc.close()
        if _has_meaningful_text(native):
            return native
        mineru_text = _pdf_text_mineru(path)
        if mineru_text.strip():
            return mineru_text
        ocr_text = _pdf_text_paddleocr(path)
        return ocr_text or native

    # docx/pptx/xlsx/html: MarkItDown xử lý hết, output Markdown có cấu trúc header
    if ext in _MARKITDOWN_EXTS or any(t in mime_type for t in _MARKITDOWN_MIMES):
        return _markitdown(path)

    raise ValueError(f"Định dạng chưa hỗ trợ ingest: {ext or mime_type}")

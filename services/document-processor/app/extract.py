from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from app.config import (
    MINERU_BACKEND,
    MINERU_CLI,
    MINERU_ENABLED,
    MINERU_TIMEOUT_SEC,
    PADDLEOCR_ENABLED,
    PADDLEOCR_LANG,
    PDF_OCR_MIN_TEXT_CHARS,
)

_WORKBOOK_NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
_REL_NS = {
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
}


def _read_plain_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace").strip()


def _pdf_text_native(path: Path) -> str:
    import fitz

    doc = fitz.open(str(path))
    try:
        parts = [page.get_text().strip() for page in doc]
        return "\n\n".join(part for part in parts if part).strip()
    finally:
        doc.close()


def _has_meaningful_text(text: str) -> bool:
    compact = re.sub(r"\s+", "", text or "")
    if len(compact) < PDF_OCR_MIN_TEXT_CHARS:
        return False
    return bool(re.search(r"[0-9A-Za-zÀ-ỹ]", compact))


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


def _collect_mineru_output(output_dir: Path) -> str:
    candidates = list(output_dir.rglob("*.md")) + list(output_dir.rglob("*.txt"))
    if not candidates:
        return ""
    best = max(candidates, key=lambda item: item.stat().st_size)
    return best.read_text(encoding="utf-8", errors="replace").strip()


def _pdf_text_mineru(path: Path) -> str:
    if not MINERU_ENABLED:
        return ""

    command = [MINERU_CLI, "-p", str(path), "-o"]
    with tempfile.TemporaryDirectory(prefix="pm2-mineru-") as tmpdir:
        output_dir = Path(tmpdir)
        command.append(str(output_dir))
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
        return _collect_mineru_output(output_dir)


def _pptx_slide_files(zipf: ZipFile) -> list[str]:
    slide_files = [
        name
        for name in zipf.namelist()
        if name.startswith("ppt/slides/slide") and name.endswith(".xml")
    ]
    return sorted(
        slide_files,
        key=lambda name: int(re.search(r"slide(\d+)\.xml$", name).group(1)),  # type: ignore[union-attr]
    )


def _extract_pptx_text(path: Path) -> str:
    pages: list[str] = []
    with ZipFile(path) as zipf:
        for index, slide_name in enumerate(_pptx_slide_files(zipf), start=1):
            root = ET.fromstring(zipf.read(slide_name))
            texts = [
                (node.text or "").strip()
                for node in root.iter()
                if node.tag.endswith("}t") and (node.text or "").strip()
            ]
            if texts:
                pages.append(f"Slide {index}\n" + "\n".join(texts))
    return "\n\n".join(pages).strip()


def _shared_strings(zipf: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zipf.namelist():
        return []
    root = ET.fromstring(zipf.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for si in root.findall(".//main:si", _WORKBOOK_NS):
        pieces = [
            (node.text or "").strip()
            for node in si.findall(".//main:t", _WORKBOOK_NS)
            if (node.text or "").strip()
        ]
        values.append(" ".join(pieces).strip())
    return values


def _workbook_sheet_names(zipf: ZipFile) -> list[str]:
    if "xl/workbook.xml" not in zipf.namelist():
        return []
    root = ET.fromstring(zipf.read("xl/workbook.xml"))
    return [
        sheet.attrib.get("name", f"Sheet {index}")
        for index, sheet in enumerate(
            root.findall(".//main:sheets/main:sheet", _WORKBOOK_NS), start=1
        )
    ]


def _cell_value(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get("t", "")
    value = cell.findtext("main:v", default="", namespaces=_WORKBOOK_NS).strip()
    if cell_type == "s":
        if value.isdigit():
            idx = int(value)
            if 0 <= idx < len(shared):
                return shared[idx]
        return ""
    if cell_type == "inlineStr":
        pieces = [
            (node.text or "").strip()
            for node in cell.findall(".//main:t", _WORKBOOK_NS)
            if (node.text or "").strip()
        ]
        return " ".join(pieces).strip()
    return value


def _extract_xlsx_text(path: Path) -> str:
    sections: list[str] = []
    with ZipFile(path) as zipf:
        shared = _shared_strings(zipf)
        sheet_names = _workbook_sheet_names(zipf)
        sheet_files = [
            name
            for name in zipf.namelist()
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
        ]
        sheet_files = sorted(
            sheet_files,
            key=lambda name: int(re.search(r"sheet(\d+)\.xml$", name).group(1)),  # type: ignore[union-attr]
        )
        for index, sheet_name in enumerate(sheet_files, start=1):
            root = ET.fromstring(zipf.read(sheet_name))
            rows: list[str] = []
            for row in root.findall(".//main:sheetData/main:row", _WORKBOOK_NS):
                cells: list[str] = []
                for cell in row.findall("main:c", _WORKBOOK_NS):
                    value = _cell_value(cell, shared)
                    cells.append(value)
                while cells and not cells[-1]:
                    cells.pop()
                if any(cell.strip() for cell in cells):
                    rows.append("\t".join(cell.strip() for cell in cells))
            if rows:
                title = sheet_names[index - 1] if index - 1 < len(sheet_names) else f"Sheet {index}"
                sections.append(f"Sheet: {title}\n" + "\n".join(rows))
    return "\n\n".join(sections).strip()


def extract_text(storage_path: str, mime_type: str = "") -> str:
    path = Path(storage_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {storage_path}")

    ext = path.suffix.lower()
    if ext in (".txt", ".md", ".csv", ".tsv"):
        return _read_plain_text(path)

    if ext == ".pdf" or "pdf" in mime_type:
        native = _pdf_text_native(path)
        if _has_meaningful_text(native):
            return native
        mineru_text = _pdf_text_mineru(path)
        if mineru_text.strip():
            return mineru_text
        ocr_text = _pdf_text_paddleocr(path)
        return ocr_text or native.strip()

    if ext == ".docx" or "wordprocessingml" in mime_type:
        import docx2txt

        return (docx2txt.process(str(path)) or "").strip()

    if ext == ".pptx" or "presentationml" in mime_type:
        return _extract_pptx_text(path)

    if ext == ".xlsx" or "spreadsheetml" in mime_type:
        return _extract_xlsx_text(path)

    raise ValueError(f"Định dạng chưa hỗ trợ ingest: {ext or mime_type}")

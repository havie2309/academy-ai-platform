import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.extract import extract_text


class ExtractTests(unittest.TestCase):
    def test_extract_plain_text(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "sample.txt"
            path.write_text("Xin chao\nPM2", encoding="utf-8")
            text = extract_text(str(path))
        self.assertIn("Xin chao", text)

    def test_extract_pptx_text(self):
        # Mock MarkItDown to avoid creating a real PPTX file
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "deck.pptx"
            # Create an empty file so that extract_text finds it
            path.touch()
            with patch("app.extract._markitdown") as mock_md:
                mock_md.return_value = "Slide 1 title\nNoi dung slide"
                text = extract_text(str(path), "application/vnd.openxmlformats-officedocument.presentationml.presentation")
        self.assertIn("Slide 1", text)
        self.assertIn("Noi dung slide", text)

    def test_extract_xlsx_text(self):
        # Mock MarkItDown to avoid creating a real XLSX file
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "table.xlsx"
            path.touch()
            with patch("app.extract._markitdown") as mock_md:
                mock_md.return_value = "Sheet: Bang diem\n666106\tNguyen Van A\t9.0"
                text = extract_text(str(path), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertIn("Sheet: Bang diem", text)
        self.assertIn("666106\tNguyen Van A\t9.0", text)

    def test_extract_pdf_uses_ocr_fallback_when_native_text_is_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "scan.pdf"
            path.write_bytes(b"%PDF-1.4\n")  # minimal PDF header
            # Patch fitz to simulate a scanned PDF (no native text)
            with patch("fitz.open") as mock_open:
                mock_doc = MagicMock()
                mock_doc.__iter__.return_value = [MagicMock(get_text=MagicMock(return_value=""))]
                mock_open.return_value = mock_doc
                # Patch OCR functions to return dummy texts
                with patch("app.extract._pdf_text_mineru", return_value=""):
                    with patch("app.extract._pdf_text_paddleocr", return_value="OCR text"):
                        text = extract_text(str(path), "application/pdf")
        self.assertEqual(text, "OCR text")

    def test_extract_pdf_prefers_mineru_before_paddleocr(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "scan.pdf"
            path.write_bytes(b"%PDF-1.4\n")
            with patch("fitz.open") as mock_open:
                mock_doc = MagicMock()
                mock_doc.__iter__.return_value = [MagicMock(get_text=MagicMock(return_value=""))]
                mock_open.return_value = mock_doc
                with patch("app.extract._pdf_text_mineru", return_value="MinerU OCR text"):
                    with patch("app.extract._pdf_text_paddleocr", return_value="Paddle text"):
                        text = extract_text(str(path), "application/pdf")
        self.assertEqual(text, "MinerU OCR text")


if __name__ == "__main__":
    unittest.main()
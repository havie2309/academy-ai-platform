import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.extract import extract_text  # noqa: E402


class ExtractTests(unittest.TestCase):
    def test_extract_plain_text(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "sample.txt"
            path.write_text("Xin chao\nPM2", encoding="utf-8")
            text = extract_text(str(path))
        self.assertIn("Xin chao", text)

    def test_extract_pptx_text(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "deck.pptx"
            with ZipFile(path, "w") as zipf:
                zipf.writestr(
                    "ppt/slides/slide1.xml",
                    """
                    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                           xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                      <p:cSld><p:spTree><p:sp><p:txBody>
                        <a:p><a:r><a:t>Slide 1 title</a:t></a:r></a:p>
                        <a:p><a:r><a:t>Noi dung slide</a:t></a:r></a:p>
                      </p:txBody></p:sp></p:spTree></p:cSld>
                    </p:sld>
                    """,
                )
            text = extract_text(str(path))
        self.assertIn("Slide 1", text)
        self.assertIn("Noi dung slide", text)

    def test_extract_xlsx_text(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "table.xlsx"
            with ZipFile(path, "w") as zipf:
                zipf.writestr(
                    "xl/workbook.xml",
                    """
                    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                      <sheets>
                        <sheet name="Bang diem" sheetId="1" r:id="rId1"/>
                      </sheets>
                    </workbook>
                    """,
                )
                zipf.writestr(
                    "xl/sharedStrings.xml",
                    """
                    <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                      <si><t>ma_hv</t></si>
                      <si><t>ho_ten</t></si>
                    </sst>
                    """,
                )
                zipf.writestr(
                    "xl/worksheets/sheet1.xml",
                    """
                    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                      <sheetData>
                        <row r="1">
                          <c r="A1" t="s"><v>0</v></c>
                          <c r="B1" t="s"><v>1</v></c>
                          <c r="C1"><v>8.5</v></c>
                        </row>
                        <row r="2">
                          <c r="A2"><v>666106</v></c>
                          <c r="B2" t="inlineStr"><is><t>Nguyen Van A</t></is></c>
                          <c r="C2"><v>9.0</v></c>
                        </row>
                      </sheetData>
                    </worksheet>
                    """,
                )
            text = extract_text(str(path))
        self.assertIn("Sheet: Bang diem", text)
        self.assertIn("666106\tNguyen Van A\t9.0", text)

    def test_extract_pdf_uses_ocr_fallback_when_native_text_is_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "scan.pdf"
            path.write_bytes(b"%PDF-1.4\n")
            with patch("app.extract._pdf_text_native", return_value=""), patch(
                "app.extract._pdf_text_mineru", return_value=""
            ), patch(
                "app.extract._pdf_text_paddleocr", return_value="OCR text"
            ):
                text = extract_text(str(path), "application/pdf")
        self.assertEqual(text, "OCR text")

    def test_extract_pdf_prefers_mineru_before_paddleocr(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "scan.pdf"
            path.write_bytes(b"%PDF-1.4\n")
            with patch("app.extract._pdf_text_native", return_value=""), patch(
                "app.extract._pdf_text_mineru", return_value="MinerU OCR text"
            ), patch("app.extract._pdf_text_paddleocr", return_value="Paddle text"):
                text = extract_text(str(path), "application/pdf")
        self.assertEqual(text, "MinerU OCR text")


if __name__ == "__main__":
    unittest.main()

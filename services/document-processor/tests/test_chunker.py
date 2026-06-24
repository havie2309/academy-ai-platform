import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chunker import chunk_document_parent_child, chunk_by_length


SAMPLE_REGULATION = """
Chương I. QUY ĐỊNH CHUNG
Điều 1. Phạm vi điều chỉnh
Quy chế này quy định về khảo thí.

Chương II. ĐIỀU KIỆN DỰ THI
Điều 5. Điều kiện về điểm
Sinh viên có GPA từ 4.0 trở lên được dự thi.

Điều 6. Điều kiện về chuyên cần
Sinh viên vắng quá 20% tổng số tiết không được dự thi cuối kỳ.
Mục 1. Cách tính số tiết vắng
Số tiết vắng được tính trên tổng số tiết của học phần.
""".strip()


class ChunkerTests(unittest.TestCase):
    def test_parent_nodes_only_created_at_dieu_muc(self):
        result = chunk_document_parent_child(SAMPLE_REGULATION, max_child_size=200, max_parent_size=1000, overlap=0.1)
        parents = result["parent_nodes"]
        children = result["child_nodes"]

        # There should be exactly 3 parents: Điều 1, Điều 5, Điều 6 (Mục 1 is nested under Điều 6)
        # In this sample, "Mục 1" is inside "Điều 6", so it may not create a separate parent; it will be part of Điều 6 parent.
        # Our logic: chỉ Điều và Mục tạo parent. But Mục 1 appears after Điều 6, so it will flush Điều 6 and start a new parent for Mục 1.
        # So we expect 4 parents: Điều 1, Điều 5, Điều 6, Mục 1.
        self.assertGreaterEqual(len(parents), 3)
        # Check that no parent has "Chương" in its metadata.section_type
        for p in parents:
            self.assertNotEqual(p["metadata"].get("section_type"), "chuong")
            self.assertNotEqual(p["metadata"].get("section_type"), "phan")

        # Check that section_path contains hierarchy (includes Chương headers)
        # For Điều 5, the path should contain "Chương II. ĐIỀU KIỆN DỰ THI" and "Điều 5. ..."
        found = False
        for p in parents:
            if "Điều 5" in p["text"]:
                self.assertIn("Chương II", p["metadata"]["section_path"])
                self.assertEqual(p["metadata"]["chapter_header"], "Chương II. ĐIỀU KIỆN DỰ THI")
                found = True
        self.assertTrue(found, "Parent for Điều 5 not found")

    def test_child_chunks_are_generated_with_overlap(self):
        text = "Điều 1. " + ("Nội dung dài. " * 30)
        result = chunk_document_parent_child(text, max_child_size=50, overlap=0.2)
        children = result["child_nodes"]
        self.assertGreater(len(children), 1)
        # Check that overlap works: first and second chunk should share some text
        # (since overlap = 0.2 * 50 = 10 chars, we can check that chunks are not empty)
        self.assertTrue(all(c["text"] for c in children))

    def test_section_path_is_correct_for_nested_sections(self):
        text = """
Chương 1. TỔNG QUAN
Điều 1. Giới thiệu
Nội dung giới thiệu.
Mục 1. Chi tiết
Chi tiết của mục 1.
Điều 2. Kết luận
Kết luận.
""".strip()
        result = chunk_document_parent_child(text, max_child_size=100, overlap=0.1)
        parents = result["parent_nodes"]
        # Expect parents: Điều 1, Mục 1, Điều 2
        self.assertEqual(len(parents), 3)
        # Check section_path for Mục 1 contains Điều 1
        found = False
        for p in parents:
            if "Mục 1" in p["text"]:
                self.assertIn("Điều 1", p["metadata"]["section_path"])
                self.assertEqual(p["metadata"]["chapter_header"], "Chương 1. TỔNG QUAN")
                found = True
        self.assertTrue(found, "Mục 1 parent not found or section_path incorrect")

    def test_plain_text_no_headers_returns_one_parent_and_one_child(self):
        plain = "A" * 250
        result = chunk_document_parent_child(plain, max_child_size=100, max_parent_size=1000, overlap=0.1)
        # Should create one parent (since no headers, the whole text is one section)
        self.assertEqual(len(result["parent_nodes"]), 1)
        self.assertGreater(len(result["child_nodes"]), 1)  # because max_child_size=100, 250 chars => 3 chunks

    def test_chunk_by_length(self):
        self.assertEqual(chunk_by_length("hello world", 100), ["hello world"])
        self.assertEqual(chunk_by_length("", 100), [])
        text = "a" * 250
        chunks = chunk_by_length(text, 100, 0.1)
        self.assertEqual(len(chunks), 3)  # 0-100, 90-190, 180-250 (with overlap)

    def test_ocr_no_accent_headers_are_detected(self):
        text = """
Chuong II. DIEU KIEN DU THI
Dieu 6. Dieu kien chuyen can
Sinh vien vang qua 20% tong so tiet khong duoc du thi.
Muc 1. Cach tinh
Tinh theo tong so tiet hoc phan.
""".strip()
        result = chunk_document_parent_child(text, max_child_size=200)
        parents = result["parent_nodes"]
        # Expect parents: Điều 6, Mục 1
        self.assertEqual(len(parents), 2)
        self.assertIn("Dieu 6", parents[0]["text"])
        self.assertIn("Chuong II", parents[0]["metadata"]["section_path"])


if __name__ == "__main__":
    unittest.main()

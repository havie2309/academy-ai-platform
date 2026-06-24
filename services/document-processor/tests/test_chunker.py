import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chunker import chunk_document, chunk_document_parent_child, chunk_text  # noqa: E402


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

PARENT_CHILD_SAMPLE = """
Chương I. Quy định chung
Điều 1. Phạm vi áp dụng
Nội dung của điều 1 kéo dài đủ để tạo parent node riêng.

Điều 2. Đối tượng áp dụng
Nội dung của điều 2 cũng đủ dài để không bị bỏ qua trong luồng parent-child.

Chương II. Quy định cụ thể
Điều 3. Thực hiện
Nội dung của điều 3 dùng để kiểm tra section_path không bám sai sang chương/điều trước.
""".strip()


class ChunkerTests(unittest.TestCase):
    def test_structural_split_keeps_dieu_separate(self):
        chunks = chunk_document(SAMPLE_REGULATION, max_size=500, overlap_ratio=0.1)
        paths = [c.section_path for c in chunks]
        self.assertTrue(any("Điều 5" in p for p in paths))
        self.assertTrue(any("Điều 6" in p for p in paths))
        texts = " ".join(c.text for c in chunks)
        self.assertIn("GPA", texts)
        self.assertIn("20%", texts)

    def test_recursive_split_when_section_too_small_limit(self):
        long_body = "Điều 7. " + ("Nội dung dài. " * 80)
        chunks = chunk_document(long_body, max_size=120, overlap_ratio=0.1)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(c.section_path.startswith("Điều 7") for c in chunks))

    def test_plain_text_fallback_to_char_chunks(self):
        plain = "A" * 250
        chunks = chunk_document(plain, max_size=100, overlap_ratio=0.1)
        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(all(c.section_path == "" for c in chunks))

    def test_chunk_text_wrapper(self):
        self.assertEqual(chunk_text("hello world", max_size=100), ["hello world"])

    def test_ocr_no_accent_headers_are_detected(self):
        text = """
Chuong II. DIEU KIEN DU THI
Dieu 6. Dieu kien chuyen can
Sinh vien vang qua 20% tong so tiet khong duoc du thi.
Muc 1. Cach tinh
Tinh theo tong so tiet hoc phan.
""".strip()
        chunks = chunk_document(text, max_size=500, overlap_ratio=0.1)
        self.assertGreaterEqual(len(chunks), 1)
        self.assertTrue(any("Chuong II" in c.section_path for c in chunks))
        self.assertTrue(any("Dieu 6" in c.section_path for c in chunks))

    def test_tabular_text_preserves_rows(self):
        text = "\n".join(
            [
                "Sheet: Bang diem",
                "ma_hv\tho_ten\tdiem",
                "666106\tNguyen Van A\t8.5",
                "666107\tTran Thi B\t9.0",
                "666108\tLe Van C\t7.5",
            ]
        )
        chunks = chunk_document(text, max_size=40, overlap_ratio=0.1)
        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(all("\t" in c.text or "Sheet:" in c.text for c in chunks))

    def test_parent_child_chunking_keeps_sibling_section_paths_stable(self):
        result = chunk_document_parent_child(
            PARENT_CHILD_SAMPLE,
            max_child_size=120,
            max_parent_size=600,
            overlap=0.1,
        )

        parents = result["parent_nodes"]
        self.assertGreaterEqual(len(parents), 3)

        dieu_2 = next(
            p for p in parents if "Điều 2. Đối tượng áp dụng" in p["text"]
        )
        dieu_3 = next(p for p in parents if "Điều 3. Thực hiện" in p["text"])

        self.assertIn("Chương I. Quy định chung", dieu_2["metadata"]["section_path"])
        self.assertIn("Điều 2. Đối tượng áp dụng", dieu_2["metadata"]["section_path"])
        self.assertNotIn("Điều 1. Phạm vi áp dụng", dieu_2["metadata"]["section_path"])

        self.assertIn("Chương II. Quy định cụ thể", dieu_3["metadata"]["section_path"])
        self.assertIn("Điều 3. Thực hiện", dieu_3["metadata"]["section_path"])
        self.assertNotIn("Chương I. Quy định chung", dieu_3["metadata"]["section_path"])
        self.assertNotIn("Điều 2. Đối tượng áp dụng", dieu_3["metadata"]["section_path"])

    def test_parent_child_children_keep_parent_preview_and_section_path(self):
        result = chunk_document_parent_child(
            PARENT_CHILD_SAMPLE,
            max_child_size=80,
            max_parent_size=300,
            overlap=0.1,
        )

        children = result["child_nodes"]
        self.assertTrue(children)
        first_child = children[0]

        self.assertIn("parent_preview", first_child["metadata"])
        self.assertTrue(first_child["metadata"]["parent_preview"])
        self.assertIn("section_path", first_child["metadata"])
        self.assertTrue(first_child["metadata"]["section_path"])


if __name__ == "__main__":
    unittest.main()

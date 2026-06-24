import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chunker import (  # noqa: E402
    chunk_by_length,
    chunk_document,
    chunk_document_parent_child,
    chunk_text,
)


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
        paths = [chunk.section_path for chunk in chunks]
        self.assertTrue(any("Điều 5" in path for path in paths))
        self.assertTrue(any("Điều 6" in path for path in paths))
        texts = " ".join(chunk.text for chunk in chunks)
        self.assertIn("GPA", texts)
        self.assertIn("20%", texts)

    def test_recursive_split_when_section_too_small_limit(self):
        long_body = "Điều 7. " + ("Nội dung dài. " * 80)
        chunks = chunk_document(long_body, max_size=120, overlap_ratio=0.1)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunk.section_path.startswith("Điều 7") for chunk in chunks))

    def test_plain_text_fallback_to_char_chunks(self):
        plain = "A" * 250
        chunks = chunk_document(plain, max_size=100, overlap_ratio=0.1)
        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(all(chunk.section_path == "" for chunk in chunks))

    def test_chunk_text_wrapper(self):
        self.assertEqual(chunk_text("hello world", max_size=100), ["hello world"])

    def test_parent_nodes_only_created_at_dieu_muc(self):
        result = chunk_document_parent_child(
            SAMPLE_REGULATION,
            max_child_size=200,
            max_parent_size=1000,
            overlap=0.1,
        )
        parents = result["parent_nodes"]
        self.assertGreaterEqual(len(parents), 3)

        for parent in parents:
            self.assertNotEqual(parent["metadata"].get("section_type"), "chuong")
            self.assertNotEqual(parent["metadata"].get("section_type"), "phan")

        dieu_5 = next(parent for parent in parents if "Điều 5" in parent["text"])
        self.assertIn("Chương II", dieu_5["metadata"]["section_path"])
        self.assertEqual(
            dieu_5["metadata"]["chapter_header"],
            "Chương II. ĐIỀU KIỆN DỰ THI",
        )

    def test_child_chunks_are_generated_with_overlap(self):
        text = "Điều 1. " + ("Nội dung dài. " * 30)
        result = chunk_document_parent_child(text, max_child_size=50, overlap=0.2)
        children = result["child_nodes"]
        self.assertGreater(len(children), 1)
        self.assertTrue(all(child["text"] for child in children))

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
        self.assertEqual(len(parents), 3)

        found = False
        for parent in parents:
            if "Mục 1" in parent["text"]:
                self.assertIn("Điều 1", parent["metadata"]["section_path"])
                self.assertEqual(
                    parent["metadata"]["chapter_header"],
                    "Chương 1. TỔNG QUAN",
                )
                found = True
        self.assertTrue(found, "Mục 1 parent not found or section_path incorrect")

    def test_plain_text_no_headers_returns_one_parent_and_many_children(self):
        plain = "A" * 250
        result = chunk_document_parent_child(
            plain,
            max_child_size=100,
            max_parent_size=1000,
            overlap=0.1,
        )
        self.assertEqual(len(result["parent_nodes"]), 1)
        self.assertGreater(len(result["child_nodes"]), 1)

    def test_chunk_by_length(self):
        self.assertEqual(chunk_by_length("hello world", 100), ["hello world"])
        self.assertEqual(chunk_by_length("", 100), [])
        text = "a" * 250
        chunks = chunk_by_length(text, 100, 0.1)
        self.assertEqual(len(chunks), 3)

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
        self.assertTrue(any("Chuong II" in chunk.section_path for chunk in chunks))
        self.assertTrue(any("Dieu 6" in chunk.section_path for chunk in chunks))

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
        self.assertTrue(all("\t" in chunk.text or "Sheet:" in chunk.text for chunk in chunks))

    def test_parent_child_chunking_keeps_sibling_section_paths_stable(self):
        result = chunk_document_parent_child(
            PARENT_CHILD_SAMPLE,
            max_child_size=120,
            max_parent_size=600,
            overlap=0.1,
        )

        parents = result["parent_nodes"]
        self.assertGreaterEqual(len(parents), 3)

        dieu_2 = next(parent for parent in parents if "Điều 2. Đối tượng áp dụng" in parent["text"])
        dieu_3 = next(parent for parent in parents if "Điều 3. Thực hiện" in parent["text"])

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

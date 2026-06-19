import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.sql_format import build_answer, rows_to_markdown_table  # noqa: E402


class SqlFormatTests(unittest.TestCase):
    def test_gpa_single_row_affirmative_sentence(self):
        columns = [
            "ho_ten",
            "ma_hv",
            "gpa_he4",
            "gpa_he10",
            "so_tin_chi_tich_luy",
            "muc_canh_bao",
        ]
        rows = [("Nguyễn Văn A", "666106", 3.87, 8.5, 120, 0)]
        answer = build_answer("GPA tích lũy của học viên 666106", columns, rows)

        self.assertIn("Học viên **Nguyễn Văn A**", answer)
        self.assertIn("666106", answer)
        self.assertIn("GPA tích lũy hệ 4 là **3,87**", answer)
        self.assertIn("hệ 10 là **8,5**", answer)
        self.assertIn("120", answer)
        self.assertIn("tín chỉ", answer)
        self.assertIn("không ở mức cảnh báo học tập", answer)
        self.assertNotIn("|", answer)

    def test_markdown_table_uses_vietnamese_headers(self):
        columns = ["ma_hv", "ho_ten", "gpa_he4"]
        rows = [("666106", "Nguyễn Văn A", 3.87), ("666107", "Trần Thị B", 3.5)]
        table = rows_to_markdown_table(columns, rows)

        self.assertIn("Mã học viên", table)
        self.assertIn("Họ tên", table)
        self.assertIn("GPA hệ 4", table)
        self.assertNotIn("ma_hv", table)
        self.assertNotIn("ho_ten", table)
        self.assertIn("3,87", table)

    def test_multi_row_answer_includes_labeled_table(self):
        columns = ["ma_hv", "ho_ten", "gpa_he4"]
        rows = [("666106", "A", 3.87), ("666107", "B", 3.5)]
        answer = build_answer("danh sách GPA học viên", columns, rows)

        self.assertIn("Tìm thấy **2**", answer)
        self.assertIn("Mã học viên", answer)
        self.assertIn("Họ tên", answer)


if __name__ == "__main__":
    unittest.main()

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.router import classify_route  # noqa: E402
from app.sql_guardrail import SqlGuardrailError, apply_guardrail  # noqa: E402
from app.sql_scope import SqlScopeError, apply_scope  # noqa: E402


class SqlGuardrailAndScopeTests(unittest.TestCase):
    def test_classify_route_sql_keywords(self):
        self.assertEqual(classify_route("GPA học viên 676156 là bao nhiêu?"), "sql")
        self.assertEqual(classify_route("Lịch dạy của giảng viên"), "sql")
        self.assertEqual(classify_route("Quy định vắng 25% học phần"), "rag")

    def test_guardrail_blocks_delete(self):
        with self.assertRaises(SqlGuardrailError):
            apply_guardrail("DELETE FROM sql_curated.v_hoc_vien_gpa LIMIT 1")

    def test_guardrail_blocks_multi_statement(self):
        with self.assertRaises(SqlGuardrailError):
            apply_guardrail(
                "SELECT * FROM sql_curated.v_hoc_vien_gpa LIMIT 1; DROP TABLE users;"
            )

    def test_guardrail_allows_curated_select(self):
        sql = apply_guardrail(
            "SELECT ma_hv, gpa_he4 FROM sql_curated.v_hoc_vien_gpa LIMIT 10"
        )
        self.assertIn("LIMIT", sql.upper())
        self.assertIn("v_hoc_vien_gpa", sql)

    def test_guardrail_adds_limit_when_missing(self):
        sql = apply_guardrail("SELECT ma_hv FROM sql_curated.v_hoc_vien_gpa")
        self.assertIn("LIMIT 100", sql.upper())

    def test_scope_injects_ma_hv_for_hoc_vien(self):
        sql = apply_scope(
            "SELECT gpa_he4 FROM sql_curated.v_hoc_vien_gpa LIMIT 5",
            {"roles": ["HocVien"], "scopeMaHv": "666106"},
        )
        self.assertIn("v_hoc_vien_gpa.ma_hv = '666106'", sql)

    def test_scope_normalizes_hoc_vien_role_and_replaces_wrong_filter(self):
        sql = apply_scope(
            "SELECT gpa_he4 FROM sql_curated.v_hoc_vien_gpa WHERE ma_hv = 'WRONG' LIMIT 5",
            {"roles": ["HocVien"], "scopeMaHv": "666106"},
        )
        self.assertIn("v_hoc_vien_gpa.ma_hv = '666106'", sql)
        self.assertNotIn("WRONG", sql)

    def test_scope_qualifies_join_aliases(self):
        sql = apply_scope(
            (
                "SELECT dm.ma_hv, hv.gpa_he4 "
                "FROM sql_curated.v_diem_mon dm "
                "JOIN sql_curated.v_hoc_vien_gpa hv ON dm.ma_hv = hv.ma_hv "
                "LIMIT 10"
            ),
            {"roles": ["HOC_VIEN"], "scopeMaHv": "666106"},
        )
        self.assertIn("dm.ma_hv = '666106'", sql)
        self.assertIn("hv.ma_hv = '666106'", sql)

    def test_scope_blocks_giang_vien_on_exam_schedule(self):
        with self.assertRaises(SqlScopeError):
            apply_scope(
                "SELECT ma_de FROM sql_curated.v_lich_thi_tong_quan LIMIT 5",
                {"roles": ["GIANG_VIEN"], "scopeMaGv": "GV5976"},
            )

    def test_scope_staff_no_filter(self):
        sql = apply_scope(
            "SELECT COUNT(*) FROM sql_curated.v_ket_qua_hoc_ky WHERE muc_canh_bao > 0 LIMIT 10",
            {"roles": ["ADMIN"], "username": "admin"},
        )
        self.assertNotIn("ma_hv =", sql)


if __name__ == "__main__":
    unittest.main()

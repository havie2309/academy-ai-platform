import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.router import classify_route  # noqa: E402
from app.sql_guardrail import SqlGuardrailError, apply_guardrail  # noqa: E402
from app.sql_scope import SqlScopeError, apply_scope  # noqa: E402


def test_classify_route_sql_keywords():
    assert classify_route("GPA học viên 676156 là bao nhiêu?") == "sql"
    assert classify_route("Lịch dạy của giảng viên") == "sql"
    assert classify_route("Quy định vắng 25% học phần") == "rag"


def test_guardrail_blocks_delete():
    try:
        apply_guardrail("DELETE FROM sql_curated.v_hoc_vien_gpa LIMIT 1")
        raise AssertionError("expected SqlGuardrailError")
    except SqlGuardrailError:
        pass


def test_guardrail_blocks_multi_statement():
    try:
        apply_guardrail(
            "SELECT * FROM sql_curated.v_hoc_vien_gpa LIMIT 1; DROP TABLE users;"
        )
        raise AssertionError("expected SqlGuardrailError")
    except SqlGuardrailError:
        pass


def test_guardrail_allows_curated_select():
    sql = apply_guardrail(
        "SELECT ma_hv, gpa_he4 FROM sql_curated.v_hoc_vien_gpa LIMIT 10"
    )
    assert "LIMIT" in sql.upper()
    assert "v_hoc_vien_gpa" in sql


def test_guardrail_adds_limit_when_missing():
    sql = apply_guardrail("SELECT ma_hv FROM sql_curated.v_hoc_vien_gpa")
    assert sql.upper().endswith("LIMIT 100") or "LIMIT" in sql.upper()


def test_scope_injects_ma_hv_for_hoc_vien():
    sql = apply_scope(
        "SELECT gpa_he4 FROM sql_curated.v_hoc_vien_gpa LIMIT 5",
        {"roles": ["HocVien"], "username": "666106"},
    )
    assert "ma_hv = '666106'" in sql


def test_scope_normalizes_hoc_vien_role():
    sql = apply_scope(
        "SELECT gpa_he4 FROM sql_curated.v_hoc_vien_gpa WHERE ma_hv = 'WRONG' LIMIT 5",
        {"roles": ["HocVien"], "username": "666106"},
    )
    assert "ma_hv = '666106'" in sql
    assert "WRONG" not in sql


def test_scope_blocks_giang_vien_on_exam_schedule():
    try:
        apply_scope(
            "SELECT ma_de FROM sql_curated.v_lich_thi_tong_quan LIMIT 5",
            {"roles": ["GIANG_VIEN"], "username": "GV5976"},
        )
        raise AssertionError("expected SqlScopeError")
    except SqlScopeError:
        pass


def test_scope_staff_no_filter():
    sql = apply_scope(
        "SELECT COUNT(*) FROM sql_curated.v_ket_qua_hoc_ky WHERE muc_canh_bao > 0 LIMIT 10",
        {"roles": ["ADMIN"], "username": "admin"},
    )
    assert "ma_hv =" not in sql

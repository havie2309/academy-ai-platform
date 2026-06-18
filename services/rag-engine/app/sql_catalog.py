"""Curated view catalog for Text-to-SQL prompts and guardrail whitelist."""

from __future__ import annotations

SQL_SCHEMA = "sql_curated"

CURATED_VIEWS: dict[str, list[tuple[str, str]]] = {
    "v_hoc_vien_gpa": [
        ("ma_hv", "Mã học viên"),
        ("ho_ten", "Họ tên"),
        ("ma_lop", "Mã lớp"),
        ("ten_nganh", "Tên ngành"),
        ("gpa_he4", "GPA hệ 4"),
        ("gpa_he10", "GPA hệ 10"),
        ("so_tin_chi_tich_luy", "Số tín chỉ tích lũy"),
        ("muc_canh_bao", "Mức cảnh báo học tập (0=không, 1-3=cảnh báo)"),
        ("trang_thai", "Trạng thái (dang_hoc, tot_nghiep, thoi_hoc)"),
    ],
    "v_diem_mon": [
        ("ma_hv", "Mã học viên"),
        ("ho_ten", "Họ tên"),
        ("ma_mon", "Mã môn"),
        ("ten_mon", "Tên môn"),
        ("so_tin_chi", "Số tín chỉ"),
        ("ten_hoc_ky", "Tên học kỳ"),
        ("diem_tong_ket", "Điểm tổng kết"),
        ("diem_chu", "Điểm chữ"),
        ("diem_he4", "Điểm hệ 4"),
        ("dat", "Đạt môn (true/false)"),
    ],
    "v_ket_qua_hoc_ky": [
        ("ma_hv", "Mã học viên"),
        ("ho_ten", "Họ tên"),
        ("ten_hoc_ky", "Tên học kỳ"),
        ("gpa_hoc_ky_he4", "GPA học kỳ hệ 4"),
        ("gpa_tich_luy_he4", "GPA tích lũy hệ 4"),
        ("gpa_hoc_ky_he10", "GPA học kỳ hệ 10"),
        ("xep_loai", "Xếp loại"),
        ("muc_canh_bao", "Mức cảnh báo học tập"),
        ("so_tc_dat", "Số TC đạt"),
        ("so_tc_tich_luy", "Số TC tích lũy"),
        ("diem_ren_luyen", "Điểm rèn luyện"),
    ],
    "v_lop_hoc_phan_giang_day": [
        ("ma_lhp", "Mã lớp học phần"),
        ("ten_lhp", "Tên lớp học phần"),
        ("ma_mon", "Mã môn"),
        ("ten_mon", "Tên môn"),
        ("ten_hoc_ky", "Tên học kỳ"),
        ("ma_gv", "Mã giảng viên"),
        ("ten_giang_vien", "Tên giảng viên"),
        ("phong", "Phòng học"),
        ("si_so_toi_da", "Sĩ số tối đa"),
    ],
    "v_lich_thi_tong_quan": [
        ("ma_de", "Mã đề thi (metadata)"),
        ("exam_code", "Mã kỳ thi"),
        ("ngay_gio_thi", "Ngày giờ thi"),
        ("thoi_luong_phut", "Thời lượng phút"),
        ("ma_lhp", "Mã lớp học phần"),
        ("ten_mon", "Tên môn"),
        ("ten_hoc_ky", "Tên học kỳ"),
        ("phong", "Phòng thi"),
        ("ten_giang_vien", "Giảng viên phụ trách"),
    ],
}

VIEW_SCOPE_COLUMN: dict[str, str | None] = {
    "v_hoc_vien_gpa": "ma_hv",
    "v_diem_mon": "ma_hv",
    "v_ket_qua_hoc_ky": "ma_hv",
    "v_lop_hoc_phan_giang_day": "ma_gv",
    "v_lich_thi_tong_quan": None,
}


def allowed_view_names() -> set[str]:
    return set(CURATED_VIEWS.keys())


def fully_qualified_view(view_name: str) -> str:
    return f"{SQL_SCHEMA}.{view_name}"


def build_schema_prompt() -> str:
    lines = [
        "Chỉ được truy vấn các VIEW sau (schema sql_curated), không dùng bảng gốc:",
    ]
    for view, columns in CURATED_VIEWS.items():
        cols = ", ".join(f"{name} ({desc})" for name, desc in columns)
        lines.append(f"- sql_curated.{view}: {cols}")
    return "\n".join(lines)

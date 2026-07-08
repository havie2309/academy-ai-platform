"""Curated view catalog for Text-to-SQL prompts and guardrail whitelist."""

from __future__ import annotations

SQL_SCHEMA = "sql_curated"

CURATED_VIEW_DESCRIPTIONS: dict[str, str] = {
    "v_hoc_vien_gpa": (
        "1 dòng / học viên. Dùng cho GPA tích lũy, tín chỉ tích lũy, "
        "mức cảnh báo học tập hiện tại. Có ma_lop."
    ),
    "v_diem_mon": (
        "Nhiều dòng / học viên theo từng môn học. Dùng cho bảng điểm, "
        "điểm tổng kết, điểm chữ, điểm hệ 4. **Có ma_lop và ten_hoc_ky** – "
        "đây là view duy nhất có điểm từng môn kèm lớp."
    ),
    "v_ket_qua_hoc_ky": (
        "Nhiều dòng / học viên theo từng học kỳ. Dùng cho GPA học kỳ, "
        "xếp loại, số tín chỉ đạt, điểm rèn luyện. **Không có ma_lop hay diem_tong_ket.**"
    ),
    "v_lop_hoc_phan_giang_day": (
        "Các lớp học phần giảng viên phụ trách. Dùng cho lịch dạy / lớp "
        "đang giảng dạy, không phải thời khóa biểu chi tiết từng tiết."
    ),
    "v_lich_thi_tong_quan": (
        "Metadata lịch thi tổng quan. Không chứa nội dung đề thi, chỉ dùng "
        "cho ngày giờ thi, phòng thi, học phần liên quan."
    ),
}

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
        ("ma_lop", "Mã lớp"),          # <-- added
        ("ma_mon", "Mã môn"),
        ("ten_mon", "Tên môn"),
        ("so_tin_chi", "Số tín chỉ"),
        ("ten_hoc_ky", "Tên học kỳ (đầy đủ: 'Học kỳ X Năm học YYYY-YYYY')"),
        ("diem_tong_ket", "Điểm tổng kết (thang 10)"),
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

SQL_FEW_SHOT_EXAMPLES: tuple[tuple[str, str], ...] = (
    (
        "GPA tích lũy của học viên 666106 là bao nhiêu?",
        "SELECT ho_ten, ma_hv, gpa_he4, gpa_he10, so_tin_chi_tich_luy, muc_canh_bao "
        "FROM sql_curated.v_hoc_vien_gpa WHERE ma_hv = '666106' LIMIT 1",
    ),
    (
        "Bảng điểm của học viên 666106",
        "SELECT ma_hv, ho_ten, ma_mon, ten_mon, ten_hoc_ky, diem_tong_ket, diem_chu, diem_he4, dat "
        "FROM sql_curated.v_diem_mon WHERE ma_hv = '666106' ORDER BY ten_hoc_ky DESC, ma_mon ASC LIMIT 20",
    ),
    (
        "Kết quả học kỳ gần nhất của học viên 666106",
        "SELECT ma_hv, ho_ten, ten_hoc_ky, gpa_hoc_ky_he4, gpa_tich_luy_he4, xep_loai, muc_canh_bao, diem_ren_luyen "
        "FROM sql_curated.v_ket_qua_hoc_ky WHERE ma_hv = '666106' ORDER BY ten_hoc_ky DESC LIMIT 5",
    ),
    (
        "Lịch dạy của giảng viên GV5976",
        "SELECT ma_lhp, ten_lhp, ma_mon, ten_mon, ten_hoc_ky, phong, si_so_toi_da "
        "FROM sql_curated.v_lop_hoc_phan_giang_day WHERE ma_gv = 'GV5976' ORDER BY ten_hoc_ky DESC, ma_lhp ASC LIMIT 20",
    ),
    (
        "Có bao nhiêu học viên bị cảnh báo theo từng học kỳ?",
        "SELECT ten_hoc_ky, COUNT(*) AS so_hoc_vien_canh_bao "
        "FROM sql_curated.v_ket_qua_hoc_ky WHERE muc_canh_bao > 0 "
        "GROUP BY ten_hoc_ky ORDER BY ten_hoc_ky DESC LIMIT 20",
    ),
    # NEW: Class average by semester – demonstrates using v_diem_mon with LIKE
    (
        "Thống kê điểm trung bình học kỳ 1 của học viên lớp K63A.",
        "SELECT AVG(diem_tong_ket) AS diem_trung_binh_hoc_ky_1 "
        "FROM sql_curated.v_diem_mon "
        "WHERE ma_lop = 'K63A' AND ten_hoc_ky LIKE '%Học kỳ 1%' LIMIT 100",
    ),
)


def allowed_view_names() -> set[str]:
    return set(CURATED_VIEWS.keys())


def fully_qualified_view(view_name: str) -> str:
    return f"{SQL_SCHEMA}.{view_name}"


def build_schema_prompt() -> str:
    lines = [
        "Chỉ được truy vấn các VIEW sau (schema sql_curated), không dùng bảng gốc:",
        "Ưu tiên chọn 1 view phù hợp trước; chỉ JOIN khi câu hỏi thật sự cần ghép nhiều miền dữ liệu.",
        "Nếu câu hỏi hỏi 'bao nhiêu' hoặc 'thống kê', ưu tiên COUNT/GROUP BY thay vì liệt kê toàn bộ chi tiết.",
        "Nếu câu hỏi hỏi lịch dạy thì dùng v_lop_hoc_phan_giang_day; nếu hỏi lịch thi thì dùng v_lich_thi_tong_quan.",
        "Nếu câu hỏi hỏi GPA tích lũy chung thì ưu tiên v_hoc_vien_gpa; nếu hỏi theo học kỳ thì ưu tiên v_ket_qua_hoc_ky.",
        "Nếu câu hỏi hỏi điểm từng môn hoặc trung bình điểm của một lớp trong một học kỳ, "
        "hãy dùng v_diem_mon (có ma_lop và diem_tong_ket).",
        "",
        "QUAN TRỌNG: `ten_hoc_ky` trong v_diem_mon có định dạng 'Học kỳ X Năm học YYYY-YYYY'. "
        "Để lọc theo học kỳ, dùng `LIKE '%Học kỳ X%'`, không dùng `= 'Học kỳ X'` vì sẽ không khớp.",
    ]
    for view, columns in CURATED_VIEWS.items():
        description = CURATED_VIEW_DESCRIPTIONS.get(view, "")
        cols = ", ".join(f"{name} ({desc})" for name, desc in columns)
        if description:
            lines.append(f"- sql_curated.{view}: {description}")
        lines.append(f"  Cột: {cols}")
    return "\n".join(lines)


def build_few_shot_prompt() -> str:
    lines = [
        "Ví dụ tham chiếu (question -> SQL):",
    ]
    for index, (question, sql) in enumerate(SQL_FEW_SHOT_EXAMPLES, start=1):
        lines.append(f"{index}. Q: {question}")
        lines.append(f"   SQL: {sql}")
    return "\n".join(lines)


def column_labels_map() -> dict[str, str]:
    """Merge column → Vietnamese label from all curated views."""
    labels: dict[str, str] = {}
    for columns in CURATED_VIEWS.values():
        for name, desc in columns:
            labels.setdefault(name, desc)
    return labels


def column_label(col: str) -> str:
    """Human-readable Vietnamese header (no DB id, no parenthetical notes)."""
    import re

    raw = column_labels_map().get(col, col.replace("_", " "))
    short = re.sub(r"\s*\([^)]*\)", "", raw).strip()
    return short or col

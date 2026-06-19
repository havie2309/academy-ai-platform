"""Format SQL result rows as Vietnamese markdown for chat UI."""

from __future__ import annotations

import unicodedata
from decimal import Decimal

from app.sql_catalog import column_label
from app.sql_templates import is_gpa_query


def _fold(text: str) -> str:
    lowered = text.lower()
    normalized = unicodedata.normalize("NFD", lowered)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _fmt_cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Có" if value else "Không"
    if isinstance(value, (float, Decimal)):
        text = f"{float(value):.2f}".rstrip("0").rstrip(".")
        return text.replace(".", ",")
    return str(value)


def _row_dict(columns: list[str], row: tuple) -> dict[str, object]:
    return {col: row[i] if i < len(row) else None for i, col in enumerate(columns)}


def _labeled_headers(columns: list[str]) -> list[str]:
    return [column_label(col) for col in columns]


def rows_to_markdown_table(columns: list[str], rows: list[tuple]) -> str:
    if not columns:
        return "_Không có cột dữ liệu._"
    if not rows:
        return "_Không có dòng dữ liệu phù hợp._"

    headers = _labeled_headers(columns)
    header = "| " + " | ".join(headers) + " |"
    sep = "| " + " | ".join("---" for _ in headers) + " |"
    body_lines = []
    for row in rows:
        cells = [_fmt_cell(v) for v in row]
        body_lines.append("| " + " | ".join(cells) + " |")
    return "\n".join([header, sep, *body_lines])


def _format_gpa_profile_sentence(row: dict[str, object]) -> str:
    ho_ten = _fmt_cell(row.get("ho_ten"))
    ma_hv = _fmt_cell(row.get("ma_hv"))
    gpa4 = row.get("gpa_he4") if row.get("gpa_he4") is not None else row.get("gpa_tich_luy_he4")
    gpa10 = row.get("gpa_he10")
    tin_chi = row.get("so_tin_chi_tich_luy") or row.get("so_tc_tich_luy")
    canh_bao = row.get("muc_canh_bao")
    hoc_ky = _fmt_cell(row.get("ten_hoc_ky"))

    if ho_ten and ma_hv:
        subject = f"Học viên **{ho_ten}** (mã **{ma_hv}**)"
    elif ho_ten:
        subject = f"Học viên **{ho_ten}**"
    elif ma_hv:
        subject = f"Học viên mã **{ma_hv}**"
    else:
        subject = "Học viên"

    details: list[str] = []
    if gpa4 is not None and gpa4 != "":
        if hoc_ky:
            details.append(f"GPA học kỳ {hoc_ky} hệ 4 là **{_fmt_cell(gpa4)}**")
        else:
            details.append(f"GPA tích lũy hệ 4 là **{_fmt_cell(gpa4)}**")
    if gpa10 is not None and gpa10 != "":
        details.append(f"hệ 10 là **{_fmt_cell(gpa10)}**")
    if tin_chi is not None and tin_chi != "":
        details.append(f"đã tích lũy **{_fmt_cell(tin_chi)}** tín chỉ")
    if canh_bao is not None and canh_bao != "":
        level = int(canh_bao) if str(canh_bao).isdigit() else canh_bao
        if level == 0 or level == "0":
            details.append("không ở mức cảnh báo học tập")
        else:
            details.append(f"đang ở mức cảnh báo học tập **{level}**")

    if not details:
        return f"{subject}: không có đủ dữ liệu GPA trong hệ thống."

    if len(details) == 1:
        return f"{subject} có {details[0]}."
    if len(details) == 2:
        return f"{subject} có {details[0]} và {details[1]}."
    body = ", ".join(details[:-1]) + f" và {details[-1]}"
    return f"{subject} có {body}."


def _is_gpa_result_row(columns: list[str], row: dict[str, object]) -> bool:
    cols = {c.lower() for c in columns}
    has_gpa = bool(cols & {"gpa_he4", "gpa_he10", "gpa_tich_luy_he4", "gpa_hoc_ky_he4"})
    has_identity = bool(cols & {"ho_ten", "ma_hv"})
    return has_gpa and has_identity and any(row.get(c) is not None for c in columns if "gpa" in c)


def _format_scalar_sentence(columns: list[str], row: tuple) -> str:
    label = column_label(columns[0])
    value = _fmt_cell(row[0])
    return f"{label}: **{value}**."


def build_answer(question: str, columns: list[str], rows: list[tuple]) -> str:
    count = len(rows)
    if count == 0:
        return "Không tìm thấy dữ liệu phù hợp với câu hỏi của bạn."

    folded_q = _fold(question)

    if count == 1:
        row_dict = _row_dict(columns, rows[0])
        if len(columns) == 1:
            return _format_scalar_sentence(columns, rows[0])
        if is_gpa_query(question) or _is_gpa_result_row(columns, row_dict):
            return _format_gpa_profile_sentence(row_dict)
        if count == 1 and len(columns) <= 4:
            bullets = [
                f"- **{column_label(col)}:** {_fmt_cell(row_dict.get(col))}"
                for col in columns
                if _fmt_cell(row_dict.get(col))
            ]
            if bullets:
                return "Kết quả tra cứu:\n\n" + "\n".join(bullets)

    summary = f"Tìm thấy **{count}** dòng dữ liệu liên quan đến câu hỏi."
    if "bao nhieu" in folded_q or "so luong" in folded_q:
        if count == 1 and len(columns) == 1:
            return _format_scalar_sentence(columns, rows[0])

    table = rows_to_markdown_table(columns, rows)
    return f"{summary}\n\n{table}"

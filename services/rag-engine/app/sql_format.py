"""Format SQL result rows as Vietnamese markdown for chat UI."""

from __future__ import annotations


def _fmt_cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Có" if value else "Không"
    if isinstance(value, float):
        text = f"{value:.2f}".rstrip("0").rstrip(".")
        return text
    return str(value)


def rows_to_markdown_table(columns: list[str], rows: list[tuple]) -> str:
    if not columns:
        return "_Không có cột dữ liệu._"
    if not rows:
        return "_Không có dòng dữ liệu phù hợp._"

    header = "| " + " | ".join(columns) + " |"
    sep = "| " + " | ".join("---" for _ in columns) + " |"
    body_lines = []
    for row in rows:
        cells = [_fmt_cell(v) for v in row]
        body_lines.append("| " + " | ".join(cells) + " |")
    return "\n".join([header, sep, *body_lines])


def build_answer(question: str, columns: list[str], rows: list[tuple]) -> str:
    count = len(rows)
    if count == 0:
        summary = "Không tìm thấy dữ liệu phù hợp với câu hỏi của bạn."
    elif count == 1 and len(columns) == 1:
        summary = f"Kết quả: **{_fmt_cell(rows[0][0])}**."
    else:
        summary = f"Tìm thấy **{count}** dòng dữ liệu liên quan đến câu hỏi."

    table = rows_to_markdown_table(columns, rows)
    return f"{summary}\n\n{table}"

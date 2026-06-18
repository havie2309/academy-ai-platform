"""Lightweight intent router: RAG vs SQL (E-01 precursor)."""

from __future__ import annotations

import re
import unicodedata

_SQL_HINTS = (
    "gpa",
    "diem",
    "điểm",
    "học kỳ",
    "hoc ky",
    "cảnh báo",
    "canh bao",
    "lịch dạy",
    "lich day",
    "lịch thi",
    "lich thi",
    "bảng điểm",
    "bang diem",
    "xếp loại",
    "xep loai",
    "học viên",
    "hoc vien",
    "giảng viên",
    "giang vien",
    "lớp học phần",
    "lop hoc phan",
    "tín chỉ",
    "tin chi",
    "môn học",
    "mon hoc",
    "bao nhiêu học viên",
    "bao nhieu hoc vien",
    "thống kê",
    "thong ke",
    "truy vấn",
    "truy van",
    "select",
)


def _fold(text: str) -> str:
    lowered = text.lower()
    normalized = unicodedata.normalize("NFD", lowered)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def classify_route(query: str) -> str:
    folded = _fold(query)
    for hint in _SQL_HINTS:
        if _fold(hint) in folded:
            return "sql"
    if re.search(r"\b(sql|postgres|database|db)\b", folded):
        return "sql"
    return "rag"

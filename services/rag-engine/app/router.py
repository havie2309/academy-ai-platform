"""Lightweight intent router for rag/sql/reject/task_assist."""

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

_TASK_ASSIST_STRONG_HINTS = (
    "viet giup",
    "soan giup",
    "viet dum",
    "soan dum",
    "mau email",
    "mau don",
    "template",
    "email",
    "e-mail",
    "thong bao",
    "tin nhan",
    "checklist",
    "ke hoach",
    "viet lai",
    "chinh sua",
    "rewrite",
    "draft",
    "translate",
    "dich giup",
)

_TASK_ASSIST_SOFT_HINTS = (
    "tom tat giup",
    "dien giai giup",
    "goi y",
    "de cuong",
)

_LOOKUP_HINTS = (
    "quy dinh",
    "quy che",
    "dieu kien",
    "thu tuc",
    "ho so",
    "hoc phi",
    "chuyen can",
    "tot nghiep",
    "dang ky",
    "hoc bong",
    "tai lieu",
    "van ban",
    "quyet dinh",
    "noi dung",
    "bao gio",
    "khi nao",
    "o dau",
)

_ACADEMIC_HINTS = (
    "dao tao",
    "khao thi",
    "hoc vien",
    "giang vien",
    "sinh vien",
    "hoc phan",
    "mon hoc",
    "phong dao tao",
    "hoc vu",
    *_LOOKUP_HINTS,
)

_REJECT_HINTS = (
    "thoi tiet",
    "weather",
    "bitcoin",
    "crypto",
    "chung khoan",
    "co phieu",
    "gia vang",
    "gia usd",
    "bong da",
    "ty so",
    "lich thi dau",
    "nau an",
    "cong thuc",
    "tu vi",
    "xem boi",
    "phim",
    "ca nhac",
    "du lich",
    "khach san",
    "ve may bay",
)

_DML_KEYWORDS = (
    "xóa",
    "cập nhật",
    "chèn",
    "xoá",
    "delete",
    "update",
    "insert",
    "drop",
    "alter",
    "truncate",
    "removing",
    "remover",
    "sửa",
    "thay đổi",
)

_RAG_FORCE_KEYWORDS = (
    # Existing policy phrases
    "theo quy định",
    "theo quy che",
    "theo nội quy",
    "theo quy chế",
    "quy định của học viện",
    "nội quy học viện",
    "quy chế đào tạo",
    "theo luật",
    "theo chính sách",
    "đáp án",
    "chính thức",
    # Action/state questions that are policy-related
    "có được",
    "được phép",
    "bị cấm",
    "nghiêm cấm",
    "có bắt buộc",
    "không được phép",
    "có bị hủy",
    "có được mang",
)

def _fold(text: str) -> str:
    lowered = text.lower()
    normalized = unicodedata.normalize("NFD", lowered)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _contains_any(text: str, hints: tuple[str, ...]) -> bool:
    return any(_fold(hint) in text for hint in hints)


def _looks_like_task_assist(text: str) -> bool:
    strong = _contains_any(text, _TASK_ASSIST_STRONG_HINTS)
    soft = _contains_any(text, _TASK_ASSIST_SOFT_HINTS)
    if not strong and not soft:
        return False
    if soft and _contains_any(text, _LOOKUP_HINTS):
        return False
    return True


def _looks_like_reject(text: str) -> bool:
    if not _contains_any(text, _REJECT_HINTS):
        return False
    if _contains_any(text, _ACADEMIC_HINTS):
        return False
    return True


def _looks_like_dml(text: str) -> bool:
    """Check if the query contains DML keywords (data modification intent)."""
    return _contains_any(text, _DML_KEYWORDS)


def _force_rag(text: str) -> bool:
    """
    If the query explicitly asks about policies, rules, or regulations,
    force RAG to ground the answer in documents.
    """
    return _contains_any(text, _RAG_FORCE_KEYWORDS)


def classify_route(query: str) -> str:
    folded = _fold(query)
    if _force_rag(folded):
        return "rag"
    if _looks_like_dml(folded):
        return "dml_denied"
    for hint in _SQL_HINTS:
        if _fold(hint) in folded:
            return "sql"
    if re.search(r"\b(sql|postgres|database|db)\b", folded):
        return "sql"
    if _looks_like_task_assist(folded):
        return "task_assist"
    if _looks_like_reject(folded):
        return "reject"
    return "rag"

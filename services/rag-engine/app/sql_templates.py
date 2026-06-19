"""Deterministic SQL for high-value demo queries (avoid LLM placeholder filters)."""

from __future__ import annotations

import re
import unicodedata

from app.sql_guardrail import apply_guardrail
from app.sql_resolve import resolve_lecturer_ma_gv, resolve_student_ma_hv
from app.sql_roles import is_lecturer_role, is_staff_role, is_student_role


def _fold(text: str) -> str:
    lowered = text.lower()
    normalized = unicodedata.normalize("NFD", lowered)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def is_self_query(question: str) -> bool:
    folded = _fold(question)
    return any(
        phrase in folded
        for phrase in (
            "cua toi",
            "cua minh",
            "cua ban than toi",
            "toi la bao nhieu",
            "cua em",
        )
    )


def _extract_ma_hv(question: str) -> str | None:
    match = re.search(r"\b(\d{5,8})\b", question)
    return match.group(1) if match else None


def _extract_ma_gv(question: str) -> str | None:
    match = re.search(r"\b(GV\d+)\b", question, flags=re.I)
    return match.group(1).upper() if match else None


def is_gpa_query(question: str) -> bool:
    folded = _fold(question)
    return "gpa" in folded or "tich luy" in folded or "diem trung binh" in folded


def is_gradebook_query(question: str) -> bool:
    folded = _fold(question)
    return any(
        phrase in folded
        for phrase in (
            "bang diem",
            "diem mon",
            "diem tong ket",
            "diem chu",
            "ket qua mon hoc",
        )
    )


def is_semester_result_query(question: str) -> bool:
    folded = _fold(question)
    return any(
        phrase in folded
        for phrase in (
            "ket qua hoc ky",
            "xep loai",
            "diem ren luyen",
            "gpa hoc ky",
        )
    )


async def try_template_sql(question: str, user: dict) -> str | None:
    folded = _fold(question)
    user_scope_hv = str(user.get("scopeMaHv") or "").strip()
    user_scope_gv = str(user.get("scopeMaGv") or "").strip()

    if is_gpa_query(question):
        ma_hv = _extract_ma_hv(question)
        if not ma_hv and is_self_query(question):
            ma_hv = user_scope_hv or await resolve_student_ma_hv(user)
        if ma_hv:
            sql = (
                "SELECT ho_ten, ma_hv, gpa_he4, gpa_he10, so_tin_chi_tich_luy, muc_canh_bao "
                f"FROM sql_curated.v_hoc_vien_gpa WHERE ma_hv = '{ma_hv}' LIMIT 1"
            )
            return apply_guardrail(sql)
        if is_self_query(question) and (is_student_role(user.get("roles")) or not is_staff_role(user.get("roles"))):
            return None  # caller returns friendly "no profile" message

    if is_gradebook_query(question):
        ma_hv = _extract_ma_hv(question)
        if not ma_hv and is_self_query(question):
            ma_hv = user_scope_hv or await resolve_student_ma_hv(user)
        if ma_hv:
            sql = (
                "SELECT ma_hv, ho_ten, ma_mon, ten_mon, ten_hoc_ky, diem_tong_ket, diem_chu, diem_he4, dat "
                f"FROM sql_curated.v_diem_mon WHERE ma_hv = '{ma_hv}' "
                "ORDER BY ten_hoc_ky DESC, ma_mon ASC LIMIT 20"
            )
            return apply_guardrail(sql)

    if is_semester_result_query(question):
        ma_hv = _extract_ma_hv(question)
        if not ma_hv and is_self_query(question):
            ma_hv = user_scope_hv or await resolve_student_ma_hv(user)
        if ma_hv:
            sql = (
                "SELECT ma_hv, ho_ten, ten_hoc_ky, gpa_hoc_ky_he4, gpa_tich_luy_he4, "
                "gpa_hoc_ky_he10, xep_loai, muc_canh_bao, so_tc_dat, so_tc_tich_luy, diem_ren_luyen "
                f"FROM sql_curated.v_ket_qua_hoc_ky WHERE ma_hv = '{ma_hv}' "
                "ORDER BY ten_hoc_ky DESC LIMIT 10"
            )
            return apply_guardrail(sql)

    if "lich day" in folded or ("lop hoc phan" in folded and "giang" in folded):
        ma_gv = _extract_ma_gv(question)
        if not ma_gv and is_self_query(question):
            ma_gv = user_scope_gv or await resolve_lecturer_ma_gv(user)
        if ma_gv:
            sql = (
                "SELECT ma_lhp, ten_mon, ten_hoc_ky, phong, si_so_toi_da "
                f"FROM sql_curated.v_lop_hoc_phan_giang_day WHERE ma_gv = '{ma_gv}' LIMIT 20"
            )
            return apply_guardrail(sql)

    if is_staff_role(user.get("roles")) and ("canh bao" in folded or "canh cao" in folded):
        if "bao nhieu" in folded or "so hoc vien" in folded or "thong ke" in folded:
            sql = (
                "SELECT ten_hoc_ky, COUNT(*) AS so_hoc_vien_canh_bao "
                "FROM sql_curated.v_ket_qua_hoc_ky "
                "WHERE muc_canh_bao > 0 "
                "GROUP BY ten_hoc_ky "
                "ORDER BY ten_hoc_ky DESC "
                "LIMIT 20"
            )
            return apply_guardrail(sql)

    if "lich thi" in folded and is_staff_role(user.get("roles")):
        sql = (
            "SELECT ngay_gio_thi, ten_mon, ten_hoc_ky, phong, ma_lhp "
            "FROM sql_curated.v_lich_thi_tong_quan "
            "ORDER BY ngay_gio_thi ASC LIMIT 20"
        )
        return apply_guardrail(sql)

    return None

-- Curated views for Text-to-SQL (F-01). No raw exam question tables exposed.
CREATE SCHEMA IF NOT EXISTS sql_curated;

CREATE OR REPLACE VIEW sql_curated.v_hoc_vien_gpa AS
SELECT
    ma_hv,
    ho_ten,
    ma_lop,
    ten_nganh,
    gpa_he4,
    gpa_he10,
    so_tin_chi_tich_luy,
    muc_canh_bao,
    trang_thai
FROM hoc_vien;

CREATE OR REPLACE VIEW sql_curated.v_diem_mon AS
SELECT
    ma_hv,
    ho_ten_hv AS ho_ten,
    ma_mon,
    ten_mon,
    so_tin_chi,
    ten_hoc_ky,
    diem_tong_ket,
    diem_chu,
    diem_he4,
    dat
FROM diem;

CREATE OR REPLACE VIEW sql_curated.v_ket_qua_hoc_ky AS
SELECT
    ma_hv,
    ho_ten_hv AS ho_ten,
    ten_hoc_ky,
    gpa_hoc_ky_he4,
    gpa_tich_luy_he4,
    gpa_hoc_ky_he10,
    xep_loai,
    muc_canh_bao,
    so_tc_dat,
    so_tc_tich_luy,
    diem_ren_luyen
FROM ket_qua_hoc_ky;

-- Teaching assignments (lop hoc phan) — proxy for "lich day" until TKB tables exist.
CREATE OR REPLACE VIEW sql_curated.v_lop_hoc_phan_giang_day AS
SELECT
    lhp.ma_lhp,
    lhp.ten_lhp,
    lhp.ma_mon,
    lhp.ten_mon,
    lhp.ten_hoc_ky,
    gv.ma_gv,
    gv.ho_ten AS ten_giang_vien,
    lhp.phong,
    lhp.si_so_toi_da
FROM lop_hoc_phan lhp
JOIN giang_vien gv ON gv.id = lhp.giang_vien_id
WHERE lhp.active = TRUE AND gv.active = TRUE;

-- Exam schedule metadata only — no question content.
CREATE OR REPLACE VIEW sql_curated.v_lich_thi_tong_quan AS
SELECT
    eb.code AS ma_de,
    eb.exam_code,
    eb.exam_day AS ngay_gio_thi,
    eb.exam_time AS thoi_luong_phut,
    lhp.ma_lhp,
    lhp.ten_mon,
    lhp.ten_hoc_ky,
    lhp.phong,
    lhp.ten_giang_vien
FROM exam_banks eb
LEFT JOIN lop_hoc_phan lhp ON lhp.id = eb.lop_hoc_phan_id
WHERE eb.active = TRUE AND eb.deleted_at IS NULL;

-- F-07: SQL audit log (written by rag-engine via pm2_user, not pm2_readonly).
CREATE TABLE IF NOT EXISTS sql_query_audit (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20),
    username VARCHAR(100),
    roles TEXT,
    question TEXT NOT NULL,
    generated_sql TEXT,
    guarded_sql TEXT,
    status VARCHAR(20) NOT NULL,
    deny_reason TEXT,
    row_count INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sql_query_audit_user_id ON sql_query_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_sql_query_audit_created_at ON sql_query_audit (created_at);

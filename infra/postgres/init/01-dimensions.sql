-- ============================================
-- DIMENSION TABLES
-- ============================================

-- nam_hoc - Năm học
CREATE TABLE nam_hoc (
    id VARCHAR(20) PRIMARY KEY,
    ma VARCHAR(50),
    ten VARCHAR(100),
    ngay_bat_dau DATE,
    ngay_ket_thuc DATE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- hoc_ky - Học kỳ
CREATE TABLE hoc_ky (
    id VARCHAR(20) PRIMARY KEY,
    ma VARCHAR(50),
    ten VARCHAR(100),
    loai_hoc_ky VARCHAR(50),
    nam_hoc_id VARCHAR(20) REFERENCES nam_hoc(id),
    ten_nam_hoc VARCHAR(100),
    ngay_bat_dau DATE,
    ngay_ket_thuc DATE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- don_vi - Đơn vị / Khoa / Bộ môn
CREATE TABLE don_vi (
    id VARCHAR(20) PRIMARY KEY,
    ma VARCHAR(50),
    ten VARCHAR(255),
    ten_viet_tat VARCHAR(100),
    cap_don_vi INTEGER,
    parent_id VARCHAR(20) REFERENCES don_vi(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- giang_vien - Giảng viên
CREATE TABLE giang_vien (
    id VARCHAR(20) PRIMARY KEY,
    ma_gv VARCHAR(50),
    ho_ten VARCHAR(255),
    email VARCHAR(255),
    so_dien_thoai VARCHAR(20),
    don_vi_id VARCHAR(20) REFERENCES don_vi(id),
    ten_don_vi VARCHAR(255),
    hoc_vi VARCHAR(100),
    hoc_ham VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

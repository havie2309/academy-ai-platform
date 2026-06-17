-- ============================================
-- DIMENSION TABLES
-- ============================================

-- data_zones - Vùng dữ liệu (nhóm nghiệp vụ lớn)
CREATE TABLE data_zones (
    zone_code VARCHAR(50) PRIMARY KEY,
    zone_name VARCHAR(200) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- data_categories - Loại tài liệu, thuộc về một zone
CREATE TABLE data_categories (
    category_code VARCHAR(50) PRIMARY KEY,
    category_name VARCHAR(200) NOT NULL,
    zone_code VARCHAR(50) NOT NULL REFERENCES data_zones(zone_code) ON DELETE RESTRICT,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

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


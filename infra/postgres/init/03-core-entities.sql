-- ============================================
-- CORE ENTITY TABLES
-- ============================================

-- hoc_vien - Học viên / Sinh viên (BẢNG TRUNG TÂM)
CREATE TABLE hoc_vien (
    id VARCHAR(20) PRIMARY KEY,
    ma_hv VARCHAR(50),
    ho_ten VARCHAR(255),
    ngay_sinh DATE,
    noi_sinh VARCHAR(255),
    que_quan VARCHAR(255),
    email VARCHAR(255),
    so_dien_thoai VARCHAR(20),
    ma_lop VARCHAR(50),
    ten_chuyen_nganh VARCHAR(255),
    ten_nganh VARCHAR(255),
    ten_khoa_dao_tao VARCHAR(100),
    trang_thai VARCHAR(50) CHECK (trang_thai IN ('dang_hoc', 'tot_nghiep', 'thoi_hoc')),
    gpa_he4 DECIMAL(4,2),
    gpa_he10 DECIMAL(5,2),
    so_tin_chi_tich_luy INTEGER,
    muc_canh_bao INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- mon_hoc - Môn học
CREATE TABLE mon_hoc (
    id VARCHAR(20) PRIMARY KEY,
    ma_mon VARCHAR(50),
    ten_mon VARCHAR(255),
    so_tin_chi INTEGER,
    so_tiet INTEGER,
    don_vi_ql_id VARCHAR(20) REFERENCES don_vi(id),
    ten_don_vi_ql VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- lop_hoc_phan - Lớp học phần
CREATE TABLE lop_hoc_phan (
    id VARCHAR(20) PRIMARY KEY,
    ma_lhp VARCHAR(50),
    ten_lhp VARCHAR(255),
    mon_hoc_id VARCHAR(20) REFERENCES mon_hoc(id),
    ma_mon VARCHAR(50),
    ten_mon VARCHAR(255),
    hoc_ky_id VARCHAR(20) REFERENCES hoc_ky(id),
    ten_hoc_ky VARCHAR(100),
    giang_vien_id VARCHAR(20) REFERENCES giang_vien(id),
    ten_giang_vien VARCHAR(255),
    si_so_toi_da INTEGER,
    phong VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- diem - Điểm môn học
CREATE TABLE diem (
    id SERIAL PRIMARY KEY,
    hoc_vien_id VARCHAR(20) REFERENCES hoc_vien(id),
    ma_hv VARCHAR(50),
    ho_ten_hv VARCHAR(255),
    mon_hoc_id VARCHAR(20) REFERENCES mon_hoc(id),
    ma_mon VARCHAR(50),
    ten_mon VARCHAR(255),
    so_tin_chi INTEGER,
    hoc_ky_id VARCHAR(20) REFERENCES hoc_ky(id),
    ten_hoc_ky VARCHAR(100),
    lop_hoc_phan_id VARCHAR(20) REFERENCES lop_hoc_phan(id),
    diem_chuyen_can DECIMAL(4,2),
    diem_thuong_xuyen DECIMAL(4,2),
    diem_thi DECIMAL(4,2),
    diem_tong_ket DECIMAL(4,2),
    diem_chu VARCHAR(5),
    diem_he4 DECIMAL(3,2),
    dat BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (hoc_vien_id, mon_hoc_id, hoc_ky_id)
);

-- ket_qua_hoc_ky - Kết quả học kỳ
CREATE TABLE ket_qua_hoc_ky (
    id VARCHAR(20) PRIMARY KEY,
    hoc_vien_id VARCHAR(20) REFERENCES hoc_vien(id),
    ma_hv VARCHAR(50),
    ho_ten_hv VARCHAR(255),
    hoc_ky_id VARCHAR(20) REFERENCES hoc_ky(id),
    ten_hoc_ky VARCHAR(100),
    gpa_hoc_ky_he4 DECIMAL(4,2),
    gpa_tich_luy_he4 DECIMAL(4,2),
    gpa_hoc_ky_he10 DECIMAL(5,2),
    so_tc_dang_ky INTEGER,
    so_tc_dat INTEGER,
    so_tc_tich_luy INTEGER,
    xep_loai VARCHAR(50),
    diem_ren_luyen INTEGER,
    muc_canh_bao INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (hoc_vien_id, hoc_ky_id)
);

-- documents - Metadata tài liệu (bản ghi master)
CREATE TABLE documents (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('pdf', 'docx', 'pptx', 'xlsx', 'txt')),
    source_type VARCHAR(50) DEFAULT 'manual_upload' CHECK (source_type IN ('manual_upload', 'library_sync', 'api_sync')),
    source_system VARCHAR(50) DEFAULT 'manual' CHECK (source_system IN ('manual', 'pm_thu_vien', 'pm_dao_tao', 'pm_khcn')),
    source_id VARCHAR(100),
    owner_unit_code VARCHAR(50),
    owner_unit_name VARCHAR(255),
    category VARCHAR(100),
    tags TEXT[],
    security_level VARCHAR(20) DEFAULT 'internal' CHECK (security_level IN ('public', 'internal', 'restricted', 'confidential')),
    access_scope_type VARCHAR(20) DEFAULT 'department' CHECK (access_scope_type IN ('all', 'department', 'role', 'custom')),
    access_department_codes TEXT[],
    access_role_codes TEXT[],
    access_user_ids VARCHAR(50)[],
    file_name VARCHAR(255) NOT NULL,
    file_original_name VARCHAR(500),
    file_path VARCHAR(500) NOT NULL,
    file_mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    file_checksum VARCHAR(100),
    version INTEGER DEFAULT 1,
    is_latest_version BOOLEAN DEFAULT TRUE,
    processing_status VARCHAR(30) DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'extracting', 'chunking', 'embedding', 'embedded', 'error')),
    chunk_count INTEGER DEFAULT 0,
    uploaded_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- document_versions - Lịch sử phiên bản tài liệu
CREATE TABLE document_versions (
    version_id VARCHAR(50) PRIMARY KEY,
    doc_id VARCHAR(50) REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(500),
    description TEXT,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    file_checksum VARCHAR(100),
    owner_unit_code VARCHAR(50),
    security_level VARCHAR(20),
    change_reason TEXT,
    changed_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    changed_at TIMESTAMP DEFAULT NOW()
);

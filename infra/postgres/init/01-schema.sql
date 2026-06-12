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


-- ============================================
-- MAIN ENTITY TABLES
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


-- ============================================
-- FACT TABLES (AI QUERY NHIỀU NHẤT)
-- ============================================

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
    updated_at TIMESTAMP DEFAULT NOW()
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
    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- RBAC TABLES (USER & SECURITY)
-- ============================================

-- users - Tài khoản người dùng
CREATE TABLE users (
    user_id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    fullname VARCHAR(200),
    department VARCHAR(100),
    max_security_level INTEGER DEFAULT 1 CHECK (max_security_level BETWEEN 1 AND 4),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked')),
    last_login_at TIMESTAMP,
    last_login_device_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- permissions - Quyền (Atomic Actions)
CREATE TABLE permissions (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- roles - Vai trò (Permission Groups)
CREATE TABLE roles (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- role_permissions - Liên kết Vai trò ↔ Quyền
CREATE TABLE role_permissions (
    role_id VARCHAR(20) REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(20) REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    PRIMARY KEY (role_id, permission_id)
);

-- user_roles - Liên kết Người dùng ↔ Vai trò
CREATE TABLE user_roles (
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE CASCADE,
    role_id VARCHAR(20) REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    assigned_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_id, role_id)
);

-- user_permissions - Quyền trực tiếp cho Người dùng
CREATE TABLE user_permissions (
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE CASCADE,
    permission_id VARCHAR(20) REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_id, permission_id)
);


-- ============================================
-- USER SESSION & LOG TABLES
-- ============================================

-- user_sessions - Phiên đăng nhập
CREATE TABLE user_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE CASCADE,
    token VARCHAR(500),
    ip_address VARCHAR(50),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

-- login_logs - Lịch sử đăng nhập
CREATE TABLE login_logs (
    log_id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'logout', 'token_refresh')),
    ip_address VARCHAR(50),
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    failure_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- INDEXES
-- ============================================

-- Dimension indexes
CREATE INDEX idx_hoc_ky_nam_hoc_id ON hoc_ky(nam_hoc_id);
CREATE INDEX idx_don_vi_parent_id ON don_vi(parent_id);
CREATE INDEX idx_giang_vien_don_vi_id ON giang_vien(don_vi_id);

-- Main entity indexes
CREATE INDEX idx_hoc_vien_ma_lop ON hoc_vien(ma_lop);
CREATE INDEX idx_hoc_vien_gpa ON hoc_vien(gpa_he4);
CREATE INDEX idx_hoc_vien_trang_thai ON hoc_vien(trang_thai);
CREATE INDEX idx_mon_hoc_don_vi_ql_id ON mon_hoc(don_vi_ql_id);
CREATE INDEX idx_lop_hoc_phan_hoc_ky_id ON lop_hoc_phan(hoc_ky_id);
CREATE INDEX idx_lop_hoc_phan_mon_hoc_id ON lop_hoc_phan(mon_hoc_id);
CREATE INDEX idx_lop_hoc_phan_giang_vien_id ON lop_hoc_phan(giang_vien_id);

-- Fact indexes
CREATE INDEX idx_diem_ma_hv ON diem(ma_hv);
CREATE INDEX idx_diem_ma_mon ON diem(ma_mon);
CREATE INDEX idx_diem_hoc_ky_id ON diem(hoc_ky_id);
CREATE INDEX idx_diem_diem_tong_ket ON diem(diem_tong_ket);
CREATE INDEX idx_diem_hoc_vien_id ON diem(hoc_vien_id);
CREATE INDEX idx_ket_qua_hoc_ky_hoc_vien_id ON ket_qua_hoc_ky(hoc_vien_id);
CREATE INDEX idx_ket_qua_hoc_ky_hoc_ky_id ON ket_qua_hoc_ky(hoc_ky_id);

-- User indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_max_security_level ON users(max_security_level);

-- Permission indexes
CREATE INDEX idx_permissions_code ON permissions(code);
CREATE INDEX idx_permissions_resource ON permissions(resource);

-- Role indexes
CREATE INDEX idx_roles_code ON roles(code);

-- Junction table indexes
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_is_active ON user_roles(is_active);
CREATE INDEX idx_user_roles_expires_at ON user_roles(expires_at);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX idx_user_permissions_is_active ON user_permissions(is_active);
CREATE INDEX idx_user_permissions_expires_at ON user_permissions(expires_at);

-- Session indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Log indexes
CREATE INDEX idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX idx_login_logs_created_at ON login_logs(created_at);
CREATE INDEX idx_login_logs_event_type ON login_logs(event_type);
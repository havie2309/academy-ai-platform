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

-- audit_log - Nhật ký kiểm toán (Security & Compliance)
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'denied')),
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- DOCUMENT MANAGEMENT TABLES
-- ============================================

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

-- ============================================
-- KHAO THI TABLES
-- ============================================
CREATE TABLE exam_frameworks (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    time_minutes INTEGER CHECK (time_minutes > 0),
    mon_hoc_id VARCHAR(20) REFERENCES mon_hoc(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE exam_matrices (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    exam_framework_id VARCHAR(20) REFERENCES exam_frameworks(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE knowledge_blocks (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mon_hoc_id VARCHAR(20) REFERENCES mon_hoc(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE question_banks (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mon_hoc_id VARCHAR(20) REFERENCES mon_hoc(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE questions (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'essay', 'fill_blank')),
    difficult VARCHAR(20) CHECK (difficult IN ('easy', 'medium', 'hard')),
    explanation TEXT,
    question_bank_id VARCHAR(20) REFERENCES question_banks(id) ON DELETE CASCADE,
    knowledge_block_id VARCHAR(20) REFERENCES knowledge_blocks(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE question_options (
    id VARCHAR(20) PRIMARY KEY,
    question_id VARCHAR(20) REFERENCES questions(id) ON DELETE CASCADE,
    option_label VARCHAR(5),
    content TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exam_banks (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    exam_code VARCHAR(50),
    description TEXT,
    exam_time INTEGER CHECK (exam_time > 0),
    explain TEXT,
    exam_day TIMESTAMP,
    is_note BOOLEAN DEFAULT FALSE,
    hoc_ky_id VARCHAR(20) REFERENCES hoc_ky(id) ON DELETE SET NULL,
    lop_hoc_phan_id VARCHAR(20) REFERENCES lop_hoc_phan(id) ON DELETE SET NULL,
    exam_matrix_id VARCHAR(20) REFERENCES exam_matrices(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE exam_bank_questions (
    exam_bank_id VARCHAR(20) REFERENCES exam_banks(id) ON DELETE CASCADE,
    question_id VARCHAR(20) REFERENCES questions(id) ON DELETE CASCADE,
    question_order INTEGER,
    points DECIMAL(5,2) DEFAULT 1.00,
    PRIMARY KEY (exam_bank_id, question_id)
);

-- ============================================
-- SURVEY TABLES
-- ============================================

CREATE TABLE survey_topics (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(30) CHECK (type IN ('course_feedback', 'lecturer_feedback', 'service_feedback', 'general')),
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE cluster_surveys (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    survey_topic_id VARCHAR(20) REFERENCES survey_topics(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_object_types (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    training_object_type_code VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_question_groups (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_questions (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type VARCHAR(30) CHECK (type IN ('rating', 'single_choice', 'multiple_choice', 'text')),
    description TEXT,
    survey_question_group_id VARCHAR(20) REFERENCES survey_question_groups(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE surveys (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_public BOOLEAN DEFAULT FALSE,
    anonymous BOOLEAN DEFAULT FALSE,
    survey_topic_id VARCHAR(20) REFERENCES survey_topics(id) ON DELETE SET NULL,
    cluster_survey_id VARCHAR(20) REFERENCES cluster_surveys(id) ON DELETE SET NULL,
    survey_object_type_id VARCHAR(20) REFERENCES survey_object_types(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_sessions (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    survey_id VARCHAR(20) REFERENCES surveys(id) ON DELETE CASCADE,
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    hoc_vien_id VARCHAR(20) REFERENCES hoc_vien(id) ON DELETE SET NULL,
    survey_object_type_id VARCHAR(20) REFERENCES survey_object_types(id) ON DELETE SET NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_answers (
    id SERIAL PRIMARY KEY,
    survey_session_id VARCHAR(20) REFERENCES survey_sessions(id) ON DELETE CASCADE,
    survey_question_id VARCHAR(20) REFERENCES survey_questions(id) ON DELETE CASCADE,
    rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
    choice_value TEXT,
    text_value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (survey_session_id, survey_question_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_exam_frameworks_mon_hoc ON exam_frameworks(mon_hoc_id);
CREATE INDEX idx_exam_matrices_framework ON exam_matrices(exam_framework_id);
CREATE INDEX idx_questions_bank ON questions(question_bank_id);
CREATE INDEX idx_questions_knowledge_block ON questions(knowledge_block_id);
CREATE INDEX idx_exam_banks_lop_hoc_phan ON exam_banks(lop_hoc_phan_id);
CREATE INDEX idx_exam_bank_questions_exam ON exam_bank_questions(exam_bank_id);
CREATE INDEX idx_surveys_topic ON surveys(survey_topic_id);
CREATE INDEX idx_survey_sessions_survey ON survey_sessions(survey_id);
CREATE INDEX idx_survey_sessions_student ON survey_sessions(hoc_vien_id);
CREATE INDEX idx_survey_answers_session ON survey_answers(survey_session_id);


-- Audit log indexes
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_status ON audit_log(status);

-- Document indexes
CREATE INDEX idx_documents_owner_unit ON documents(owner_unit_code);
CREATE INDEX idx_documents_security_level ON documents(security_level);
CREATE INDEX idx_documents_processing_status ON documents(processing_status);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_source_system ON documents(source_system, source_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_access_department ON documents USING GIN(access_department_codes);
CREATE INDEX idx_documents_access_role ON documents USING GIN(access_role_codes);
CREATE INDEX idx_documents_is_latest_version ON documents(is_latest_version) WHERE is_latest_version = true;
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NULL;

-- Document versions indexes
CREATE INDEX idx_document_versions_doc_id ON document_versions(doc_id);
CREATE INDEX idx_document_versions_changed_by ON document_versions(changed_by);
CREATE INDEX idx_document_versions_changed_at ON document_versions(changed_at DESC);
CREATE INDEX idx_document_versions_doc_version ON document_versions(doc_id, version_number);
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

-- Exam and survey indexes
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

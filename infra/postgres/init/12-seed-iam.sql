-- ============================================
-- SEED DATA FOR PM2 POSTGRESQL DATABASE
-- IAM — users, roles, permissions
-- Dev passwords (bcrypt cost 10): 123456
-- Hash: $2b$10$jRy9SHKseRYXsQsElQkxbeSd2V9DSBrkqFWhGpHBWkLiSqcJi9ky2
-- Login: admin | gv001 | hv001 | p2 / 123456
-- ============================================

SET session_replication_role = 'replica';

-- ============================================
-- IAM SEED
-- ============================================

INSERT INTO users (user_id, username, email, password_hash, fullname, department, max_security_level, status) VALUES
    ('USR001', 'admin',   'admin@pm2.local',   '$2b$10$jRy9SHKseRYXsQsElQkxbeSd2V9DSBrkqFWhGpHBWkLiSqcJi9ky2', 'Quản trị viên',  'Phòng CNTT', 4, 'active'),
    ('USR002', 'auditor', 'auditor@pm2.local', '$2b$10$jRy9SHKseRYXsQsElQkxbeSd2V9DSBrkqFWhGpHBWkLiSqcJi9ky2', 'Kiểm toán viên', 'Phòng Pháp chế', 3, 'active'),
    ('USR003', 'gv001',   'gv001@edumind.local', '$2b$10$jRy9SHKseRYXsQsElQkxbeSd2V9DSBrkqFWhGpHBWkLiSqcJi9ky2', 'Nguyễn Văn A',   'P2', 2, 'active'),
    ('USR004', 'hv001',   'hv001@edumind.local', '$2b$10$jRy9SHKseRYXsQsElQkxbeSd2V9DSBrkqFWhGpHBWkLiSqcJi9ky2', 'Trần Thị B',     'P2', 1, 'active'),
    ('USR005', 'p2',      'p2@edumind.local',    '$2b$10$jRy9SHKseRYXsQsElQkxbeSd2V9DSBrkqFWhGpHBWkLiSqcJi9ky2', 'Cán bộ P2',      'P2', 3, 'active');

INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('PM001', 'users:read', 'users', 'read', 'Read user accounts'),
    ('PM002', 'users:write', 'users', 'write', 'Create and update user accounts'),
    ('PM003', 'roles:read', 'roles', 'read', 'Read roles'),
    ('PM004', 'roles:write', 'roles', 'write', 'Create and update roles'),
    ('PM005', 'audit:read', 'audit_log', 'read', 'View audit logs'),
    ('PM006', 'documents:read', 'documents', 'read', 'Read document metadata'),
    ('PM007', 'documents:write', 'documents', 'write', 'Update document metadata');

INSERT INTO roles (id, name, code, description) VALUES
    ('RL001', 'Quản trị viên', 'Admin',      'Hệ thống quản trị viên'),
    ('RL002', 'Kiểm toán viên', 'Auditor',   'Người kiểm toán'),
    ('RL003', 'Giảng viên',     'GiangVien', 'Giảng viên'),
    ('RL004', 'Học viên',       'HocVien',   'Học viên / sinh viên'),
    ('RL005', 'Cán bộ P2',      'P2',        'Phòng đào tạo'),
    ('RL006', 'Ban giám đốc',   'BGD',       'Ban giám đốc'),
    ('RL007', 'Cán bộ P7',      'P7',        'Phòng khảo thí');

INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('RL001', 'PM001'),
    ('RL001', 'PM002'),
    ('RL001', 'PM003'),
    ('RL001', 'PM004'),
    ('RL001', 'PM005'),
    ('RL001', 'PM006'),
    ('RL001', 'PM007'),
    ('RL002', 'PM001'),
    ('RL002', 'PM003'),
    ('RL002', 'PM005'),
    ('RL003', 'PM001'),
    ('RL003', 'PM006'),
    ('RL003', 'PM007'),
    ('RL004', 'PM001'),
    ('RL005', 'PM001'),
    ('RL005', 'PM006'),
    ('RL006', 'PM001'),
    ('RL006', 'PM005'),
    ('RL007', 'PM001'),
    ('RL007', 'PM006');

INSERT INTO user_roles (user_id, role_id) VALUES
    ('USR001', 'RL001'),
    ('USR002', 'RL002'),
    ('USR003', 'RL003'),
    ('USR004', 'RL004'),
    ('USR005', 'RL005');

INSERT INTO user_permissions (user_id, permission_id) VALUES
    ('USR001', 'PM001'),
    ('USR001', 'PM002'),
    ('USR001', 'PM003');

SET session_replication_role = 'origin';
ANALYZE;

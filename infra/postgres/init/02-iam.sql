-- ============================================
-- IAM / USER & SECURITY TABLES
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

-- Access policies (reusable access rules)
CREATE TABLE access_policies (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('all', 'role', 'custom')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction: Policy → Roles
CREATE TABLE policy_roles (
    policy_id VARCHAR(20) REFERENCES access_policies(id) ON DELETE CASCADE,
    role_id VARCHAR(20) REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (policy_id, role_id)
);

-- Junction: Policy → Users (custom exceptions)
CREATE TABLE policy_users (
    policy_id VARCHAR(20) REFERENCES access_policies(id) ON DELETE CASCADE,
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (policy_id, user_id)
);
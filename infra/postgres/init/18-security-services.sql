-- ============================================
-- SECURITY SERVICES SUPPORT TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS admin_configs (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_change_log (
    change_id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    version INTEGER NOT NULL,
    changed_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_events (
    event_id BIGSERIAL PRIMARY KEY,
    policy_key VARCHAR(100) NOT NULL,
    matched_keyword VARCHAR(255),
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    question TEXT,
    status VARCHAR(20) DEFAULT 'blocked' CHECK (status IN ('blocked', 'allowed', 'error')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

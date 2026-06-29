CREATE TABLE IF NOT EXISTS security_alerts (
    id BIGSERIAL PRIMARY KEY,
    fingerprint VARCHAR(255) NOT NULL UNIQUE,
    rule_code VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    severity_rank SMALLINT NOT NULL CHECK (severity_rank BETWEEN 1 AND 4),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    username VARCHAR(100),
    session_id VARCHAR(100),
    ip_address INET,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    http_method VARCHAR(10),
    http_path TEXT,
    event_count INTEGER NOT NULL DEFAULT 1 CHECK (event_count >= 1),
    first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    acknowledged_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP,
    resolved_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    auto_action VARCHAR(100),
    auto_action_status VARCHAR(20) NOT NULL DEFAULT 'none'
      CHECK (auto_action_status IN ('none', 'applied', 'failed', 'skipped')),
    auto_action_note TEXT,
    payload JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_status_seen
  ON security_alerts (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_severity_seen
  ON security_alerts (severity_rank DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_user_seen
  ON security_alerts (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_rule_seen
  ON security_alerts (rule_code, last_seen_at DESC);

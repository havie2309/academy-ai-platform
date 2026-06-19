-- ============================================
-- USER SCOPE BINDINGS
-- ============================================

CREATE TABLE IF NOT EXISTS user_scope_bindings (
    user_id VARCHAR(20) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('hoc_vien', 'giang_vien')),
    profile_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Legacy demo aliases: bind to the first active profile so self-scope remains narrow.
INSERT INTO user_scope_bindings (user_id, profile_type, profile_code)
SELECT u.user_id, 'hoc_vien', hv.ma_hv
FROM users u
CROSS JOIN LATERAL (
    SELECT ma_hv
    FROM hoc_vien
    WHERE active = TRUE
    ORDER BY ma_hv
    LIMIT 1
) hv
WHERE u.username = 'hv001'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_scope_bindings (user_id, profile_type, profile_code)
SELECT u.user_id, 'giang_vien', gv.ma_gv
FROM users u
CROSS JOIN LATERAL (
    SELECT ma_gv
    FROM giang_vien
    WHERE active = TRUE
    ORDER BY ma_gv
    LIMIT 1
) gv
WHERE lower(u.username) = 'gv001'
ON CONFLICT (user_id) DO NOTHING;

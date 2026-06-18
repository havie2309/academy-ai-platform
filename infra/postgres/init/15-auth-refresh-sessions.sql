-- Access + Refresh token sessions (HttpOnly refresh cookie flow)
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_hash
  ON user_sessions (refresh_token_hash)
  WHERE refresh_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON user_sessions (user_id)
  WHERE revoked_at IS NULL;

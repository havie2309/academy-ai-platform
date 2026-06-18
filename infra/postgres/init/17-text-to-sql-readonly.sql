-- Read-only DB role for Text-to-SQL execution (C-08).
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pm2_readonly') THEN
        CREATE ROLE pm2_readonly LOGIN PASSWORD 'pm2_readonly_pass';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE pm2 TO pm2_readonly;
GRANT USAGE ON SCHEMA sql_curated TO pm2_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA sql_curated TO pm2_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA sql_curated GRANT SELECT ON TABLES TO pm2_readonly;

-- pm2_user (app) may write audit rows.
GRANT INSERT, SELECT ON sql_query_audit TO pm2_user;
GRANT USAGE, SELECT ON SEQUENCE sql_query_audit_id_seq TO pm2_user;

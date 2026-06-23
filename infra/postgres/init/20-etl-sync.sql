-- ============================================
-- ETL SYNC FOUNDATION TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS etl_sources (
    source_id VARCHAR(50) PRIMARY KEY,
    source_system VARCHAR(50) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    source_kind VARCHAR(30) NOT NULL CHECK (
        source_kind IN ('sqlserver', 'postgres', 'mongodb', 'http', 'file', 'mock')
    ),
    connection_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (source_system, display_name)
);

CREATE TABLE IF NOT EXISTS etl_jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    source_id VARCHAR(50) NOT NULL REFERENCES etl_sources(source_id) ON DELETE CASCADE,
    domain_code VARCHAR(50) NOT NULL,
    sync_mode VARCHAR(20) NOT NULL CHECK (sync_mode IN ('batch', 'event', 'manual')),
    target_table VARCHAR(100),
    target_collection VARCHAR(100),
    schedule_cron VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'active', 'paused', 'archived')
    ),
    last_run_at TIMESTAMP,
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etl_runs (
    run_id VARCHAR(60) PRIMARY KEY,
    job_id VARCHAR(50) NOT NULL REFERENCES etl_jobs(job_id) ON DELETE CASCADE,
    source_system VARCHAR(50) NOT NULL,
    sync_mode VARCHAR(20) NOT NULL CHECK (sync_mode IN ('batch', 'event', 'manual')),
    source_range JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (
        status IN ('queued', 'running', 'completed', 'failed', 'cancelled')
    ),
    record_in INTEGER NOT NULL DEFAULT 0,
    record_out INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    error_summary TEXT,
    trigger_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (
        trigger_type IN ('manual', 'schedule', 'event', 'replay', 'system')
    ),
    triggered_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etl_lineage (
    lineage_id BIGSERIAL PRIMARY KEY,
    run_id VARCHAR(60) NOT NULL REFERENCES etl_runs(run_id) ON DELETE CASCADE,
    source_system VARCHAR(50) NOT NULL,
    source_table VARCHAR(100),
    source_pk VARCHAR(255),
    target_table VARCHAR(100),
    target_pk VARCHAR(255),
    target_collection VARCHAR(100),
    target_document_id VARCHAR(100),
    operation VARCHAR(20) NOT NULL DEFAULT 'upsert' CHECK (
        operation IN ('insert', 'update', 'upsert', 'delete', 'skip')
    ),
    status VARCHAR(20) NOT NULL DEFAULT 'applied' CHECK (
        status IN ('applied', 'skipped', 'failed')
    ),
    payload_hash VARCHAR(64),
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etl_error_logs (
    error_id BIGSERIAL PRIMARY KEY,
    run_id VARCHAR(60) NOT NULL REFERENCES etl_runs(run_id) ON DELETE CASCADE,
    source_system VARCHAR(50) NOT NULL,
    stage VARCHAR(30) NOT NULL CHECK (
        stage IN ('extract', 'transform', 'load', 'lineage', 'validate', 'system')
    ),
    error_code VARCHAR(50),
    error_message TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    retryable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etl_sources_system_active
    ON etl_sources(source_system, active);

CREATE INDEX IF NOT EXISTS idx_etl_jobs_source_status
    ON etl_jobs(source_id, status);

CREATE INDEX IF NOT EXISTS idx_etl_runs_job_status_created
    ON etl_runs(job_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_etl_runs_source_status
    ON etl_runs(source_system, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_etl_lineage_run_created
    ON etl_lineage(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_etl_error_logs_run_stage
    ON etl_error_logs(run_id, stage, created_at DESC);

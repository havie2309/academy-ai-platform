-- ============================================
-- ETL BATCH SYNC SUPPORT
-- ============================================

ALTER TABLE etl_jobs
    ADD COLUMN IF NOT EXISTS job_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_etl_jobs_batch_schedule
    ON etl_jobs(sync_mode, status, schedule_cron)
    WHERE sync_mode = 'batch';

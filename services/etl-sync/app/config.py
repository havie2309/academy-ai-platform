import os

ETL_STORE_BACKEND = os.getenv("ETL_STORE_BACKEND", "postgres").strip().lower()

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "127.0.0.1")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5433"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "pm2")
POSTGRES_USER = os.getenv("POSTGRES_USER", "pm2_user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "pm2pass")

MONGO_HOST = os.getenv("MONGO_HOST", "127.0.0.1")
MONGO_PORT = int(os.getenv("MONGO_PORT", "27017"))
MONGO_DB = os.getenv("MONGO_DB", "pm2")
MONGO_USER = os.getenv("MONGO_USER", "pm2_user")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "pm2pass")
MONGO_URI = os.getenv(
    "MONGO_URI",
    (
        f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}"
        f"@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource=admin"
    ),
)

ETL_POOL_MIN_SIZE = int(os.getenv("ETL_POOL_MIN_SIZE", "1"))
ETL_POOL_MAX_SIZE = int(os.getenv("ETL_POOL_MAX_SIZE", "4"))
ETL_DEFAULT_PAGE_SIZE = int(os.getenv("ETL_DEFAULT_PAGE_SIZE", "20"))
ETL_MAX_PAGE_SIZE = int(os.getenv("ETL_MAX_PAGE_SIZE", "100"))
ETL_SCHEDULER_ENABLED = os.getenv("ETL_SCHEDULER_ENABLED", "true").lower() != "false"
ETL_SCHEDULER_POLL_SECONDS = int(os.getenv("ETL_SCHEDULER_POLL_SECONDS", "15"))
ETL_BATCH_MAX_SIZE = int(os.getenv("ETL_BATCH_MAX_SIZE", "500"))
ETL_BATCH_MAX_LINEAGE_ROWS = int(os.getenv("ETL_BATCH_MAX_LINEAGE_ROWS", "100"))

import os

MONGO_URI = os.getenv(
    "MONGO_URI",
    f"mongodb://{os.getenv('MONGO_USER', 'pm2_user')}:{os.getenv('MONGO_PASSWORD', 'pm2pass')}"
    f"@{os.getenv('MONGO_HOST', 'localhost')}:{os.getenv('MONGO_PORT', '27017')}"
    f"/{os.getenv('MONGO_DB', 'pm2')}?authSource=admin",
)
MONGO_DB = os.getenv("MONGO_DB", "pm2")
EMBEDDING_BASE_URL = os.getenv("EMBEDDING_BASE_URL", "http://localhost:8001")
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", "19530")
MILVUS_COLLECTION = os.getenv("MILVUS_COLLECTION", "document_chunks")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "384"))

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "pm2_user")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "pm2pass")
INGEST_QUEUE = os.getenv("INGEST_QUEUE", "ingest.jobs")
INGEST_DLQ = os.getenv("INGEST_DLQ", f"{INGEST_QUEUE}.dlq")
INGEST_MAX_RETRIES = int(os.getenv("INGEST_MAX_RETRIES", "3"))
INGEST_TRANSPORT = os.getenv("INGEST_TRANSPORT", "rabbitmq").strip().lower()
INGEST_ALLOW_DIRECT_FALLBACK = (
    os.getenv("INGEST_ALLOW_DIRECT_FALLBACK", "true").lower() != "false"
)

CHUNK_MAX_SIZE = int(os.getenv("CHUNK_MAX_SIZE", "500"))
CHUNK_OVERLAP = float(os.getenv("CHUNK_OVERLAP", "0.2"))
# Embedding API currently accepts max 64 texts/request.
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))
EMBEDDING_MAX_RETRIES = int(os.getenv("EMBEDDING_MAX_RETRIES", "3"))
EMBEDDING_RETRY_BACKOFF_MS = int(os.getenv("EMBEDDING_RETRY_BACKOFF_MS", "400"))

PDF_OCR_MIN_TEXT_CHARS = int(os.getenv("PDF_OCR_MIN_TEXT_CHARS", "80"))
MINERU_ENABLED = os.getenv("MINERU_ENABLED", "true").lower() != "false"
MINERU_CLI = os.getenv("MINERU_CLI", "mineru").strip()
MINERU_BACKEND = os.getenv("MINERU_BACKEND", "pipeline").strip()
MINERU_TIMEOUT_SEC = int(os.getenv("MINERU_TIMEOUT_SEC", "600"))
PADDLEOCR_ENABLED = os.getenv("PADDLEOCR_ENABLED", "true").lower() != "false"
PADDLEOCR_LANG = os.getenv("PADDLEOCR_LANG", "vi")

SECURITY_RANK = {"public": 1, "internal": 2, "restricted": 3, "confidential": 4}

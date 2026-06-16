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

CHUNK_MAX_SIZE = int(os.getenv("CHUNK_MAX_SIZE", "400"))
CHUNK_OVERLAP = float(os.getenv("CHUNK_OVERLAP", "0.1"))

SECURITY_RANK = {"public": 1, "internal": 2, "restricted": 3, "confidential": 4}

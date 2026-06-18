import os
from pathlib import Path

from dotenv import load_dotenv

# Best-effort: load services/platform/.env so rag-engine shares LLM/DB config with
# the chat service on a single-machine dev setup. Real env vars take precedence.
_PLATFORM_ENV = Path(__file__).resolve().parents[2] / "platform" / ".env"
if _PLATFORM_ENV.exists():
    load_dotenv(_PLATFORM_ENV, override=False)

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
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "30"))
RERANK_TOP_K = int(os.getenv("RERANK_TOP_K", "8"))
MAX_CHUNKS_PER_DOC = int(os.getenv("MAX_CHUNKS_PER_DOC", "3"))
RERANK_BASE_URL = os.getenv("RERANK_BASE_URL", "http://localhost:8002")
RERANK_ENABLED = os.getenv("RERANK_ENABLED", "true").lower() != "false"
VECTOR_SCORE_MIN = float(os.getenv("VECTOR_SCORE_MIN", "0.25"))
RERANK_SCORE_MIN = float(os.getenv("RERANK_SCORE_MIN", "-8.0"))
RERANK_SCORE_DELTA = float(os.getenv("RERANK_SCORE_DELTA", "3.0"))

# --- LLM (answer generation) -------------------------------------------------
# Mirrors the chat service: 'ollama' (local, OpenAI-compatible) or 'openai' (cloud).
# When LLM_PROVIDER is unset, default to ollama if LLM_BASE_URL is present.
LLM_PROVIDER = (os.getenv("LLM_PROVIDER") or "").strip().lower()
LLM_BASE_URL = (os.getenv("LLM_BASE_URL") or "http://localhost:11434").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:3b")
OPENAI_API_KEY = (os.getenv("OPENAI_API_KEY") or "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "120"))

SECURITY_RANK = {"public": 1, "internal": 2, "restricted": 3, "confidential": 4}
ADMIN_ROLES = {"ADMIN", "Admin", "BGD", "P2"}

# --- Text-to-SQL (Postgres read-only + audit) --------------------------------
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "127.0.0.1")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5433"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "pm2")
POSTGRES_USER = os.getenv("POSTGRES_USER", "pm2_user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "pm2pass")
SQL_READONLY_USER = os.getenv("SQL_READONLY_USER", "pm2_readonly")
SQL_READONLY_PASSWORD = os.getenv("SQL_READONLY_PASSWORD", "pm2_readonly_pass")
SQL_STATEMENT_TIMEOUT_MS = int(os.getenv("SQL_STATEMENT_TIMEOUT_MS", "10000"))
SQL_DEFAULT_LIMIT = int(os.getenv("SQL_DEFAULT_LIMIT", "100"))
SQL_MAX_LIMIT = int(os.getenv("SQL_MAX_LIMIT", "100"))
SQL_AUDIT_ENABLED = os.getenv("SQL_AUDIT_ENABLED", "true").lower() != "false"

STAFF_SQL_ROLES = {"ADMIN", "BGD", "P2"}
SELF_SCOPE_ROLES = {"HOC_VIEN", "GIANG_VIEN"}

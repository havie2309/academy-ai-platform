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
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "60"))
RERANK_TOP_K = int(os.getenv("RERANK_TOP_K", "8"))
MAX_CHUNKS_PER_DOC = int(os.getenv("MAX_CHUNKS_PER_DOC", "3"))
RERANK_DOC_MAX_CHARS = int(os.getenv("RERANK_DOC_MAX_CHARS", "1800"))
RAG_CONTEXT_MAX_CHARS = int(os.getenv("RAG_CONTEXT_MAX_CHARS", "6000"))
RERANK_BASE_URL = os.getenv("RERANK_BASE_URL", "http://localhost:8002")
RERANK_ENABLED = os.getenv("RERANK_ENABLED", "true").lower() != "false"
VECTOR_SCORE_MIN = float(os.getenv("VECTOR_SCORE_MIN", "-100"))
RERANK_SCORE_MIN = float(os.getenv("RERANK_SCORE_MIN", "-2.0"))
RERANK_SCORE_DELTA = float(os.getenv("RERANK_SCORE_DELTA", "3.0"))

# --- LLM (answer generation) -------------------------------------------------
# Mirrors the chat service: 'ollama' (local, OpenAI-compatible) or 'openai' (cloud).
# When LLM_PROVIDER is unset, default to ollama if LLM_BASE_URL is present.
LLM_PROVIDER = (os.getenv("LLM_PROVIDER") or "").strip().lower()
LLM_BASE_URL = (os.getenv("LLM_BASE_URL") or "http://localhost:11434").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:3b")
LLM_FALLBACK_PROVIDER = (os.getenv("LLM_FALLBACK_PROVIDER") or "").strip().lower()
LLM_FALLBACK_BASE_URL = (os.getenv("LLM_FALLBACK_BASE_URL") or "").strip()
LLM_FALLBACK_MODEL = (os.getenv("LLM_FALLBACK_MODEL") or "").strip()
OPENAI_API_KEY = (os.getenv("OPENAI_API_KEY") or "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "120"))

# --- Summarization ------------------------------------------------------------
SUMMARY_MAX_CHARS = int(os.getenv("SUMMARY_MAX_CHARS", "1500"))
SUMMARY_LLM_PROVIDER = os.getenv("SUMMARY_LLM_PROVIDER", LLM_PROVIDER).strip().lower()
SUMMARY_LLM_BASE_URL = os.getenv("SUMMARY_LLM_BASE_URL", LLM_BASE_URL).strip()
SUMMARY_LLM_MODEL = os.getenv("SUMMARY_LLM_MODEL", LLM_MODEL).strip()
SUMMARY_LLM_FALLBACK_PROVIDER = (
    os.getenv("SUMMARY_LLM_FALLBACK_PROVIDER", LLM_FALLBACK_PROVIDER).strip().lower()
)
SUMMARY_LLM_FALLBACK_BASE_URL = (
    os.getenv("SUMMARY_LLM_FALLBACK_BASE_URL", LLM_FALLBACK_BASE_URL).strip()
)
SUMMARY_LLM_FALLBACK_MODEL = (
    os.getenv("SUMMARY_LLM_FALLBACK_MODEL", LLM_FALLBACK_MODEL).strip()
)
SUMMARY_LLM_RETRY_ATTEMPTS = int(os.getenv("SUMMARY_LLM_RETRY_ATTEMPTS", "2"))
SUMMARY_LLM_TIMEOUT = float(os.getenv("SUMMARY_LLM_TIMEOUT", "60"))

# --- Text-to-SQL LLM target --------------------------------------------------
# Allow SQL generation to use a dedicated model (for example qwen2.5:3b on the AI
# host) without affecting the general RAG answer model.
SQL_LLM_PROVIDER = (os.getenv("SQL_LLM_PROVIDER") or LLM_PROVIDER).strip().lower()
SQL_LLM_BASE_URL = (os.getenv("SQL_LLM_BASE_URL") or LLM_BASE_URL).strip()
SQL_LLM_MODEL = os.getenv("SQL_LLM_MODEL", LLM_MODEL)
SQL_LLM_FALLBACK_PROVIDER = (
    os.getenv("SQL_LLM_FALLBACK_PROVIDER") or LLM_FALLBACK_PROVIDER
).strip().lower()
SQL_LLM_FALLBACK_BASE_URL = (
    os.getenv("SQL_LLM_FALLBACK_BASE_URL") or LLM_FALLBACK_BASE_URL
).strip()
SQL_LLM_FALLBACK_MODEL = (
    os.getenv("SQL_LLM_FALLBACK_MODEL") or LLM_FALLBACK_MODEL
).strip()
SQL_OPENAI_MODEL = os.getenv("SQL_OPENAI_MODEL", OPENAI_MODEL)
SQL_FEW_SHOT_ENABLED = os.getenv("SQL_FEW_SHOT_ENABLED", "true").lower() != "false"

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

# --- Internal gateway auth ---------------------------------------------------
# When set, every request must carry a matching x-gateway-internal-secret header.
# Leave empty in local dev to skip enforcement.
GATEWAY_INTERNAL_SHARED_SECRET = (os.getenv("GATEWAY_INTERNAL_SHARED_SECRET") or "").strip()

# --- Safe refusal / admin-config ---------------------------------------------
ADMIN_CONFIG_URL = (os.getenv("ADMIN_CONFIG_URL") or "http://127.0.0.1:3004").strip()
ADMIN_CONFIG_INTERNAL_KEY = (os.getenv("ADMIN_CONFIG_INTERNAL_KEY") or "").strip()
ADMIN_CONFIG_CACHE_TTL_SECONDS = int(
    os.getenv("ADMIN_CONFIG_CACHE_TTL_SECONDS", "30")
)
GUARDRAIL_FUZZY_ENABLED = os.getenv("GUARDRAIL_FUZZY_ENABLED", "true").lower() != "false"
GUARDRAIL_FUZZY_THRESHOLD = float(os.getenv("GUARDRAIL_FUZZY_THRESHOLD", "0.85"))
GUARDRAIL_SEMANTIC_ENABLED = (
    os.getenv("GUARDRAIL_SEMANTIC_ENABLED", "false").lower() == "true"
)
GUARDRAIL_SEMANTIC_THRESHOLD = float(
    os.getenv("GUARDRAIL_SEMANTIC_THRESHOLD", "0.78")
)
GUARDRAIL_SEMANTIC_TIMEOUT_SECONDS = float(
    os.getenv("GUARDRAIL_SEMANTIC_TIMEOUT_SECONDS", "5")
)
GUARDRAIL_LLM_ENABLED = os.getenv("GUARDRAIL_LLM_ENABLED", "false").lower() == "true"
GUARDRAIL_HEURISTIC_POLICY_ENABLED = (
    os.getenv("GUARDRAIL_HEURISTIC_POLICY_ENABLED", "true").lower() != "false"
)
GUARDRAIL_LLM_TIMEOUT_SECONDS = float(
    os.getenv("GUARDRAIL_LLM_TIMEOUT_SECONDS", "8")
)
GUARDRAIL_LLM_MIN_CONFIDENCE = float(
    os.getenv("GUARDRAIL_LLM_MIN_CONFIDENCE", "0.7")
)

# --- Redis cache / conversation state ----------------------------------------
REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_TTL = int(os.getenv("REDIS_TTL", "3600"))
SESSION_CONTEXT_TTL = int(os.getenv("CHAT_SESSION_CONTEXT_TTL", "3600"))
SESSION_CONTEXT_MAX_MESSAGES = int(os.getenv("CHAT_SESSION_CONTEXT_MAX_MESSAGES", "20"))

ALLOW_ADVERSARIAL_DOCS = os.getenv("ALLOW_ADVERSARIAL_DOCS", "false").lower() == "true"

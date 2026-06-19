import json
import hashlib
import redis
from app.config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, REDIS_TTL

class RedisCache:
    def __init__(self):
        self.client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            password=REDIS_PASSWORD or None,
            db=REDIS_DB,
            decode_responses=True
        )
        self.ttl = REDIS_TTL

    def _generate_key(self, prefix: str, *args) -> str:
        """Generate a consistent cache key."""
        combined = ":".join(str(arg) for arg in args)
        hashed = hashlib.md5(combined.encode()).hexdigest()[:12]
        return f"{prefix}:{hashed}"

    # ============================================================
    # Embedding Cache
    # ============================================================

    def get_embedding(self, query: str) -> list[float] | None:
        key = self._generate_key("embed", query)
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return None

    def set_embedding(self, query: str, embedding: list[float], ttl: int | None = None) -> None:
        key = self._generate_key("embed", query)
        ttl = ttl or self.ttl
        self.client.setex(key, ttl, json.dumps(embedding))

    # ============================================================
    # Retrieval Cache
    # ============================================================

    def get_retrieval(self, query: str, user_id: str | None = None) -> list[dict] | None:
        key = self._generate_key("retrieve", query, user_id or "default")
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return None

    def set_retrieval(self, query: str, chunks: list[dict], user_id: str | None = None, ttl: int | None = None) -> None:
        key = self._generate_key("retrieve", query, user_id or "default")
        ttl = ttl or int(self.ttl * 0.5)  # Shorter TTL for retrieval
        self.client.setex(key, ttl, json.dumps(chunks))

    # ============================================================
    # Chat Session Context
    # ============================================================

    def get_session_context(self, session_id: str) -> dict | None:
        key = f"chat:session:{session_id}"
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return None

    def set_session_context(self, session_id: str, context: dict, ttl: int = 3600) -> None:
        key = f"chat:session:{session_id}"
        self.client.setex(key, ttl, json.dumps(context))

    def clear_session(self, session_id: str) -> None:
        key = f"chat:session:{session_id}"
        self.client.delete(key)

    # ============================================================
    # Utility
    # ============================================================

    def clear_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        keys = self.client.keys(pattern)
        if keys:
            return self.client.delete(*keys)
        return 0

    def get_stats(self) -> dict:
        """Get cache statistics."""
        info = self.client.info()
        return {
            "keys": self.client.dbsize(),
            "used_memory": info.get("used_memory_human", "0"),
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
        }
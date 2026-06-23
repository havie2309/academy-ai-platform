import hashlib
import json

from app.config import (
    REDIS_DB,
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_TTL,
    SESSION_CONTEXT_TTL,
)

try:
    import redis
except ImportError:  # pragma: no cover - optional local fallback
    redis = None


class _MemoryRedisClient:
    def __init__(self):
        self._store: dict[str, str] = {}

    def get(self, key: str):
        return self._store.get(key)

    def setex(self, key: str, _ttl: int, value: str):
        self._store[key] = value

    def delete(self, *keys: str):
        deleted = 0
        for key in keys:
            if key in self._store:
                deleted += 1
                del self._store[key]
        return deleted

    def keys(self, pattern: str):
        if pattern == "*":
            return list(self._store.keys())
        prefix = pattern.rstrip("*")
        return [key for key in self._store if key.startswith(prefix)]

    def dbsize(self):
        return len(self._store)

    def info(self):
        return {"used_memory_human": "0", "keyspace_hits": 0, "keyspace_misses": 0}

    def incr(self, key: str):
        value = int(self._store.get(key, "0")) + 1
        self._store[key] = str(value)
        return value

    def expire(self, _key: str, _ttl: int):
        return True

class RedisCache:
    def __init__(self):
        if redis is None:
            self.client = _MemoryRedisClient()
        else:
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

    def set_session_context(
        self, session_id: str, context: dict, ttl: int = SESSION_CONTEXT_TTL
    ) -> None:
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

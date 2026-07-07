import asyncio
import time
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    """Thread-safe in-memory TTL cache. Replace with Redis in production scale."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[T, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> T | None:
        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: T, ttl_seconds: int) -> None:
        async with self._lock:
            self._store[key] = (value, time.monotonic() + ttl_seconds)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)


# Global cache instances
quote_cache: TTLCache[Any] = TTLCache()
ohlcv_cache: TTLCache[Any] = TTLCache()
analysis_cache: TTLCache[Any] = TTLCache()
intelligence_cache: TTLCache[Any] = TTLCache()

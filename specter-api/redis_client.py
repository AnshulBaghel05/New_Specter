from __future__ import annotations
import os

from redis import Redis

UPSTASH_REDIS_URL = os.environ["UPSTASH_REDIS_URL"]

redis = Redis.from_url(UPSTASH_REDIS_URL, decode_responses=True)


def get_redis() -> Redis:
    """FastAPI dependency — returns the shared Redis client. Overridable in tests."""
    return redis

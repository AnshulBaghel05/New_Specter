"""Rate limiting (slowapi + the underlying `limits` library).

Two complementary mechanisms, both keyed by client IP and both honouring
RATE_LIMIT_ENABLED:

1. `limiter` (slowapi) — wired into `main.py` via SlowAPIMiddleware for a generous
   GLOBAL default ceiling on every route, plus the `@limiter.limit` decorator on
   body-less endpoints (e.g. /billing/webhook).
2. `rate_limit_dependency(...)` — a FastAPI dependency for endpoints that take a
   Pydantic body (e.g. /competitors POST). slowapi's decorator mis-detects a body
   parameter as a query param in this FastAPI/Pydantic combo, so those routes use
   a dependency instead — same `limits` engine, no signature interference.

Storage defaults to in-process memory (per-instance limiting still blocks abuse);
set RATE_LIMIT_STORAGE_URI to a redis:// URL for shared cross-instance limits.
"""
from __future__ import annotations

import os

from fastapi import HTTPException, status
from limits import parse
from limits.storage import storage_from_string
from limits.strategies import FixedWindowRateLimiter
from slowapi import Limiter
from starlette.requests import Request


def client_ip(request: Request) -> str:
    """Best-effort client IP for rate-limit bucketing (X-Forwarded-For aware)."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


def _enabled() -> bool:
    return os.environ.get("RATE_LIMIT_ENABLED", "true").lower() not in ("0", "false", "no")


_STORAGE_URI = os.environ.get("RATE_LIMIT_STORAGE_URI", "memory://")

# slowapi limiter — global default ceiling (via SlowAPIMiddleware) + decorators.
limiter = Limiter(
    key_func=client_ip,
    default_limits=["240/minute"],
    storage_uri=_STORAGE_URI,
    enabled=_enabled(),
)

# Shared `limits` engine for the dependency-based limits.
_dep_storage = storage_from_string(_STORAGE_URI)
_dep_strategy = FixedWindowRateLimiter(_dep_storage)


def rate_limit_dependency(limit: str, scope: str):
    """Build a FastAPI dependency enforcing `limit` (e.g. "20/minute") per client
    IP under `scope`. No-op while rate limiting is disabled (checked per request
    so tests can toggle it). Raises 429 when the window is exceeded."""
    item = parse(limit)

    async def _dep(request: Request) -> None:
        if not _enabled():
            return
        if not _dep_strategy.hit(item, scope, client_ip(request)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": "rate_limited", "scope": scope},
            )

    return _dep

"""Liveness + readiness probes for Railway.

Two distinct probes, on purpose:

  /livez  — LIVENESS. Returns 200 as long as the process is up. No DB, no Redis,
            no auth. This is what Railway's healthcheck gates the deploy on
            (railway.toml healthcheckPath = /livez), so a transient/misconfigured
            Postgres or Redis can never block the deploy from going live — the
            failure shows up in /readyz and the logs instead of bricking the box.

  /health, /readyz — READINESS. Returns 200 only when BOTH dependencies answer:
            Postgres (`SELECT 1`) and Redis (`PING`). Any failure → 503, with the
            body naming the culprit, so a load balancer / monitor can pull the
            instance and an operator can see *which* dependency is down.

The readiness checks use the get_db / get_redis dependencies (not the module-level
singletons) so they are overridable in tests.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Response, status
from redis import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from redis_client import get_redis

router = APIRouter(tags=["health"])


@router.get("/")
async def root() -> dict:
    """Bare-domain sanity route: 200 with no dependencies. Hitting the public URL
    root returns this instead of a 404, so a browser/curl to the domain confirms
    the proxy is reaching the app. Not the healthcheck (that's /livez)."""
    return {"service": "specter-api", "status": "ok"}


@router.get("/livez")
async def livez() -> dict:
    """Liveness probe: 200 the moment the process can serve a request. No external
    dependencies — Railway gates the deploy on this so DB/Redis state never blocks
    a rollout. Use /health or /readyz to verify dependencies."""
    return {"status": "ok"}


async def _check_db(session: AsyncSession) -> bool:
    try:
        await session.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001 — a probe must never raise; any failure = down
        return False


def _check_redis(client: Redis) -> bool:
    try:
        return bool(client.ping())
    except Exception:  # noqa: BLE001
        return False


@router.get("/health")
@router.get("/readyz")
async def health(
    response: Response,
    session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> dict:
    db_ok = await _check_db(session)
    # _check_redis uses the sync redis client; run it off the event loop.
    redis_ok = await asyncio.to_thread(_check_redis, redis_client)
    if not (db_ok and redis_ok):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "db": "ok" if db_ok else "down",
        "redis": "ok" if redis_ok else "down",
    }

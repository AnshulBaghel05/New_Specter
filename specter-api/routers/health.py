"""Liveness/readiness probe for Railway (healthcheckPath = /health).

Returns 200 only when BOTH dependencies answer: Postgres (`SELECT 1`) and Redis
(`PING`). Any failure → 503 so Railway pulls the instance out of rotation instead
of routing traffic to a box that can't serve. The body always reports each
dependency individually so a failing probe is self-diagnosing in the logs.

Uses the get_db / get_redis dependencies (not the module-level singletons) so the
checks are overridable in tests.
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

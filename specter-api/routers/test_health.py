"""Tests for the /health probe (routers/health.py).

Run: pytest routers/test_health.py -v

Both dependency checks are overridden so no real Postgres/Redis is needed:
  - DB ok  ⇔ session.execute(SELECT 1) succeeds
  - Redis ok ⇔ client.ping() returns truthy
200 only when both pass; 503 if either fails, with the body naming the culprit.
"""
from __future__ import annotations

import base64
import os
from unittest.mock import AsyncMock, MagicMock

# ── Env before app imports ───────────────────────────────────────────────────
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret-32-char!")
os.environ.setdefault("ENCRYPTION_KEY", base64.urlsafe_b64encode(b"t" * 32).decode())

import pytest
from fastapi.testclient import TestClient

from db import get_db
from main import app
from redis_client import get_redis


def override_db(session):
    async def _gen():
        yield session
    return _gen


def make_db(ok: bool) -> AsyncMock:
    session = AsyncMock()
    if ok:
        session.execute = AsyncMock(return_value=MagicMock())
    else:
        session.execute = AsyncMock(side_effect=RuntimeError("db down"))
    return session


def make_redis(ok: bool) -> MagicMock:
    client = MagicMock()
    if ok:
        client.ping = MagicMock(return_value=True)
    else:
        client.ping = MagicMock(side_effect=RuntimeError("redis down"))
    return client


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def _use(session, redis_client):
    app.dependency_overrides[get_db] = override_db(session)
    app.dependency_overrides[get_redis] = lambda: redis_client


def test_livez_is_200_with_no_dependencies(client):
    # Liveness must NOT touch DB/Redis: no dependency overrides are set here, yet
    # it must still return 200. This is what Railway gates the deploy on.
    resp = client.get("/livez")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_livez_200_even_when_dependencies_down(client):
    # Even with both deps failing, liveness stays 200 — a dead DB must not block
    # the deploy or get the live process killed.
    _use(make_db(False), make_redis(False))
    resp = client.get("/livez")
    assert resp.status_code == 200


def test_health_ok_when_both_up(client):
    _use(make_db(True), make_redis(True))
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "db": "ok", "redis": "ok"}


def test_readyz_alias_matches_health(client):
    # /readyz is the same deep readiness check as /health (used by monitors).
    _use(make_db(True), make_redis(True))
    assert client.get("/readyz").status_code == 200
    _use(make_db(False), make_redis(True))
    assert client.get("/readyz").status_code == 503


def test_health_503_when_db_down(client):
    _use(make_db(False), make_redis(True))
    resp = client.get("/health")
    assert resp.status_code == 503
    body = resp.json()
    assert body == {"status": "degraded", "db": "down", "redis": "ok"}


def test_health_503_when_redis_down(client):
    _use(make_db(True), make_redis(False))
    resp = client.get("/health")
    assert resp.status_code == 503
    assert resp.json() == {"status": "degraded", "db": "ok", "redis": "down"}


def test_health_503_when_both_down(client):
    _use(make_db(False), make_redis(False))
    resp = client.get("/health")
    assert resp.status_code == 503
    assert resp.json() == {"status": "degraded", "db": "down", "redis": "down"}

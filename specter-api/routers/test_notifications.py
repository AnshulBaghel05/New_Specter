import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from auth.supabase import get_current_merchant
from db import get_db
from main import app
from models.merchants import Merchant


def _merchant():
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = "recon"
    return m


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _wire(session, merchant):
    async def _ovr_m(): return merchant
    async def _ovr_db(): yield session
    app.dependency_overrides[get_current_merchant] = _ovr_m
    app.dependency_overrides[get_db] = _ovr_db


def _count_result(n):
    r = MagicMock(); r.scalar_one = MagicMock(return_value=n); return r


def _rows_result(rows):
    r = MagicMock()
    r.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=rows)))
    return r


def test_list_returns_items_total_and_unread(client):
    m = _merchant()
    row = SimpleNamespace(
        id=uuid.uuid4(), type="signal", severity="success", title="RAISE — Widget",
        body="b", link="/signals", read_at=None, created_at=datetime(2026, 6, 21, tzinfo=timezone.utc),
    )
    session = AsyncMock()
    # list query → rows; then total count; then unread count
    session.execute = AsyncMock(side_effect=[_rows_result([row]), _count_result(1), _count_result(1)])
    _wire(session, m)

    resp = client.get("/notifications")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1 and body["unread"] == 1
    assert body["items"][0]["type"] == "signal"
    assert body["items"][0]["read"] is False        # read_at NULL → unread


def test_unread_count(client):
    m = _merchant()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_count_result(4))
    _wire(session, m)

    resp = client.get("/notifications/unread-count")
    assert resp.status_code == 200
    assert resp.json()["unread"] == 4


def test_mark_read_204_when_owned(client):
    m = _merchant()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(rowcount=1))
    session.commit = AsyncMock()
    _wire(session, m)

    resp = client.post(f"/notifications/{uuid.uuid4()}/read")
    assert resp.status_code == 204
    session.commit.assert_awaited_once()


def test_mark_read_404_when_not_owned(client):
    m = _merchant()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(rowcount=0))   # no row matched
    session.commit = AsyncMock()
    _wire(session, m)

    resp = client.post(f"/notifications/{uuid.uuid4()}/read")
    assert resp.status_code == 404
    session.commit.assert_not_awaited()


def test_mark_all_read_204(client):
    m = _merchant()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(rowcount=3))
    session.commit = AsyncMock()
    _wire(session, m)

    resp = client.post("/notifications/read-all")
    assert resp.status_code == 204


def test_dismiss_404_when_not_owned(client):
    m = _merchant()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(rowcount=0))
    session.commit = AsyncMock()
    _wire(session, m)

    resp = client.request("DELETE", f"/notifications/{uuid.uuid4()}")
    assert resp.status_code == 404

import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

import routers.skus as skus
from auth.supabase import get_current_merchant
from db import get_db
from main import app
from models.merchants import Merchant
from models.skus import SKU
from routers.skus import SKUCreate, SKUPatch, cascade_delete_sku


# ── Currency validation on the SKU schemas ──────────────────────────────────────

def test_sku_create_defaults_currency_to_usd():
    assert SKUCreate(title="X").currency == "USD"


def test_sku_create_uppercases_and_accepts_supported_currency():
    assert SKUCreate(title="X", currency="eur").currency == "EUR"


def test_sku_create_rejects_unsupported_currency():
    with pytest.raises(ValueError):
        SKUCreate(title="X", currency="ZZZ")


def test_sku_patch_currency_optional_and_validated():
    assert SKUPatch().currency is None
    assert SKUPatch(currency="gbp").currency == "GBP"
    with pytest.raises(ValueError):
        SKUPatch(currency="NOPE")


# ── Fake async session that records DELETE ordering ─────────────────────────────

class FakeSession:
    def __init__(self, url_ids, got=None):
        self.executed: list[str] = []        # rendered SQL, lowercased, in call order
        self.deleted: list = []              # objects passed to session.delete()
        self.committed = False
        self.flushed = False
        self._url_ids = list(url_ids)
        self._got = got or {}

    async def execute(self, stmt):
        sql = str(stmt.compile(dialect=postgresql.dialect())).lower()
        self.executed.append(sql)
        if sql.lstrip().startswith("select"):
            scal = MagicMock()
            scal.all = MagicMock(return_value=list(self._url_ids))
            res = MagicMock()
            res.scalars = MagicMock(return_value=scal)
            return res
        return MagicMock(rowcount=1)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def get(self, model, pk):
        return self._got.get(pk)

    async def flush(self):
        self.flushed = True

    async def commit(self):
        self.committed = True


def _first_index(haystack: list[str], needle: str) -> int:
    for i, s in enumerate(haystack):
        if needle in s:
            return i
    raise AssertionError(f"{needle!r} never executed; got {haystack}")


# ── cascade_delete_sku — FK-safe ordering + reschedule ──────────────────────────

def test_cascade_deletes_children_before_parent(monkeypatch):
    import asyncio
    monkeypatch.setattr(skus, "refresh_url_schedule", AsyncMock())
    sku = SimpleNamespace(id=uuid.uuid4(), merchant_id=uuid.uuid4())
    session = FakeSession(url_ids=[])

    asyncio.run(cascade_delete_sku(session, MagicMock(), sku))

    sql = session.executed
    # Children must be deleted before the rows they reference:
    # price_changes(→signals) → signals → oos_alerts(→trackings) → competitor_trackings
    assert _first_index(sql, "delete from price_changes") < _first_index(sql, "delete from signals")
    assert _first_index(sql, "delete from signals") < _first_index(sql, "delete from oos_alerts")
    assert _first_index(sql, "delete from oos_alerts") < _first_index(sql, "delete from competitor_trackings")
    # The SKU row itself is removed via session.delete and the txn is committed.
    assert sku in session.deleted
    assert session.committed is True


def test_cascade_reschedules_each_affected_competitor_url(monkeypatch):
    import asyncio
    refresh = AsyncMock()
    monkeypatch.setattr(skus, "refresh_url_schedule", refresh)
    url_id = uuid.uuid4()
    cu = SimpleNamespace(id=url_id)
    sku = SimpleNamespace(id=uuid.uuid4(), merchant_id=uuid.uuid4())
    session = FakeSession(url_ids=[url_id], got={url_id: cu})

    result = asyncio.run(cascade_delete_sku(session, MagicMock(), sku))

    assert result["competitor_urls_rescheduled"] == 1
    refresh.assert_awaited_once()
    assert refresh.await_args.args[2] is cu      # the URL that lost a tracking


# ── DELETE /skus/{id} route ─────────────────────────────────────────────────────

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


def test_delete_sku_returns_204_and_cascades(client, monkeypatch):
    m = _merchant()
    sku = SimpleNamespace(id=uuid.uuid4(), merchant_id=m.id)
    casc = AsyncMock(return_value={"competitor_urls_rescheduled": 0})
    monkeypatch.setattr(skus, "cascade_delete_sku", casc)

    session = AsyncMock()
    session.get = AsyncMock(return_value=sku)

    async def _ovr_merchant(): return m
    async def _ovr_db(): yield session
    app.dependency_overrides[get_current_merchant] = _ovr_merchant
    app.dependency_overrides[get_db] = _ovr_db

    resp = client.request("DELETE", f"/skus/{sku.id}")
    assert resp.status_code == 204
    casc.assert_awaited_once()


def test_delete_sku_404_when_not_owner(client, monkeypatch):
    m = _merchant()
    other = SimpleNamespace(id=uuid.uuid4(), merchant_id=uuid.uuid4())  # different merchant
    casc = AsyncMock()
    monkeypatch.setattr(skus, "cascade_delete_sku", casc)

    session = AsyncMock()
    session.get = AsyncMock(return_value=other)

    async def _ovr_merchant(): return m
    async def _ovr_db(): yield session
    app.dependency_overrides[get_current_merchant] = _ovr_merchant
    app.dependency_overrides[get_db] = _ovr_db

    resp = client.request("DELETE", f"/skus/{other.id}")
    assert resp.status_code == 404
    casc.assert_not_awaited()           # never touch data for a row you don't own

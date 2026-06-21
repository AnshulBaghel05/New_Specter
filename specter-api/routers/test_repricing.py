import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

import routers.repricing as repricing
from auth.plan_gate import plan_gate
from db import get_db
from main import app
from models.merchants import Merchant


def _merchant(plan="cipher"):
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = plan
    m.shopify_domain = "s.myshopify.com"
    m.shopify_access_token = "enc"
    return m


def _sku(merchant_id, **kw):
    d = dict(id=uuid.uuid4(), merchant_id=merchant_id, title="Widget",
             current_price=Decimal("100.00"), floor_price=Decimal("80.00"),
             ceiling_price=Decimal("140.00"), shopify_variant_id="v1", active=True)
    d.update(kw)
    return SimpleNamespace(**d)


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _wire(merchant, session):
    # The repricing router builds its own cipher gate at import; override it.
    app.dependency_overrides[repricing._cipher] = lambda: merchant
    async def _db(): yield session
    app.dependency_overrides[get_db] = _db


def test_apply_writes_manual_price_change_after_confirm(client, monkeypatch):
    m = _merchant()
    sku = _sku(m.id)
    session = AsyncMock()
    session.get = AsyncMock(return_value=sku)
    session.commit = AsyncMock()
    _wire(m, session)

    outcome = repricing.RepriceOutcome  # type marker
    applied = MagicMock(applied=True, reason="manual apply", needs_reconnect=False,
                        price_change=SimpleNamespace(id=uuid.uuid4()))
    apply_mock = AsyncMock(return_value=applied)
    monkeypatch.setattr(repricing, "apply_price_change", apply_mock)

    resp = client.post(f"/repricing/sku/{sku.id}/apply", json={"new_price": "129.99"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["applied"] is True
    assert body["new_price"] == 129.99
    # apply_price_change was called with source="manual"
    assert apply_mock.await_args.kwargs["source"] == "manual"


def test_apply_rejects_price_outside_guardrails(client):
    m = _merchant()
    sku = _sku(m.id, floor_price=Decimal("80.00"), ceiling_price=Decimal("140.00"))
    session = AsyncMock()
    session.get = AsyncMock(return_value=sku)
    _wire(m, session)

    # 200 is above the ceiling of 140 → 422, no Shopify write.
    resp = client.post(f"/repricing/sku/{sku.id}/apply", json={"new_price": "200.00"})
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"] == "price_out_of_bounds"


def test_apply_404_when_not_owner(client):
    m = _merchant()
    other = _sku(uuid.uuid4())          # different merchant
    session = AsyncMock()
    session.get = AsyncMock(return_value=other)
    _wire(m, session)

    resp = client.post(f"/repricing/sku/{other.id}/apply", json={"new_price": "99.00"})
    assert resp.status_code == 404


def test_apply_409_when_shopify_needs_reconnect(client, monkeypatch):
    m = _merchant()
    sku = _sku(m.id)
    session = AsyncMock()
    session.get = AsyncMock(return_value=sku)
    session.commit = AsyncMock()
    _wire(m, session)

    monkeypatch.setattr(repricing, "apply_price_change",
                        AsyncMock(return_value=MagicMock(applied=False, needs_reconnect=True,
                                                         reason="shopify_auth_failed", price_change=None)))
    resp = client.post(f"/repricing/sku/{sku.id}/apply", json={"new_price": "129.99"})
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "shopify_reconnect_required"


def test_apply_502_when_shopify_write_fails(client, monkeypatch):
    m = _merchant()
    sku = _sku(m.id)
    session = AsyncMock()
    session.get = AsyncMock(return_value=sku)
    session.commit = AsyncMock()
    _wire(m, session)

    monkeypatch.setattr(repricing, "apply_price_change",
                        AsyncMock(return_value=MagicMock(applied=False, needs_reconnect=False,
                                                         reason="shopify_failed:boom", price_change=None)))
    resp = client.post(f"/repricing/sku/{sku.id}/apply", json={"new_price": "129.99"})
    assert resp.status_code == 502
    assert resp.json()["detail"]["error"] == "shopify_write_failed"

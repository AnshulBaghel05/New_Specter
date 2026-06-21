import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ.setdefault("ENCRYPTION_KEY", __import__("base64").urlsafe_b64encode(b"k" * 32).decode())

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import routers.merchants as merchants
from auth.supabase import get_current_merchant
from db import get_db
from main import app
from models.merchants import Merchant


def _merchant(connected=True):
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = "recon"
    m.shopify_domain = "s.myshopify.com" if connected else None
    m.shopify_access_token = "enc" if connected else None
    m.shopify_reconnect_required = False
    return m


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _wire(merchant, session):
    async def _m(): return merchant
    async def _db(): yield session
    app.dependency_overrides[get_current_merchant] = _m
    app.dependency_overrides[get_db] = _db


def _resp(status=200, products=None, link=""):
    r = MagicMock()
    r.status_code = status
    r.ok = status < 300
    r.json.return_value = {"products": products or []}
    r.headers = {"Link": link}
    return r


def _scalars(values):
    res = MagicMock()
    res.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=values)))
    res.scalar_one = MagicMock(return_value=values if isinstance(values, int) else 0)
    return res


# ── Browse ──────────────────────────────────────────────────────────────────────

def test_browse_flags_already_imported_variants(client, monkeypatch):
    m = _merchant()
    session = AsyncMock()
    # one query: existing variant ids → {"v1"}
    session.execute = AsyncMock(return_value=_scalars(["v1"]))
    session.commit = AsyncMock()
    _wire(m, session)
    monkeypatch.setattr(merchants.crypto, "decrypt", lambda *_: "tok")

    products = [{"id": 1, "title": "Tee", "handle": "tee", "variants": [
        {"id": "v1", "title": "S", "price": "10.00"},
        {"id": "v2", "title": "M", "price": "10.00"}]}]
    with patch.object(merchants, "_shopify_get", new=AsyncMock(return_value=_resp(products=products))):
        resp = client.get("/merchants/shopify/products")
    assert resp.status_code == 200
    variants = resp.json()["products"][0]["variants"]
    by_id = {v["variant_id"]: v["imported"] for v in variants}
    assert by_id == {"v1": True, "v2": False}


def test_browse_409_when_not_connected(client):
    m = _merchant(connected=False)
    _wire(m, AsyncMock())
    resp = client.get("/merchants/shopify/products")
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "no_shopify_connection"


def test_browse_409_on_expired_token(client, monkeypatch):
    m = _merchant()
    session = AsyncMock(); session.commit = AsyncMock()
    _wire(m, session)
    monkeypatch.setattr(merchants.crypto, "decrypt", lambda *_: "tok")
    with patch.object(merchants, "_shopify_get", new=AsyncMock(side_effect=merchants.ShopifyAuthExpired())):
        resp = client.get("/merchants/shopify/products")
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "shopify_reconnect_required"
    assert m.shopify_reconnect_required is True


# ── Import ────────────────────────────────────────────────────────────────────

def test_import_selected_skips_existing_and_counts(client, monkeypatch):
    m = _merchant()
    session = AsyncMock()
    # 1) count used → 1 ; 2) existing variant ids → {"v1"}
    session.execute = AsyncMock(side_effect=[_scalars(1), _scalars(["v1"])])
    session.add = MagicMock()
    session.commit = AsyncMock()
    _wire(m, session)
    monkeypatch.setattr(merchants.crypto, "decrypt", lambda *_: "tok")

    products = [{"id": 1, "title": "Tee", "handle": "tee", "variants": [
        {"id": "v1", "title": "S", "price": "10.00"},   # already imported → skip
        {"id": "v2", "title": "M", "price": "12.00"}]}]  # import
    with patch.object(merchants, "_shopify_get", new=AsyncMock(return_value=_resp(products=products))):
        resp = client.post("/merchants/shopify/import", json={"variant_ids": ["v1", "v2"]})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["imported"] == 1 and body["skipped"] == 1
    assert session.add.call_count == 1


def test_import_enforces_product_ceiling(client, monkeypatch):
    m = _merchant()
    session = AsyncMock()
    # used already at the cap
    session.execute = AsyncMock(side_effect=[_scalars(merchants.MAX_SKUS_PER_MERCHANT), _scalars([])])
    session.add = MagicMock()
    session.commit = AsyncMock()
    _wire(m, session)
    monkeypatch.setattr(merchants.crypto, "decrypt", lambda *_: "tok")

    products = [{"id": 1, "title": "Tee", "handle": "tee",
                 "variants": [{"id": "v9", "title": "S", "price": "10.00"}]}]
    with patch.object(merchants, "_shopify_get", new=AsyncMock(return_value=_resp(products=products))):
        resp = client.post("/merchants/shopify/import", json={"import_all": True})
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "sku_limit_reached"


def test_import_422_when_nothing_selected(client, monkeypatch):
    m = _merchant()
    _wire(m, AsyncMock())
    monkeypatch.setattr(merchants.crypto, "decrypt", lambda *_: "tok")
    resp = client.post("/merchants/shopify/import", json={})
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"] == "nothing_selected"

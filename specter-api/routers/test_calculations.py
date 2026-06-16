import base64
import os

# Set env before any app import. These mirror test_merchants.py: importing
# `main` pulls in routers.merchants, which captures the Shopify/encryption env
# at import time (module-level constants). pytest collects this file before
# test_merchants.py alphabetically, so if those vars are unset here the
# merchants router caches empty values and its OAuth routes 500 in the full
# suite. Setting them here keeps the import order-independent.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ.setdefault("ENCRYPTION_KEY", base64.urlsafe_b64encode(b"t" * 32).decode())
os.environ.setdefault("SHOPIFY_API_KEY", "test_api_key")
os.environ.setdefault("SHOPIFY_API_SECRET", "test_api_secret")
os.environ.setdefault("SHOPIFY_REDIRECT_URI", "https://api.specterapp.io/merchants/shopify/callback")
os.environ.setdefault("DASHBOARD_URL", "https://app.specterapp.io/dashboard")

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
from routers.calculations import to_out


def _ns(**kw):
    return SimpleNamespace(**kw)


# ── Pure serializer (to_out) ──────────────────────────────────────────────────

def test_to_out_maps_fields_and_derives_archived_false():
    cid = uuid.uuid4()
    calc = _ns(
        id=cid, tool_name="shipping", name="Q2 Shipping",
        inputs={"weight": 2.5}, results={"cheapest": "USPS"},
        currency="USD", archived_at=None,
        created_at=datetime(2026, 6, 4, tzinfo=timezone.utc),
    )
    out = to_out(calc)
    assert out.id == cid
    assert out.tool_name == "shipping"
    assert out.name == "Q2 Shipping"
    assert out.inputs == {"weight": 2.5}
    assert out.results == {"cheapest": "USPS"}
    assert out.currency == "USD"
    assert out.archived is False
    assert out.created_at == "2026-06-04T00:00:00+00:00"


def test_to_out_derives_archived_true_when_timestamp_set():
    calc = _ns(
        id=uuid.uuid4(), tool_name="roas", name="Archived run",
        inputs={}, results={}, currency=None,
        archived_at=datetime(2026, 6, 4, tzinfo=timezone.utc),
        created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
    )
    assert to_out(calc).archived is True


def test_to_out_preserves_nested_json_blobs():
    calc = _ns(
        id=uuid.uuid4(), tool_name="shopify-profit", name="May",
        inputs={"price": 50, "nested": {"a": [1, 2, 3]}},
        results={"profit": 18.4, "rows": [{"label": "x"}]},
        currency="USD", archived_at=None,
        created_at=datetime(2026, 6, 4, tzinfo=timezone.utc),
    )
    out = to_out(calc)
    assert out.inputs["nested"]["a"] == [1, 2, 3]
    assert out.results["rows"][0]["label"] == "x"


# ── Route smoke tests ──────────────────────────────────────────────────────────

def _merchant(plan="free"):
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = plan
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
    async def _ovr_merchant():
        return merchant

    async def _ovr_db():
        yield session

    app.dependency_overrides[get_current_merchant] = _ovr_merchant
    app.dependency_overrides[get_db] = _ovr_db


def test_list_empty_returns_empty_array(client):
    m = _merchant()
    session = AsyncMock()
    result = MagicMock()
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    session.execute = AsyncMock(return_value=result)
    _wire(m, session)

    resp = client.get("/calculations")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_persists_and_returns_201(client):
    m = _merchant()
    session = AsyncMock()
    created = {}

    # The cap check counts existing rows first; this merchant has 0.
    session.execute = AsyncMock(return_value=MagicMock(scalar_one=MagicMock(return_value=0)))

    def _add(obj):
        # mimic DB defaults assigned on flush/refresh
        obj.id = uuid.uuid4()
        obj.created_at = datetime(2026, 6, 4, tzinfo=timezone.utc)
        obj.archived_at = None
        created["calc"] = obj

    session.add = MagicMock(side_effect=_add)
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    _wire(m, session)

    resp = client.post("/calculations", json={
        "tool_name": "shipping",
        "name": "Q2 Shipping Analysis",
        "inputs": {"weight": 2.5},
        "results": {"cheapest": "USPS", "rate": 7.20},
        "currency": "USD",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["tool_name"] == "shipping"
    assert body["name"] == "Q2 Shipping Analysis"
    assert body["results"]["cheapest"] == "USPS"
    assert body["archived"] is False
    # row was scoped to the authenticated merchant
    assert created["calc"].merchant_id == m.id


def test_create_rejected_at_calculation_cap(client):
    """At the per-merchant cap, POST /calculations → 409 and never persists."""
    from routers.calculations import MAX_CALCULATIONS_PER_MERCHANT

    m = _merchant()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(
        scalar_one=MagicMock(return_value=MAX_CALCULATIONS_PER_MERCHANT)))
    session.add = MagicMock()
    session.commit = AsyncMock()
    _wire(m, session)

    resp = client.post("/calculations", json={
        "tool_name": "shipping", "name": "one too many",
        "inputs": {}, "results": {},
    })
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "calculation_limit_reached"
    session.add.assert_not_called()
    session.commit.assert_not_awaited()


def test_get_other_merchants_calc_returns_404(client):
    m = _merchant()
    other = _ns(
        id=uuid.uuid4(), merchant_id=uuid.uuid4(),  # different owner
        tool_name="roas", name="x", inputs={}, results={},
        currency=None, archived_at=None,
        created_at=datetime(2026, 6, 4, tzinfo=timezone.utc),
    )
    session = AsyncMock()
    session.get = AsyncMock(return_value=other)
    _wire(m, session)

    resp = client.get(f"/calculations/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"] == "calculation_not_found"


def test_get_missing_calc_returns_404(client):
    m = _merchant()
    session = AsyncMock()
    session.get = AsyncMock(return_value=None)
    _wire(m, session)

    resp = client.get(f"/calculations/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_patch_archive_sets_archived_true(client):
    m = _merchant()
    calc = _ns(
        id=uuid.uuid4(), merchant_id=m.id,
        tool_name="roas", name="Old name", inputs={}, results={},
        currency=None, archived_at=None,
        created_at=datetime(2026, 6, 4, tzinfo=timezone.utc),
    )
    session = AsyncMock()
    session.get = AsyncMock(return_value=calc)
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    _wire(m, session)

    resp = client.patch(f"/calculations/{calc.id}", json={"name": "New name", "archived": True})
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "New name"
    assert body["archived"] is True
    assert calc.archived_at is not None


def test_delete_owned_returns_204(client):
    m = _merchant()
    calc = _ns(
        id=uuid.uuid4(), merchant_id=m.id,
        tool_name="roas", name="x", inputs={}, results={},
        currency=None, archived_at=None,
        created_at=datetime(2026, 6, 4, tzinfo=timezone.utc),
    )
    session = AsyncMock()
    session.get = AsyncMock(return_value=calc)
    session.delete = AsyncMock()
    session.commit = AsyncMock()
    _wire(m, session)

    resp = client.delete(f"/calculations/{calc.id}")
    assert resp.status_code == 204
    session.delete.assert_awaited_once()

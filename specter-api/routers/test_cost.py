import asyncio
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from main import app
from db import get_db
from routers.cost import _margins_dep, _per_sku_dep   # the patchable seams


def _override_db():
    async def _gen():
        yield AsyncMock()
    return _gen


@pytest.fixture(autouse=True)
def _admin_key(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret-admin-key")
    yield
    app.dependency_overrides.clear()


def test_margin_requires_admin_key():
    with TestClient(app) as c:
        resp = c.get("/admin/cost/margin?from=2026-06-01&to=2026-06-09")
        assert resp.status_code == 401


def test_margin_rejects_wrong_key():
    with TestClient(app) as c:
        resp = c.get("/admin/cost/margin?from=2026-06-01&to=2026-06-09",
                     headers={"X-Admin-Key": "wrong"})
        assert resp.status_code == 401


def test_margin_returns_rows_with_valid_key():
    app.dependency_overrides[get_db] = _override_db()
    app.dependency_overrides[_margins_dep] = lambda: AsyncMock(
        return_value=[{"merchant_id": "m1", "plan": "recon", "revenue": 79.0,
                       "cost_to_serve": 6.0, "by_type": {"proxy": 6.0},
                       "gross_margin": 0.924, "margin_negative": False}])
    with TestClient(app) as c:
        resp = c.get("/admin/cost/margin?from=2026-06-01&to=2026-06-09",
                     headers={"X-Admin-Key": "secret-admin-key"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["merchants"][0]["plan"] == "recon"


def test_cost_per_sku_requires_admin_key():
    with TestClient(app) as c:
        resp = c.get("/admin/cost/per-sku?from=2026-06-01&to=2026-06-09")
        assert resp.status_code == 401


def test_cost_per_sku_returns_rows_with_valid_key():
    app.dependency_overrides[get_db] = _override_db()
    app.dependency_overrides[_per_sku_dep] = lambda: AsyncMock(
        return_value=[{"merchant_id": "m1", "plan": "recon", "cost_to_serve": 10.0,
                       "active_skus": 5, "cost_per_sku": 2.0, "margin_negative": False}])
    with TestClient(app) as c:
        resp = c.get("/admin/cost/per-sku?from=2026-06-01&to=2026-06-09",
                     headers={"X-Admin-Key": "secret-admin-key"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["merchants"][0]["cost_per_sku"] == 2.0


def test_merchant_cost_per_sku_divides_and_orders(monkeypatch):
    """cost_to_serve / active SKU count; zero-SKU spenders sort worst (first)."""
    from services import cost_margin
    m1, m2, m3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    monkeypatch.setattr(cost_margin, "merchant_margins", AsyncMock(return_value=[
        {"merchant_id": str(m1), "cost_to_serve": 10.0, "margin_negative": False},
        {"merchant_id": str(m2), "cost_to_serve": 4.0, "margin_negative": False},
        {"merchant_id": str(m3), "cost_to_serve": 3.0, "margin_negative": True},
    ]))
    session = AsyncMock()
    # m1: 5 SKUs → 2.0 ; m2: 8 SKUs → 0.5 ; m3: 0 SKUs (spend, no SKUs) → None
    session.execute = AsyncMock(
        return_value=MagicMock(all=MagicMock(return_value=[(m1, 5), (m2, 8)])))

    rows = asyncio.run(cost_margin.merchant_cost_per_sku(session, date(2026, 6, 1), date(2026, 6, 9)))
    by_id = {r["merchant_id"]: r for r in rows}
    assert by_id[str(m1)]["cost_per_sku"] == 2.0
    assert by_id[str(m2)]["cost_per_sku"] == 0.5
    assert by_id[str(m3)]["cost_per_sku"] is None
    # Zero-SKU spender is worst → sorted first; then highest cost-per-SKU.
    assert rows[0]["merchant_id"] == str(m3)
    assert rows[1]["merchant_id"] == str(m1)

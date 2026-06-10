from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient

from main import app
from db import get_db
from routers.cost import _margins_dep   # the patchable seam


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

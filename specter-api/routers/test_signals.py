import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import json

from routers.signals import SignalTypeCounts, _signal_counts


def test_signal_counts_maps_all_three_types():
    counts = _signal_counts([("RAISE", 4), ("LOWER", 2), ("HOLD", 7)])
    assert counts.raise_ == 4
    assert counts.lower == 2
    assert counts.hold == 7


def test_signal_counts_defaults_missing_types_to_zero():
    counts = _signal_counts([("RAISE", 3)])
    assert counts.raise_ == 3
    assert counts.lower == 0
    assert counts.hold == 0


def test_signal_counts_serializes_raise_key_as_raise():
    counts = _signal_counts([("RAISE", 1)])
    body = json.loads(counts.model_dump_json())
    assert body["raise"] == 1          # not "raise_"
    assert body["lower"] == 0
    assert body["hold"] == 0


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


def _merchant(plan="recon"):
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = plan
    return m


def _sig(**kw):
    base = dict(
        id=uuid.uuid4(), sku_id=uuid.uuid4(), type="RAISE", confidence=0.82,
        reasoning="why", price_suggestion=99.0, source="ai", ai_fallback=False,
        created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
    )
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _wire(session, merchant):
    async def _ovr_merchant():
        return merchant

    async def _ovr_db():
        yield session

    app.dependency_overrides[get_current_merchant] = _ovr_merchant
    app.dependency_overrides[get_db] = _ovr_db


def test_list_signals_serializes_current_price_and_counts(client):
    m = _merchant()
    sig = _sig()
    total_res = MagicMock(scalar_one=MagicMock(return_value=1))
    page_res = MagicMock(all=MagicMock(return_value=[(sig, "My SKU", 120.0)]))
    counts_res = MagicMock(all=MagicMock(return_value=[("RAISE", 1)]))
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[total_res, page_res, counts_res])
    _wire(session, m)

    resp = client.get("/signals")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["current_price"] == 120.0
    assert item["sku_title"] == "My SKU"
    assert body["counts"]["raise"] == 1
    assert body["counts"]["lower"] == 0


def test_invalid_sort_returns_422(client):
    _wire(AsyncMock(), _merchant())
    resp = client.get("/signals?sort=banana")
    assert resp.status_code == 422


def test_min_confidence_out_of_range_returns_422(client):
    _wire(AsyncMock(), _merchant())
    resp = client.get("/signals?min_confidence=1.5")
    assert resp.status_code == 422


# ── Date-range window (F9: PREDATOR+ 90 days, else 30) ───────────────────────

from datetime import date, timedelta

from routers.signals import RangeExceedsPlan, resolve_history_range


def test_resolve_history_range_predator_allows_60_days_back():
    now = datetime(2026, 6, 5, 12, 0, tzinfo=timezone.utc)
    start, end = resolve_history_range("predator", now.date() - timedelta(days=60), None, now)
    assert start.date() == now.date() - timedelta(days=60)
    assert end == now


def test_resolve_history_range_cipher_rejects_45_days_back():
    now = datetime(2026, 6, 5, 12, 0, tzinfo=timezone.utc)
    with pytest.raises(RangeExceedsPlan) as exc:
        resolve_history_range("cipher", now.date() - timedelta(days=45), None, now)
    assert exc.value.max_days == 30


def test_list_signals_predator_90_day_range_ok(client):
    m = _merchant(plan="predator")
    sig = _sig()
    total_res = MagicMock(scalar_one=MagicMock(return_value=1))
    page_res = MagicMock(all=MagicMock(return_value=[(sig, "My SKU", 120.0)]))
    counts_res = MagicMock(all=MagicMock(return_value=[("RAISE", 1)]))
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[total_res, page_res, counts_res])
    _wire(session, m)

    date_from = (date.today() - timedelta(days=80)).isoformat()
    resp = client.get(f"/signals?date_from={date_from}")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


def test_list_signals_cipher_beyond_30_days_returns_400(client):
    _wire(AsyncMock(), _merchant(plan="cipher"))
    date_from = (date.today() - timedelta(days=45)).isoformat()
    resp = client.get(f"/signals?date_from={date_from}")
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["error"] == "range_exceeds_plan"
    assert detail["max_days"] == 30

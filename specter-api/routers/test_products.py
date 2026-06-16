import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from auth.supabase import get_current_merchant
from db import get_db
from main import app
from models.merchants import Merchant
from routers.products import assemble_products


def _ns(**kw):
    return SimpleNamespace(**kw)


def test_assemble_groups_competitors_under_product_and_derives_source():
    p_id = uuid.uuid4()
    url_id = uuid.uuid4()
    tr_id = uuid.uuid4()
    sku = _ns(id=p_id, title="Earbuds", handle="earbuds", current_price=Decimal("89.99"),
              shopify_variant_id="123", active=True, floor_price=None, ceiling_price=None)
    tracking = _ns(id=tr_id, own_product_id=p_id, competitor_url_id=url_id,
                   enabled=True, silenced_oos=False)
    url = _ns(domain="amazon.com", url_path="/dp/x", robots_blocked=False)
    snap = _ns(price=Decimal("79.99"), in_stock=True,
               scraped_at=datetime(2026, 5, 31, tzinfo=timezone.utc))
    sig = _ns(type="RAISE", price_suggestion=Decimal("93.40"),
              confidence=Decimal("0.82"), created_at=datetime(2026, 5, 31, tzinfo=timezone.utc))

    out = assemble_products(
        skus=[sku], trackings=[tracking],
        url_by_id={url_id: url}, snapshot_by_url={url_id: snap},
        signal_by_sku={p_id: sig}, sku_used=1, sku_limit=100, max_competitors_per_sku=3,
    )
    assert out.sku_used == 1 and out.sku_limit == 100 and out.max_competitors_per_sku == 3
    assert len(out.items) == 1
    item = out.items[0]
    assert item.source == "shopify"          # shopify_variant_id present
    assert item.competitor_count == 1
    assert item.latest_signal.type == "RAISE"
    assert float(item.latest_signal.confidence) == 0.82
    assert len(item.competitors) == 1
    c = item.competitors[0]
    assert c.domain == "amazon.com"
    assert c.url == "https://amazon.com/dp/x"
    assert c.latest_price == Decimal("79.99")
    assert c.in_stock is True


def test_decimal_fields_serialize_to_json_numbers_not_strings():
    """The dashboard types prices/confidence as `number` and calls .toFixed() on
    them. Pydantic v2 would serialize a bare Decimal to a JSON *string* (breaking
    .toFixed at runtime), so this surface must emit JSON numbers."""
    p_id = uuid.uuid4(); url_id = uuid.uuid4(); tr_id = uuid.uuid4()
    sku = _ns(id=p_id, title="Earbuds", handle="e", current_price=Decimal("89.99"),
              shopify_variant_id="1", active=True,
              floor_price=Decimal("70.00"), ceiling_price=Decimal("120.00"))
    tracking = _ns(id=tr_id, own_product_id=p_id, competitor_url_id=url_id,
                   enabled=True, silenced_oos=False)
    url = _ns(domain="amazon.com", url_path="/x", robots_blocked=False)
    snap = _ns(price=Decimal("79.99"), in_stock=True,
               scraped_at=datetime(2026, 5, 31, tzinfo=timezone.utc))
    sig = _ns(type="RAISE", price_suggestion=Decimal("93.40"),
              confidence=Decimal("0.82"), created_at=datetime(2026, 5, 31, tzinfo=timezone.utc))

    out = assemble_products(
        skus=[sku], trackings=[tracking],
        url_by_id={url_id: url}, snapshot_by_url={url_id: snap},
        signal_by_sku={p_id: sig}, sku_used=1, sku_limit=100, max_competitors_per_sku=3,
    )
    import json
    body = json.loads(out.model_dump_json())
    item = body["items"][0]
    for field in ("current_price", "floor_price", "ceiling_price"):
        assert isinstance(item[field], (int, float)), f"{field} must be a JSON number"
    assert isinstance(item["latest_signal"]["confidence"], (int, float))
    assert isinstance(item["latest_signal"]["price_suggestion"], (int, float))
    assert isinstance(item["competitors"][0]["latest_price"], (int, float))
    assert item["latest_signal"]["confidence"] == 0.82


def test_assemble_manual_source_and_missing_snapshot_and_signal():
    p_id = uuid.uuid4(); url_id = uuid.uuid4(); tr_id = uuid.uuid4()
    sku = _ns(id=p_id, title="Manual", handle=None, current_price=None,
              shopify_variant_id=None, active=True, floor_price=None, ceiling_price=None)
    tracking = _ns(id=tr_id, own_product_id=p_id, competitor_url_id=url_id,
                   enabled=True, silenced_oos=False)
    url = _ns(domain="rival.com", url_path="/p", robots_blocked=True)

    out = assemble_products(
        skus=[sku], trackings=[tracking],
        url_by_id={url_id: url}, snapshot_by_url={}, signal_by_sku={},
        sku_used=1, sku_limit=None, max_competitors_per_sku=None,
    )
    item = out.items[0]
    assert item.source == "manual"            # no shopify_variant_id
    assert item.latest_signal is None
    c = item.competitors[0]
    assert c.latest_price is None and c.in_stock is None and c.last_checked_at is None
    assert c.robots_blocked is True


def test_last_checked_at_prefers_url_last_scraped_at_over_snapshot():
    """Freshness comes from the URL's last_scraped_at (last actual check), so it
    stays current even when an unchanged scrape is skip-written and the latest
    stored snapshot is older. Falls back to snapshot.scraped_at only when the URL
    has no recorded check."""
    p_id = uuid.uuid4(); url_id = uuid.uuid4(); tr_id = uuid.uuid4()
    sku = _ns(id=p_id, title="X", handle=None, current_price=Decimal("10"),
              shopify_variant_id=None, active=True, floor_price=None, ceiling_price=None)
    tracking = _ns(id=tr_id, own_product_id=p_id, competitor_url_id=url_id,
                   enabled=True, silenced_oos=False)
    # URL last checked just now; latest stored snapshot is a week old (unchanged since).
    url = _ns(domain="a.com", url_path="/p", robots_blocked=False,
              last_scraped_at=datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc))
    snap = _ns(price=Decimal("10"), in_stock=True,
               scraped_at=datetime(2026, 6, 8, 12, 0, tzinfo=timezone.utc))

    out = assemble_products(
        skus=[sku], trackings=[tracking],
        url_by_id={url_id: url}, snapshot_by_url={url_id: snap},
        signal_by_sku={}, sku_used=1, sku_limit=100, max_competitors_per_sku=3,
    )
    c = out.items[0].competitors[0]
    # The recent URL check wins over the stale snapshot timestamp.
    assert c.last_checked_at == "2026-06-15T12:00:00+00:00"


# ── Route smoke test ─────────────────────────────────────────────────────────

def _merchant(plan="recon"):
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = plan
    m.max_competitors_per_sku = 3
    return m


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_get_products_empty_returns_counts(client):
    m = _merchant(plan="recon")

    session = AsyncMock()
    # Every select(...).scalars().all() → [] ; func.count() → 0
    empty = MagicMock()
    empty.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    empty.scalar_one = MagicMock(return_value=0)
    session.execute = AsyncMock(return_value=empty)

    async def _ovr_merchant(): return m
    async def _ovr_db(): yield session
    app.dependency_overrides[get_current_merchant] = _ovr_merchant
    app.dependency_overrides[get_db] = _ovr_db

    resp = client.get("/products")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["sku_used"] == 0
    assert body["sku_limit"] == 100          # RECON
    assert body["max_competitors_per_sku"] == 3

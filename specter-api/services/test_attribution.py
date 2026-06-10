"""
Tests for the revenue attribution service.

compute_revenue_delta is pure. attribute_price_change is exercised with a mocked
fetch_units_sold so the Shopify Orders API is never called.

Run: pytest services/test_attribution.py -v
"""
from __future__ import annotations

import asyncio
import base64
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/t")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:p@localhost:6379")
os.environ.setdefault("ENCRYPTION_KEY", base64.urlsafe_b64encode(b"t" * 32).decode())

import pytest

from services import attribution
from services.attribution import attribute_price_change, compute_revenue_delta


def D(v: str | float) -> Decimal:
    return Decimal(str(v))


# ── compute_revenue_delta (pure) ──────────────────────────────────────────────

class TestComputeRevenueDelta:
    def test_price_raise_with_sales_is_positive(self):
        # Raised $10, sold 5 units → +$50 recovered
        assert compute_revenue_delta(D(100), D(110), 5) == D("50.00")

    def test_price_lower_is_negative(self):
        # Lowered $10, sold 8 units → -$80
        assert compute_revenue_delta(D(120), D(110), 8) == D("-80.00")

    def test_zero_units_is_zero(self):
        assert compute_revenue_delta(D(100), D(150), 0) == D("0.00")

    def test_fractional_prices_round_to_cents(self):
        # (109.99 - 99.99) * 3 = 30.00
        assert compute_revenue_delta(D("99.99"), D("109.99"), 3) == D("30.00")

    def test_no_price_change_is_zero(self):
        assert compute_revenue_delta(D(100), D(100), 10) == D("0.00")


# ── attribute_price_change (Shopify mock) ────────────────────────────────────

def _merchant():
    from services import crypto
    m = MagicMock()
    m.id = uuid.uuid4()
    m.shopify_domain = "teststore.myshopify.com"
    m.shopify_access_token = crypto.encrypt("shpat_token")
    return m


def _price_change(old: str, new: str) -> MagicMock:
    pc = MagicMock()
    pc.id = uuid.uuid4()
    pc.old_price = D(old)
    pc.new_price = D(new)
    pc.created_at = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
    pc.revenue_delta = None
    return pc


def _sku():
    s = MagicMock()
    s.id = uuid.uuid4()
    s.shopify_variant_id = "98765"
    return s


class TestAttributePriceChange:
    def test_writes_revenue_delta_from_units_sold(self):
        merchant, sku = _merchant(), _sku()
        pc = _price_change("100.00", "110.00")
        session = MagicMock()

        with patch.object(attribution, "fetch_units_sold", new=AsyncMock(return_value=7)):
            result = asyncio.run(attribute_price_change(session, merchant, pc, sku))

        assert result is not None
        assert result.units_sold == 7
        # (110 - 100) * 7 = 70
        assert result.revenue_delta == D("70.00")
        assert pc.revenue_delta == D("70.00")  # written onto the row

    def test_lower_price_records_negative_delta(self):
        merchant, sku = _merchant(), _sku()
        pc = _price_change("120.00", "110.00")
        session = MagicMock()

        with patch.object(attribution, "fetch_units_sold", new=AsyncMock(return_value=4)):
            result = asyncio.run(attribute_price_change(session, merchant, pc, sku))

        assert result is not None
        assert result.revenue_delta == D("-40.00")
        assert pc.revenue_delta == D("-40.00")

    def test_returns_none_without_shopify_connection(self):
        merchant, sku = _merchant(), _sku()
        merchant.shopify_access_token = None
        pc = _price_change("100.00", "110.00")
        session = MagicMock()

        result = asyncio.run(attribute_price_change(session, merchant, pc, sku))
        assert result is None

    def test_returns_none_without_variant_id(self):
        merchant, sku = _merchant(), _sku()
        sku.shopify_variant_id = None
        pc = _price_change("100.00", "110.00")
        session = MagicMock()

        result = asyncio.run(attribute_price_change(session, merchant, pc, sku))
        assert result is None

    def test_zero_units_writes_zero_delta(self):
        merchant, sku = _merchant(), _sku()
        pc = _price_change("100.00", "110.00")
        session = MagicMock()

        with patch.object(attribution, "fetch_units_sold", new=AsyncMock(return_value=0)):
            result = asyncio.run(attribute_price_change(session, merchant, pc, sku))

        assert result is not None
        assert result.revenue_delta == D("0.00")

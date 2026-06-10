"""
Tests for the auto-reprice service.

Pure pricing math (compute_reprice) needs no I/O. The Shopify apply path is
exercised with a mocked _update_shopify_price to verify floor/ceiling clamping,
the 3x retry loop, and the 401 reconnect path.

Run: pytest services/test_repricer.py -v
"""
from __future__ import annotations

import asyncio
import os
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/t")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:p@localhost:6379")
import base64
os.environ.setdefault("ENCRYPTION_KEY", base64.urlsafe_b64encode(b"t" * 32).decode())

import pytest

from services import repricer
from services.repricer import (
    RepriceDecision,
    ShopifyApiError,
    ShopifyAuthError,
    apply_price_change,
    compute_reprice,
)


def D(v: str | float) -> Decimal:
    return Decimal(str(v))


# ── compute_reprice (pure) ────────────────────────────────────────────────────

class TestComputeReprice:
    def test_raise_undercuts_lowest_instock_by_penny(self):
        d = compute_reprice("RAISE", D(100), floor_price=None, ceiling_price=D(200),
                            instock_competitor_prices=[D(120), D(130), D(125)])
        assert d is not None
        # lowest in-stock = 120 → 119.99
        assert d.new_price == D("119.99")
        assert d.clamped is None

    def test_raise_clamped_to_ceiling(self):
        # lowest competitor 150 → 149.99, but ceiling is 130 → clamp to 130
        d = compute_reprice("RAISE", D(100), floor_price=D(90), ceiling_price=D(130),
                            instock_competitor_prices=[D(150), D(160)])
        assert d is not None
        assert d.new_price == D("130.00")
        assert d.clamped == "ceiling"
        assert "ceiling-clamped" in d.reason

    def test_lower_matches_median_minus_penny(self):
        # median(80, 90, 100) = 90 → 89.99
        d = compute_reprice("LOWER", D(120), floor_price=D(50), ceiling_price=None,
                            instock_competitor_prices=[D(80), D(90), D(100)])
        assert d is not None
        assert d.new_price == D("89.99")
        assert d.clamped is None

    def test_lower_clamped_to_floor(self):
        # median(60, 60) = 60 → 59.99, floor 80 → clamp to 80
        d = compute_reprice("LOWER", D(120), floor_price=D(80), ceiling_price=None,
                            instock_competitor_prices=[D(60), D(60)])
        assert d is not None
        assert d.new_price == D("80.00")
        assert d.clamped == "floor"
        assert "floor-clamped" in d.reason

    def test_hold_returns_none(self):
        assert compute_reprice("HOLD", D(100), None, None, [D(120)]) is None

    def test_no_competitors_returns_none(self):
        assert compute_reprice("RAISE", D(100), None, None, []) is None

    def test_noop_when_target_equals_current(self):
        # lowest competitor 100.01 → 100.00 == current → no-op
        d = compute_reprice("RAISE", D("100.00"), None, None, [D("100.01")])
        assert d is None

    def test_zero_current_price_returns_none(self):
        assert compute_reprice("RAISE", D(0), None, None, [D(120)]) is None


# ── apply_price_change (Shopify mock) ────────────────────────────────────────

def _merchant():
    m = MagicMock()
    m.id = uuid.uuid4()
    m.shopify_domain = "teststore.myshopify.com"
    # Encrypt a fake token so crypto.decrypt round-trips.
    from services import crypto
    m.shopify_access_token = crypto.encrypt("shpat_token")
    m.shopify_reconnect_required = False
    return m


def _sku():
    s = MagicMock()
    s.id = uuid.uuid4()
    s.shopify_variant_id = "98765"
    s.current_price = D("100.00")
    return s


def _session():
    sess = MagicMock()
    sess.add = MagicMock()
    return sess


class TestApplyPriceChange:
    def test_success_writes_price_change_and_updates_sku(self):
        merchant, sku, session = _merchant(), _sku(), _session()
        decision = RepriceDecision(new_price=D("119.99"), clamped=None, reason="RAISE")

        with patch.object(repricer, "_update_shopify_price", new=AsyncMock(return_value=None)):
            outcome = asyncio.run(apply_price_change(session, merchant, sku, decision, signal_id=None))

        assert outcome.applied is True
        assert outcome.price_change is not None
        assert outcome.price_change.new_price == D("119.99")
        assert outcome.price_change.source == "auto"
        assert sku.current_price == D("119.99")
        session.add.assert_called_once()

    def test_retries_3x_on_transient_failure_then_gives_up(self):
        merchant, sku, session = _merchant(), _sku(), _session()
        decision = RepriceDecision(new_price=D("119.99"), clamped=None, reason="RAISE")

        mock_put = AsyncMock(side_effect=ShopifyApiError("503 service unavailable"))

        with patch.object(repricer, "_update_shopify_price", new=mock_put):
            with patch.object(repricer.asyncio, "sleep", new=AsyncMock()):  # skip backoff
                outcome = asyncio.run(apply_price_change(session, merchant, sku, decision))

        assert outcome.applied is False
        assert mock_put.call_count == repricer.MAX_RETRIES  # exactly 3 attempts
        assert "shopify_failed" in outcome.reason
        session.add.assert_not_called()

    def test_succeeds_on_third_attempt(self):
        merchant, sku, session = _merchant(), _sku(), _session()
        decision = RepriceDecision(new_price=D("119.99"), clamped=None, reason="RAISE")

        # Fail twice, succeed on the third call.
        mock_put = AsyncMock(side_effect=[ShopifyApiError("fail"), ShopifyApiError("fail"), None])

        with patch.object(repricer, "_update_shopify_price", new=mock_put):
            with patch.object(repricer.asyncio, "sleep", new=AsyncMock()):
                outcome = asyncio.run(apply_price_change(session, merchant, sku, decision))

        assert outcome.applied is True
        assert mock_put.call_count == 3
        session.add.assert_called_once()

    def test_401_sets_reconnect_and_does_not_retry(self):
        merchant, sku, session = _merchant(), _sku(), _session()
        decision = RepriceDecision(new_price=D("119.99"), clamped=None, reason="RAISE")

        mock_put = AsyncMock(side_effect=ShopifyAuthError("401"))

        with patch.object(repricer, "_update_shopify_price", new=mock_put):
            outcome = asyncio.run(apply_price_change(session, merchant, sku, decision))

        assert outcome.applied is False
        assert outcome.needs_reconnect is True
        assert merchant.shopify_reconnect_required is True
        assert mock_put.call_count == 1  # no retry on auth failure
        session.add.assert_not_called()

    def test_no_shopify_connection_returns_early(self):
        merchant, sku, session = _merchant(), _sku(), _session()
        merchant.shopify_access_token = None
        decision = RepriceDecision(new_price=D("119.99"), clamped=None, reason="RAISE")

        outcome = asyncio.run(apply_price_change(session, merchant, sku, decision))
        assert outcome.applied is False
        assert outcome.reason == "no_shopify_connection"

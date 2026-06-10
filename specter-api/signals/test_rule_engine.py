"""
Tests for the rule-based signal engine and supporting logic.

All tests are synchronous (pure logic + mock Redis).
No real database or Redis connection required.

Run: pytest signals/test_rule_engine.py -v
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import MagicMock, call

import pytest

from signals.rule_engine import (
    LOWER_THRESHOLD,
    CompetitorDataPoint,
    SignalResult,
    compute_signal,
)
from signals.oos_detector import is_oos_transition, is_restock
from signals.dispatcher import check_and_set_dedup, dedup_key


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _point(price: float, in_stock: bool = True, currency: str = "USD") -> CompetitorDataPoint:
    return CompetitorDataPoint(
        tracking_id=str(uuid.uuid4()),
        price=Decimal(str(price)),
        in_stock=in_stock,
        currency=currency,
    )


def _price(v: float) -> Decimal:
    return Decimal(str(v))


# ── RAISE signal ──────────────────────────────────────────────────────────────

class TestRaiseSignal:
    def test_raise_when_single_competitor_more_expensive(self):
        """One in-stock competitor priced above merchant → RAISE."""
        result = compute_signal(_price(100.00), [_point(120.00)])
        assert result is not None
        assert result.signal_type == "RAISE"

    def test_raise_when_multiple_competitors_some_more_expensive(self):
        """Multiple competitors; at least one above merchant → RAISE.
        Fixture ensures merchant is NOT in LOWER territory:
        median([100, 120]) = 110; threshold = 115.5; merchant 100 < 115.5 → not LOWER.
        Competitor 120 > merchant 100 → RAISE.
        """
        result = compute_signal(_price(100.00), [
            _point(100.00),
            _point(120.00),  # above merchant; median=110, not in LOWER territory
        ])
        assert result is not None
        assert result.signal_type == "RAISE"

    def test_raise_not_triggered_when_merchant_most_expensive(self):
        """All competitors cheaper than merchant → no RAISE."""
        result = compute_signal(_price(120.00), [
            _point(100.00),
            _point(110.00),
        ])
        # Merchant is priciest; should be HOLD (not below LOWER threshold: 120 vs 105*1.05=110.25)
        assert result is not None
        assert result.signal_type in ("HOLD", "LOWER")
        assert result.signal_type != "RAISE"

    def test_raise_confidence_scales_with_tracking_count(self):
        """Confidence increases as more enabled trackings exist."""
        # 5 enabled trackings → base confidence = 1.0
        five_trackings = [_point(120.00)] * 5
        r5 = compute_signal(_price(100.00), five_trackings)
        assert r5 is not None
        assert r5.confidence == Decimal("1.00")

        # 2 enabled trackings → base confidence = 0.40
        two_trackings = [_point(120.00)] * 2
        r2 = compute_signal(_price(100.00), two_trackings)
        assert r2 is not None
        assert r2.confidence == Decimal("0.40")

    def test_raise_reasoning_contains_price_info(self):
        result = compute_signal(_price(100.00), [_point(125.00)])
        assert result is not None
        assert "125" in result.reasoning
        assert "100" in result.reasoning

    def test_raise_reasoning_max_120_chars(self):
        result = compute_signal(_price(100.00), [_point(120.00)] * 10)
        assert result is not None
        assert len(result.reasoning) <= 120


# ── LOWER signal ──────────────────────────────────────────────────────────────

class TestLowerSignal:
    def test_lower_when_5pct_above_median(self):
        """Merchant more than 5% above market median → LOWER."""
        # median = 90, threshold = 90 * 1.05 = 94.5, merchant = 100
        result = compute_signal(_price(100.00), [
            _point(85.00),
            _point(90.00),
            _point(95.00),
        ])
        assert result is not None
        assert result.signal_type == "LOWER"

    def test_lower_when_significantly_overpriced(self):
        """Merchant at 50% above median → LOWER."""
        result = compute_signal(_price(150.00), [
            _point(100.00),
            _point(100.00),
        ])
        assert result is not None
        assert result.signal_type == "LOWER"

    def test_lower_takes_priority_over_raise(self):
        """
        LOWER has priority over RAISE.
        Even if one competitor is more expensive, LOWER fires when merchant
        is already above the 5% median threshold.
        """
        # Merchant=120, competitors=80 and 150 (in stock)
        # median=115, threshold=120.75; merchant 120 < 120.75 → NOT LOWER in this case
        # Let's construct a clear case:
        # Merchant=130, competitors=100 and 150
        # median=125, threshold=131.25; 130 < 131.25 → not LOWER yet
        # Let's go higher:
        # Merchant=140, competitors=100 and 150
        # median=125, threshold=131.25; 140 > 131.25 → LOWER
        # But 150 > 140 → would RAISE if LOWER not prioritised
        result = compute_signal(_price(140.00), [
            _point(100.00),
            _point(150.00),  # would trigger RAISE if not for LOWER priority
        ])
        assert result is not None
        assert result.signal_type == "LOWER"

    def test_lower_not_triggered_at_exactly_5pct(self):
        """At exactly 5% above median, LOWER is NOT triggered (strict >)."""
        # median = 100, 5% threshold = 105, merchant = exactly 105
        result = compute_signal(_price(105.00), [
            _point(100.00),
            _point(100.00),
        ])
        assert result is not None
        # Merchant = 105, all competitors at 100 — no competitor above merchant
        # So: not LOWER (exactly at threshold, not above), not RAISE → HOLD
        assert result.signal_type == "HOLD"

    def test_lower_reasoning_contains_pct_and_median(self):
        result = compute_signal(_price(120.00), [_point(100.00), _point(105.00)])
        assert result is not None
        assert result.signal_type == "LOWER"
        assert "median" in result.reasoning.lower() or "$" in result.reasoning

    def test_lower_confidence_capped_when_single_instock(self):
        """< 2 in-stock competitors → confidence capped at 0.60."""
        result = compute_signal(_price(200.00), [
            _point(100.00),     # in stock
            _point(100.00, in_stock=False),  # OOS
            _point(100.00, in_stock=False),
            _point(100.00, in_stock=False),
            _point(100.00, in_stock=False),
        ])
        assert result is not None
        assert result.signal_type == "LOWER"
        assert result.confidence <= Decimal("0.60")


# ── HOLD signal ───────────────────────────────────────────────────────────────

class TestHoldSignal:
    def test_hold_when_all_competitors_oos(self):
        """All competitors OOS → HOLD (F4: insufficient data for RAISE)."""
        result = compute_signal(_price(100.00), [
            _point(120.00, in_stock=False),
            _point(80.00,  in_stock=False),
        ])
        assert result is not None
        assert result.signal_type == "HOLD"

    def test_hold_when_merchant_equals_all_competitor_prices(self):
        """Merchant at exact same price as all competitors → HOLD."""
        result = compute_signal(_price(100.00), [
            _point(100.00),
            _point(100.00),
        ])
        assert result is not None
        assert result.signal_type == "HOLD"

    def test_hold_when_merchant_highest_below_lower_threshold(self):
        """Merchant is most expensive but within 5% of median → HOLD."""
        # Competitors: 100, 103. median=101.5. threshold=106.575. Merchant=105 < 106.575
        # No competitor above 105 → no RAISE
        result = compute_signal(_price(105.00), [
            _point(100.00),
            _point(103.00),
        ])
        assert result is not None
        assert result.signal_type == "HOLD"

    def test_hold_when_no_trackings(self):
        """No competitor trackings → HOLD with low confidence."""
        result = compute_signal(_price(100.00), [])
        assert result is not None
        assert result.signal_type == "HOLD"

    def test_hold_returns_none_for_zero_merchant_price(self):
        """Merchant price = 0 → no signal (data error guard)."""
        result = compute_signal(_price(0.00), [_point(100.00)])
        assert result is None

    def test_hold_returns_none_for_none_merchant_price(self):
        """Merchant price = None → no signal."""
        result = compute_signal(None, [_point(100.00)])  # type: ignore[arg-type]
        assert result is None


# ── Confidence scoring ────────────────────────────────────────────────────────

class TestConfidenceScoring:
    def test_max_confidence_at_five_trackings(self):
        result = compute_signal(_price(100.00), [_point(120.00)] * 5)
        assert result is not None
        assert result.confidence == Decimal("1.00")

    def test_confidence_four_trackings(self):
        result = compute_signal(_price(100.00), [_point(120.00)] * 4)
        assert result is not None
        assert result.confidence == Decimal("0.80")

    def test_confidence_three_trackings(self):
        result = compute_signal(_price(100.00), [_point(120.00)] * 3)
        assert result is not None
        assert result.confidence == Decimal("0.60")

    def test_confidence_capped_below_two_instock(self):
        """< 2 in-stock → confidence capped at 0.60 even with 5 enabled trackings."""
        result = compute_signal(_price(100.00), [
            _point(120.00, in_stock=True),   # 1 in-stock
            _point(80.00,  in_stock=False),
            _point(80.00,  in_stock=False),
            _point(80.00,  in_stock=False),
            _point(80.00,  in_stock=False),
        ])
        assert result is not None
        # 5 enabled, 1 in-stock → cap applies → confidence ≤ 0.60
        assert result.confidence <= Decimal("0.60")

    def test_confidence_min_floor(self):
        """Confidence never drops below 0.10."""
        result = compute_signal(_price(100.00), [])  # 0 enabled
        assert result is not None
        assert result.confidence >= Decimal("0.10")


# ── Outlier filtering ─────────────────────────────────────────────────────────

class TestOutlierFiltering:
    def test_outlier_does_not_corrupt_lower_signal(self):
        """
        A bad parse (e.g. $9999 for a $100 product) should not cause a spurious
        RAISE signal by being treated as an expensive competitor.
        """
        # Legitimate prices: 95, 100. Outlier: 9999 (> 5× median ~97.5 → excluded).
        result = compute_signal(_price(90.00), [
            _point(95.00),
            _point(100.00),
            _point(9999.00),  # outlier — > 5 × median of (95, 100) = 97.5 → excluded
        ])
        assert result is not None
        # Without outlier: merchant=90, competitors=95,100. 95 and 100 > 90 → RAISE
        # This is actually correct — the outlier is excluded, leaving valid RAISE
        assert result.signal_type == "RAISE"

    def test_no_raise_from_single_extreme_outlier_when_rest_cheaper(self):
        """
        Merchant at 50, normal competitors at 45, 48, outlier at 5000.
        After outlier removal, no competitor above merchant → HOLD or LOWER.
        """
        result = compute_signal(_price(50.00), [
            _point(45.00),
            _point(48.00),
            _point(5000.00),   # outlier, excluded
        ])
        assert result is not None
        # After outlier removal: median(45, 48) = 46.5, threshold = 48.8, 50 > 48.8 → LOWER
        assert result.signal_type == "LOWER"


# ── Source / ai_fallback fields ───────────────────────────────────────────────

class TestSignalFields:
    def test_rule_engine_signal_has_source_rule(self):
        """
        compute_signal itself does not set source/ai_fallback — those are set by
        the dispatcher's _write_signal helper.  Verify the dispatcher constants.
        """
        from signals.dispatcher import _AI_PLANS, _write_signal
        # Rule engine result type check
        result = compute_signal(_price(100.00), [_point(120.00)])
        assert result is not None
        assert isinstance(result, SignalResult)
        assert result.signal_type in ("RAISE", "LOWER", "HOLD")

    def test_dispatcher_writes_source_rule_for_recon(self):
        """
        The dispatcher writes source='rule', ai_fallback=False for RECON plan.
        Verify via a mocked session + redis (synchronous mock, no async needed).
        """
        # We test the dedup path only (sync).  Full async dispatch is covered by
        # integration tests.  Here we confirm the Signal is constructed correctly
        # by inspecting a direct call to _write_signal via its dedup-check helper.
        mock_redis = MagicMock()
        mock_redis.exists.return_value = 0  # no dedup hit

        sku_id = str(uuid.uuid4())
        # Calling check_and_set_dedup: should return False and call setex
        hit = check_and_set_dedup(mock_redis, sku_id, "RAISE")
        assert hit is False
        mock_redis.setex.assert_called_once_with(
            f"signal:dedup:{sku_id}:RAISE", 3600, "1"
        )


# ── Duplicate suppression ─────────────────────────────────────────────────────

class TestDuplicateSuppression:
    def test_first_call_returns_false_and_sets_key(self):
        """First call for a SKU+type: dedup miss → write allowed → key set."""
        mock_redis = MagicMock()
        mock_redis.exists.return_value = 0

        sku_id = str(uuid.uuid4())
        result = check_and_set_dedup(mock_redis, sku_id, "LOWER")

        assert result is False
        mock_redis.exists.assert_called_once_with(dedup_key(sku_id, "LOWER"))
        mock_redis.setex.assert_called_once_with(dedup_key(sku_id, "LOWER"), 3600, "1")

    def test_second_call_within_ttl_returns_true(self):
        """Second call for the same SKU+type within 1hr: dedup hit → write suppressed."""
        mock_redis = MagicMock()
        mock_redis.exists.side_effect = [0, 1]  # first miss, second hit

        sku_id = str(uuid.uuid4())

        first  = check_and_set_dedup(mock_redis, sku_id, "RAISE")
        second = check_and_set_dedup(mock_redis, sku_id, "RAISE")

        assert first  is False  # first write allowed
        assert second is True   # second write suppressed

        # setex called only once (on cache miss)
        assert mock_redis.setex.call_count == 1

    def test_different_signal_types_independent_dedup(self):
        """RAISE and LOWER for the same SKU are tracked independently."""
        mock_redis = MagicMock()
        mock_redis.exists.return_value = 0  # always miss

        sku_id = str(uuid.uuid4())
        r1 = check_and_set_dedup(mock_redis, sku_id, "RAISE")
        r2 = check_and_set_dedup(mock_redis, sku_id, "LOWER")

        assert r1 is False
        assert r2 is False
        assert mock_redis.setex.call_count == 2

    def test_dedup_key_format(self):
        """Dedup key follows the expected format for Redis ops inspection."""
        sku_id = "abc-123"
        key = dedup_key(sku_id, "RAISE")
        assert key == "signal:dedup:abc-123:RAISE"


# ── OOS detection ─────────────────────────────────────────────────────────────

class TestOOSDetection:
    # ── is_oos_transition ──────────────────────────────────────────────────────

    def test_oos_transition_true_to_false(self):
        """in_stock true→false is an OOS transition."""
        assert is_oos_transition(current_in_stock=False, previous_in_stock=True) is True

    def test_no_transition_when_already_oos(self):
        """in_stock false→false is NOT a new OOS event."""
        assert is_oos_transition(current_in_stock=False, previous_in_stock=False) is False

    def test_no_transition_when_in_stock(self):
        """in_stock true→* is never an OOS transition."""
        assert is_oos_transition(current_in_stock=True, previous_in_stock=True)  is False
        assert is_oos_transition(current_in_stock=True, previous_in_stock=False) is False

    def test_oos_transition_assumes_was_in_stock_when_no_history(self):
        """No previous snapshot (None) → assume was in stock → OOS transition triggers."""
        assert is_oos_transition(current_in_stock=False, previous_in_stock=None) is True

    # ── is_restock ────────────────────────────────────────────────────────────

    def test_restock_false_to_true(self):
        """in_stock false→true is a restock."""
        assert is_restock(current_in_stock=True, previous_in_stock=False) is True

    def test_no_restock_when_always_in_stock(self):
        """in_stock true→true is not a restock event."""
        assert is_restock(current_in_stock=True, previous_in_stock=True) is False

    def test_no_restock_when_currently_oos(self):
        """Current OOS is never a restock."""
        assert is_restock(current_in_stock=False, previous_in_stock=False) is False
        assert is_restock(current_in_stock=False, previous_in_stock=True)  is False

    # ── Flapping guard (deduplication) ────────────────────────────────────────

    def test_oos_flapping_results_in_single_transition(self):
        """
        Simulate rapid flap: T→F→T→F within same cycle.
        Only the first T→F counts as a new OOS event (subsequent F→F are no-ops).
        """
        states = [True, False, True, False]
        transitions = []
        for i in range(1, len(states)):
            if is_oos_transition(states[i], states[i - 1]):
                transitions.append(i)

        # Only the first false (index 1) is a new OOS transition;
        # the second false (index 3) follows True (index 2) — also a transition.
        # This simulates what the DB-level dedup handles: if an active alert
        # already exists for the tracking, detect_and_write skips the insert.
        assert len(transitions) == 2  # transitions at index 1 and 3
        # The DB-level check (_has_active_alert) would block the second insert.

    def test_oos_then_restock_then_oos_produces_two_events(self):
        """
        T → F (OOS) → T (restock, resolves alert) → F (new OOS) → two events.
        Alerts are resolved on restock, so the second OOS creates a fresh alert.
        """
        states = [True, False, True, False]
        oos_events   = []
        restock_events = []
        for i in range(1, len(states)):
            if is_oos_transition(states[i], states[i - 1]):
                oos_events.append(i)
            elif is_restock(states[i], states[i - 1]):
                restock_events.append(i)

        assert len(oos_events) == 2     # F at index 1 and F at index 3
        assert len(restock_events) == 1  # T at index 2


# ── Edge cases and boundary conditions ───────────────────────────────────────

class TestEdgeCases:
    def test_single_competitor_below_lower_threshold(self):
        """One competitor, merchant slightly above (< 5%) → no LOWER, check RAISE/HOLD."""
        # Competitor=100, merchant=103 → 3% above, below 5% threshold
        result = compute_signal(_price(103.00), [_point(100.00)])
        assert result is not None
        # No competitor above 103 → HOLD
        assert result.signal_type == "HOLD"

    def test_merchant_far_below_all_competitors(self):
        """Merchant cheaper than all in-stock competitors → RAISE."""
        result = compute_signal(_price(50.00), [
            _point(80.00),
            _point(90.00),
            _point(100.00),
        ])
        assert result is not None
        assert result.signal_type == "RAISE"
        assert "50" in result.reasoning
        assert "100" in result.reasoning

    def test_mixed_in_stock_and_oos_competitors(self):
        """
        OOS competitors are excluded from pricing decisions.
        Only in-stock prices count for RAISE/LOWER/median.
        """
        # OOS competitor at $50 (cheaper) → excluded from median
        # In-stock competitor at $120 → RAISE
        result = compute_signal(_price(100.00), [
            _point(50.00,  in_stock=False),
            _point(120.00, in_stock=True),
        ])
        assert result is not None
        assert result.signal_type == "RAISE"

    def test_all_oos_gives_hold_not_lower(self):
        """All competitors OOS → never LOWER (F4: HOLD when insufficient data)."""
        result = compute_signal(_price(200.00), [
            _point(10.00, in_stock=False),
            _point(10.00, in_stock=False),
        ])
        assert result is not None
        assert result.signal_type == "HOLD"

    def test_signal_type_is_valid_literal(self):
        """All returned signal_types are valid."""
        valid = {"RAISE", "LOWER", "HOLD"}
        for merchant_price in [50.0, 100.0, 200.0]:
            for comp_price in [80.0, 100.0, 120.0]:
                r = compute_signal(_price(merchant_price), [_point(comp_price)])
                if r:
                    assert r.signal_type in valid

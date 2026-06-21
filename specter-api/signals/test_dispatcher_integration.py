"""
Tests for the dispatcher's two best-effort side-effect integrations:

  _notify_oos_alerts  — F5 OOS emails fired for newly created alerts
  _maybe_reprice      — F7 auto-reprice triggered from RAISE/LOWER signals

The emphasis is robustness: a mail outage or a Shopify failure must NEVER raise
out of these helpers, and gating (email-off, no recipient, auto-reprice-off,
per-SKU off) must be honoured so users are never emailed or repriced wrongly.

Run: pytest signals/test_dispatcher_integration.py -v
"""
from __future__ import annotations

import asyncio
import os
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/t")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:p@localhost:6379")

import pytest

from models.competitor_trackings import CompetitorTracking
from models.competitor_urls import CompetitorURL
from models.merchants import Merchant
from models.skus import SKU
from signals import dispatcher
from signals.rule_engine import CompetitorDataPoint
from services.repricer import RepriceOutcome


def D(v: str | float) -> Decimal:
    return Decimal(str(v))


# ── A minimal async session that routes session.get(Model, id) by registration ─

class FakeSession:
    def __init__(self) -> None:
        self._objs: dict[tuple, object] = {}
        self.added: list = []
        self.flushed = 0

    def put(self, model, id_, obj) -> None:
        self._objs[(model, id_)] = obj

    async def get(self, model, id_):
        return self._objs.get((model, id_))

    def add(self, obj) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        self.flushed += 1


# ── Builders ──────────────────────────────────────────────────────────────────

def _alert(sku_id, tracking_id):
    a = MagicMock()
    a.id = uuid.uuid4()
    a.sku_id = sku_id
    a.competitor_tracking_id = tracking_id
    return a


def _oos_world(*, email_on=True, recipient="merchant@example.com", domain="competitor.com"):
    """Wire up a session with one alert resolvable to merchant/competitor/sku."""
    sku_id, tracking_id, cu_id, merchant_id = (uuid.uuid4() for _ in range(4))

    sku = MagicMock(); sku.id = sku_id; sku.merchant_id = merchant_id; sku.title = "Blue Widget"
    merchant = MagicMock(); merchant.id = merchant_id
    merchant.email_notifications_enabled = email_on
    merchant.notification_email = recipient
    tracking = MagicMock(); tracking.id = tracking_id; tracking.competitor_url_id = cu_id
    cu = MagicMock(); cu.id = cu_id; cu.domain = domain

    sess = FakeSession()
    sess.put(SKU, sku_id, sku)
    sess.put(Merchant, merchant_id, merchant)
    sess.put(CompetitorTracking, tracking_id, tracking)
    sess.put(CompetitorURL, cu_id, cu)

    return sess, _alert(sku_id, tracking_id)


# ── In-app notification triggers (Step 4 wiring) ─────────────────────────────

class TestNotificationTriggers:
    def test_notify_signal_fires_for_raise_and_lower(self):
        merchant = MagicMock(); merchant.id = uuid.uuid4(); merchant.plan = "recon"
        sku = MagicMock(); sku.id = uuid.uuid4(); sku.title = "Widget"
        with patch.object(dispatcher.notifications, "notify_signal", new=AsyncMock()) as m:
            for t in ("RAISE", "LOWER"):
                sig = MagicMock(); sig.type = t
                asyncio.run(dispatcher._notify_signal(MagicMock(), merchant, sku, sig))
        assert m.await_count == 2

    def test_notify_signal_skips_hold_and_dedup_suppressed(self):
        merchant = MagicMock(); merchant.id = uuid.uuid4(); merchant.plan = "recon"
        sku = MagicMock(); sku.id = uuid.uuid4(); sku.title = "Widget"
        with patch.object(dispatcher.notifications, "notify_signal", new=AsyncMock()) as m:
            hold = MagicMock(); hold.type = "HOLD"
            asyncio.run(dispatcher._notify_signal(MagicMock(), merchant, sku, hold))
            asyncio.run(dispatcher._notify_signal(MagicMock(), merchant, sku, None))  # dedup-suppressed
        m.assert_not_awaited()

    def test_oos_alert_creates_in_app_notification(self):
        sess, alert = _oos_world(domain="rivalshop.com")
        with patch.object(dispatcher.email, "send_oos_alert_email", new=AsyncMock(return_value=True)), \
             patch.object(dispatcher.notifications, "notify_oos", new=AsyncMock()) as m:
            asyncio.run(dispatcher._notify_oos_alerts(sess, [alert]))
        m.assert_awaited_once()
        assert m.await_args.kwargs["competitor_domain"] == "rivalshop.com"
        assert m.await_args.kwargs["sku_title"] == "Blue Widget"

    def test_signal_email_sent_for_raise_when_email_on(self):
        merchant = MagicMock(); merchant.id = uuid.uuid4(); merchant.plan = "recon"
        merchant.email_notifications_enabled = True
        merchant.notification_email = "m@x.com"
        sku = MagicMock(); sku.id = uuid.uuid4(); sku.title = "Widget"
        sig = MagicMock(); sig.type = "RAISE"
        with patch.object(dispatcher.notifications, "notify_signal", new=AsyncMock()), \
             patch.object(dispatcher.email, "send_signal_alert_email", new=AsyncMock()) as m:
            asyncio.run(dispatcher._notify_signal(MagicMock(), merchant, sku, sig))
        m.assert_awaited_once_with("m@x.com", "Widget", "RAISE")

    def test_signal_email_skipped_when_email_off(self):
        merchant = MagicMock(); merchant.id = uuid.uuid4(); merchant.plan = "recon"
        merchant.email_notifications_enabled = False
        merchant.notification_email = "m@x.com"
        sku = MagicMock(); sku.id = uuid.uuid4(); sku.title = "Widget"
        sig = MagicMock(); sig.type = "LOWER"
        with patch.object(dispatcher.notifications, "notify_signal", new=AsyncMock()), \
             patch.object(dispatcher.email, "send_signal_alert_email", new=AsyncMock()) as m:
            asyncio.run(dispatcher._notify_signal(MagicMock(), merchant, sku, sig))
        m.assert_not_awaited()

    def test_restock_emails_merchant(self):
        sess, alert = _oos_world(domain="rivalshop.com")
        with patch.object(dispatcher.email, "send_restock_alert_email", new=AsyncMock(return_value=True)) as m:
            asyncio.run(dispatcher._notify_restock_alerts(sess, [alert]))
        m.assert_awaited_once()
        assert m.await_args.args[1] == "Blue Widget"   # sku_title


# ── _notify_oos_alerts ────────────────────────────────────────────────────────

class TestNotifyOOSAlerts:
    def test_sends_email_with_competitor_and_sku(self):
        sess, alert = _oos_world(domain="rivalshop.com")
        send = AsyncMock(return_value=True)
        with patch.object(dispatcher.email, "send_oos_alert_email", new=send):
            asyncio.run(dispatcher._notify_oos_alerts(sess, [alert]))
        send.assert_awaited_once()
        kwargs = send.await_args.kwargs
        assert kwargs["to"] == "merchant@example.com"
        assert kwargs["competitor_name"] == "rivalshop.com"
        assert kwargs["sku_title"] == "Blue Widget"

    def test_notified_at_stamped_on_success(self):
        sess, alert = _oos_world()
        alert.notified_at = None
        with patch.object(dispatcher.email, "send_oos_alert_email", new=AsyncMock(return_value=True)):
            asyncio.run(dispatcher._notify_oos_alerts(sess, [alert]))
        assert alert.notified_at is not None

    def test_notified_at_not_stamped_on_send_failure(self):
        sess, alert = _oos_world()
        alert.notified_at = None
        with patch.object(dispatcher.email, "send_oos_alert_email", new=AsyncMock(return_value=False)):
            asyncio.run(dispatcher._notify_oos_alerts(sess, [alert]))
        assert alert.notified_at is None

    def test_skipped_when_email_notifications_off(self):
        sess, alert = _oos_world(email_on=False)
        send = AsyncMock(return_value=True)
        with patch.object(dispatcher.email, "send_oos_alert_email", new=send):
            asyncio.run(dispatcher._notify_oos_alerts(sess, [alert]))
        send.assert_not_awaited()

    def test_skipped_when_no_recipient(self):
        sess, alert = _oos_world(recipient=None)
        send = AsyncMock(return_value=True)
        with patch.object(dispatcher.email, "send_oos_alert_email", new=send):
            asyncio.run(dispatcher._notify_oos_alerts(sess, [alert]))
        send.assert_not_awaited()

    def test_mail_outage_is_swallowed(self):
        sess, alert = _oos_world()
        send = AsyncMock(side_effect=RuntimeError("resend down"))
        with patch.object(dispatcher.email, "send_oos_alert_email", new=send):
            # Must not raise — the pipeline keeps running through a mail outage.
            asyncio.run(dispatcher._notify_oos_alerts(sess, [alert]))
        send.assert_awaited_once()

    def test_missing_sku_is_skipped_without_error(self):
        sess = FakeSession()  # nothing registered → session.get returns None
        alert = _alert(uuid.uuid4(), uuid.uuid4())
        send = AsyncMock(return_value=True)
        with patch.object(dispatcher.email, "send_oos_alert_email", new=send):
            asyncio.run(dispatcher._notify_oos_alerts(sess, [alert]))
        send.assert_not_awaited()

    def test_one_bad_alert_does_not_block_the_next(self):
        good_sess, good_alert = _oos_world(domain="good.com")
        # Re-use the same session; register a second, fully-resolvable alert.
        sku2_id, tr2_id, cu2_id, m2_id = (uuid.uuid4() for _ in range(4))
        sku2 = MagicMock(); sku2.id = sku2_id; sku2.merchant_id = m2_id; sku2.title = "Red Widget"
        m2 = MagicMock(); m2.id = m2_id; m2.email_notifications_enabled = True
        m2.notification_email = "two@example.com"
        tr2 = MagicMock(); tr2.id = tr2_id; tr2.competitor_url_id = cu2_id
        cu2 = MagicMock(); cu2.id = cu2_id; cu2.domain = "good2.com"
        good_sess.put(SKU, sku2_id, sku2)
        good_sess.put(Merchant, m2_id, m2)
        good_sess.put(CompetitorTracking, tr2_id, tr2)
        good_sess.put(CompetitorURL, cu2_id, cu2)
        bad_alert = _alert(sku2_id, tr2_id)

        # First alert raises inside send; second must still be attempted.
        send = AsyncMock(side_effect=[RuntimeError("boom"), True])
        with patch.object(dispatcher.email, "send_oos_alert_email", new=send):
            asyncio.run(dispatcher._notify_oos_alerts(good_sess, [good_alert, bad_alert]))
        assert send.await_count == 2


# ── _maybe_reprice ────────────────────────────────────────────────────────────

def _reprice_world(*, merchant_auto=True, sku_auto=True, signal_type="RAISE"):
    merchant = MagicMock(); merchant.id = uuid.uuid4()
    merchant.auto_reprice_enabled = merchant_auto

    sku = MagicMock(); sku.id = uuid.uuid4()
    sku.auto_reprice_enabled = sku_auto
    sku.active = True
    sku.current_price = D("100.00")
    sku.floor_price = D("50.00")
    sku.ceiling_price = D("200.00")

    signal = MagicMock(); signal.id = uuid.uuid4(); signal.sku_id = sku.id
    signal.type = signal_type

    data = [
        CompetitorDataPoint(tracking_id="t1", price=D("120.00"), in_stock=True, currency="USD"),
        CompetitorDataPoint(tracking_id="t2", price=D("130.00"), in_stock=True, currency="USD"),
    ]
    return merchant, sku, signal, [(sku, data)]


class TestMaybeReprice:
    def test_applies_for_raise_signal(self):
        merchant, sku, signal, skus_and_data = _reprice_world()
        sess = FakeSession()
        apply = AsyncMock(return_value=RepriceOutcome(True, MagicMock(), "ok"))
        with patch.object(dispatcher.repricer, "apply_price_change", new=apply):
            asyncio.run(dispatcher._maybe_reprice(sess, merchant, [signal], skus_and_data))
        apply.assert_awaited_once()
        # compute_reprice: lowest in-stock 120 → 119.99 (under ceiling 200)
        decision = apply.await_args.args[3]
        assert decision.new_price == D("119.99")

    def test_skipped_when_merchant_auto_off(self):
        merchant, sku, signal, skus_and_data = _reprice_world(merchant_auto=False)
        sess = FakeSession()
        apply = AsyncMock()
        with patch.object(dispatcher.repricer, "apply_price_change", new=apply):
            asyncio.run(dispatcher._maybe_reprice(sess, merchant, [signal], skus_and_data))
        apply.assert_not_awaited()

    def test_skipped_when_sku_auto_off(self):
        merchant, sku, signal, skus_and_data = _reprice_world(sku_auto=False)
        sess = FakeSession()
        apply = AsyncMock()
        with patch.object(dispatcher.repricer, "apply_price_change", new=apply):
            asyncio.run(dispatcher._maybe_reprice(sess, merchant, [signal], skus_and_data))
        apply.assert_not_awaited()

    def test_hold_signal_does_not_reprice(self):
        merchant, sku, signal, skus_and_data = _reprice_world(signal_type="HOLD")
        sess = FakeSession()
        apply = AsyncMock()
        with patch.object(dispatcher.repricer, "apply_price_change", new=apply):
            asyncio.run(dispatcher._maybe_reprice(sess, merchant, [signal], skus_and_data))
        apply.assert_not_awaited()

    def test_shopify_failure_is_isolated_not_raised(self):
        merchant, sku, signal, skus_and_data = _reprice_world()
        sess = FakeSession()
        apply = AsyncMock(side_effect=RuntimeError("shopify exploded"))
        with patch.object(dispatcher.repricer, "apply_price_change", new=apply):
            # Must not raise — one SKU's failure cannot break the pipeline.
            asyncio.run(dispatcher._maybe_reprice(sess, merchant, [signal], skus_and_data))
        apply.assert_awaited_once()

    def test_needs_reconnect_halts_remaining_skus(self):
        merchant, sku, signal, skus_and_data = _reprice_world()
        # Second SKU + signal that would otherwise also reprice.
        sku2 = MagicMock(); sku2.id = uuid.uuid4()
        sku2.auto_reprice_enabled = True; sku2.active = True
        sku2.current_price = D("100.00"); sku2.floor_price = D("50"); sku2.ceiling_price = D("200")
        signal2 = MagicMock(); signal2.id = uuid.uuid4(); signal2.sku_id = sku2.id; signal2.type = "RAISE"
        data2 = [CompetitorDataPoint(tracking_id="t3", price=D("120"), in_stock=True, currency="USD")]
        skus_and_data.append((sku2, data2))

        sess = FakeSession()
        apply = AsyncMock(return_value=RepriceOutcome(False, None, "shopify_auth_failed", needs_reconnect=True))
        with patch.object(dispatcher.repricer, "apply_price_change", new=apply):
            asyncio.run(dispatcher._maybe_reprice(sess, merchant, [signal, signal2], skus_and_data))
        # First 401 halts the loop — second SKU is never attempted.
        assert apply.await_count == 1

    def test_no_signals_is_a_noop(self):
        merchant, sku, signal, skus_and_data = _reprice_world()
        sess = FakeSession()
        apply = AsyncMock()
        with patch.object(dispatcher.repricer, "apply_price_change", new=apply):
            asyncio.run(dispatcher._maybe_reprice(sess, merchant, [], skus_and_data))
        apply.assert_not_awaited()
        assert sess.flushed == 0  # early return before flush


# ── dispatch_on_snapshot end-to-end orchestration ─────────────────────────────

class TestDispatchOnSnapshotOrdering:
    def _exec_session(self, trackings, getter):
        """Session whose .execute() yields `trackings` and .get() routes via getter."""
        sess = MagicMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = trackings
        sess.execute = AsyncMock(return_value=result)
        sess.get = AsyncMock(side_effect=getter)
        return sess

    def test_dispatch_runs_oos_immediately_without_price_signals(self):
        """dispatch_on_snapshot now runs OOS only; price signals are deferred to the cycle."""
        sess = self._exec_session([], lambda *a: None)
        order: list[str] = []
        with patch.object(dispatcher.oos_detector, "detect_and_write",
                          new=AsyncMock(return_value=[MagicMock()])), \
             patch.object(dispatcher, "_notify_oos_alerts",
                          new=AsyncMock(side_effect=lambda *a: order.append("oos"))), \
             patch("signals.ai_engine.process_merchant_batch", new=AsyncMock()) as ai, \
             patch.object(dispatcher, "_maybe_reprice", new=AsyncMock()) as reprice:
            asyncio.run(dispatcher.dispatch_on_snapshot(
                sess, MagicMock(), uuid.uuid4(), uuid.uuid4(), current_in_stock=False,
            ))
        assert order == ["oos"]
        ai.assert_not_awaited()
        reprice.assert_not_awaited()

    def test_no_trackings_still_sends_oos_email_without_error(self):
        """A snapshot with no trackings must not error and still emails OOS alerts."""
        sess = self._exec_session([], lambda *a: None)
        order: list[str] = []

        with patch.object(dispatcher.oos_detector, "detect_and_write",
                          new=AsyncMock(return_value=[MagicMock()])), \
             patch.object(dispatcher, "_notify_oos_alerts",
                          new=AsyncMock(side_effect=lambda *a: order.append("oos"))), \
             patch.object(dispatcher, "_maybe_reprice",
                          new=AsyncMock(side_effect=lambda *a: order.append("reprice"))):
            asyncio.run(dispatcher.dispatch_on_snapshot(
                sess, MagicMock(), uuid.uuid4(), uuid.uuid4(), current_in_stock=False,
            ))

        assert order == ["oos"]  # OOS email fired; no reprice (no trackings)


# ── generate_cycle_signals (cycle-barrier signal generation) ──────────────────

class TestGenerateCycleSignals:
    def _exec_session(self, trackings, getter):
        sess = MagicMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = trackings
        sess.execute = AsyncMock(return_value=result)
        sess.get = AsyncMock(side_effect=getter)
        return sess

    def test_ai_plan_batches_all_skus_then_reprices(self):
        """CIPHER+ runs one AI batch for the merchant, THEN reprices (writes before PUTs)."""
        merchant_id, own_product_id = uuid.uuid4(), uuid.uuid4()
        tracking = MagicMock(); tracking.merchant_id = merchant_id
        tracking.own_product_id = own_product_id
        merchant = MagicMock(); merchant.id = merchant_id; merchant.plan = "cipher"
        merchant.eclipse_interval_ms = 300_000
        sku = MagicMock(); sku.id = own_product_id; sku.active = True; sku.current_price = D("100.00")
        sku.currency = "USD"

        def getter(model, id_):
            return {Merchant: merchant, SKU: sku}.get(model)

        sess = self._exec_session([tracking], getter)
        order: list[str] = []
        data = [CompetitorDataPoint(tracking_id="t1", price=D("120.00"), in_stock=True, currency="USD")]
        fake_ai = AsyncMock(side_effect=lambda *a, **k: order.append("signals") or [MagicMock()])
        with patch.object(dispatcher, "_build_data_points", new=AsyncMock(return_value=data)), \
             patch.object(dispatcher, "_maybe_reprice",
                          new=AsyncMock(side_effect=lambda *a: order.append("reprice"))), \
             patch("signals.ai_engine.process_merchant_batch", new=fake_ai):
            asyncio.run(dispatcher.generate_cycle_signals(sess, MagicMock(), merchant_id))
        assert order == ["signals", "reprice"]
        fake_ai.assert_awaited_once()

    def test_recon_plan_uses_rule_engine_and_never_reprices(self):
        merchant_id, own_product_id = uuid.uuid4(), uuid.uuid4()
        tracking = MagicMock(); tracking.merchant_id = merchant_id
        tracking.own_product_id = own_product_id
        merchant = MagicMock(); merchant.id = merchant_id; merchant.plan = "recon"
        merchant.eclipse_interval_ms = 300_000
        sku = MagicMock(); sku.id = own_product_id; sku.active = True; sku.current_price = D("100.00")
        sku.currency = "USD"

        def getter(model, id_):
            return {Merchant: merchant, SKU: sku}.get(model)

        sess = self._exec_session([tracking], getter)
        data = [CompetitorDataPoint(tracking_id="t1", price=D("120.00"), in_stock=True, currency="USD")]
        write = AsyncMock()
        reprice = AsyncMock()
        with patch.object(dispatcher, "_build_data_points", new=AsyncMock(return_value=data)), \
             patch.object(dispatcher, "compute_signal", return_value=MagicMock()), \
             patch.object(dispatcher, "_write_signal", new=write), \
             patch.object(dispatcher, "_maybe_reprice", new=reprice):
            asyncio.run(dispatcher.generate_cycle_signals(sess, MagicMock(), merchant_id))
        write.assert_awaited()
        reprice.assert_not_awaited()

    def test_competitor_prices_normalized_to_sku_currency(self):
        """A USD competitor price feeding a EUR product is converted to EUR (via the
        FX service) BEFORE compute_signal — otherwise the comparison is garbage."""
        merchant_id, own_product_id = uuid.uuid4(), uuid.uuid4()
        tracking = MagicMock(); tracking.merchant_id = merchant_id
        tracking.own_product_id = own_product_id
        merchant = MagicMock(); merchant.id = merchant_id; merchant.plan = "recon"
        merchant.eclipse_interval_ms = 300_000
        sku = MagicMock(); sku.id = own_product_id; sku.active = True
        sku.current_price = D("100.00"); sku.currency = "EUR"

        def getter(model, id_):
            return {Merchant: merchant, SKU: sku}.get(model)

        sess = self._exec_session([tracking], getter)
        data = [CompetitorDataPoint(tracking_id="t1", price=D("10"), in_stock=True, currency="USD")]
        captured: dict = {}

        def fake_compute(price, points):
            captured["price"] = price
            captured["points"] = points
            return None  # no signal → no write

        with patch.object(dispatcher, "_build_data_points", new=AsyncMock(return_value=data)), \
             patch.object(dispatcher, "compute_signal", side_effect=fake_compute), \
             patch.object(dispatcher.fx, "get_usd_rates", return_value={"USD": 1.0, "EUR": 2.0}):
            asyncio.run(dispatcher.generate_cycle_signals(sess, MagicMock(), merchant_id))

        assert captured["points"][0].price == D("20.00")     # 10 USD × (EUR 2/USD)
        assert captured["points"][0].currency == "EUR"
        assert captured["price"] == D("100.00")              # merchant price already EUR

    def test_unknown_merchant_is_noop(self):
        sess = self._exec_session([], lambda *a: None)  # session.get(Merchant, …) → None
        with patch("signals.ai_engine.process_merchant_batch", new=AsyncMock()) as ai:
            asyncio.run(dispatcher.generate_cycle_signals(sess, MagicMock(), uuid.uuid4()))
        ai.assert_not_awaited()

    def test_no_trackings_is_noop(self):
        merchant = MagicMock(); merchant.plan = "cipher"; merchant.eclipse_interval_ms = 300_000
        sess = self._exec_session([], lambda model, id_: merchant if model is Merchant else None)
        with patch.object(dispatcher, "_build_data_points", new=AsyncMock()) as bdp:
            asyncio.run(dispatcher.generate_cycle_signals(sess, MagicMock(), uuid.uuid4()))
        bdp.assert_not_awaited()

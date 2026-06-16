import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

import services.proxy_guard as pg
from services.proxy_guard import evaluate_residential_budget

NOW = datetime(2026, 6, 16, 12, 0, 0, tzinfo=timezone.utc)
DAY = "2026-06-16"


class FakeRedis:
    """Sync redis subset: get + set(nx, ex) over a dict."""
    def __init__(self, kv=None):
        self.kv = dict(kv or {})

    def get(self, k):
        v = self.kv.get(k)
        return None if v is None else str(v)

    def set(self, k, v, nx=False, ex=None):
        if nx and k in self.kv:
            return None
        self.kv[k] = v
        return True


def _spend_kv(residential, datacenter):
    return {
        f"proxyspend:{DAY}:residential": residential,
        f"proxyspend:{DAY}:datacenter": datacenter,
    }


# ── Pure policy ──────────────────────────────────────────────────────────────

def test_share_breach():
    s = evaluate_residential_budget(30, 70, max_share=0.20, max_usd=1000)
    assert s.breached and s.reasons == ("share",)
    assert round(s.residential_share, 2) == 0.30


def test_usd_breach_without_share():
    # 60 of 1000 → 6% share (ok) but $60 > $50/day cap.
    s = evaluate_residential_budget(60, 940, max_share=0.20, max_usd=50)
    assert s.breached and s.reasons == ("usd",)


def test_both_breaches():
    s = evaluate_residential_budget(60, 140, max_share=0.20, max_usd=50)
    assert set(s.reasons) == {"share", "usd"}


def test_no_breach_under_both_caps():
    s = evaluate_residential_budget(10, 90, max_share=0.20, max_usd=50)
    assert not s.breached and s.reasons == ()


def test_tiny_early_day_does_not_share_alarm():
    # 83% share but only $0.60 total → below min_total floor, so no share breach.
    s = evaluate_residential_budget(0.5, 0.1, max_share=0.20, max_usd=50)
    assert not s.breached


# ── run_proxy_guard (read + alert + once-per-day dedup) ──────────────────────

def test_run_no_breach_does_not_alert(monkeypatch):
    monkeypatch.setattr(pg.email, "send_residential_budget_alert", AsyncMock(return_value=True))
    monkeypatch.setenv("OPS_ALERT_EMAIL", "ops@specterapp.io")
    redis = FakeRedis(_spend_kv(10, 90))   # 10% share, $10 — under caps
    out = asyncio.run(pg.run_proxy_guard(redis, NOW))
    assert out["breached"] is False and out["alerted"] is False
    pg.email.send_residential_budget_alert.assert_not_awaited()


def test_run_breach_alerts_once_then_dedups(monkeypatch):
    alert = AsyncMock(return_value=True)
    monkeypatch.setattr(pg.email, "send_residential_budget_alert", alert)
    monkeypatch.setenv("OPS_ALERT_EMAIL", "ops@specterapp.io")
    redis = FakeRedis(_spend_kv(30, 70))   # 30% share > 20% cap → breach

    first = asyncio.run(pg.run_proxy_guard(redis, NOW))
    assert first["breached"] is True and first["alerted"] is True

    second = asyncio.run(pg.run_proxy_guard(redis, NOW))  # same day
    assert second["breached"] is True and second["alerted"] is False  # deduped

    alert.assert_awaited_once()


def test_run_breach_without_ops_email_does_not_alert(monkeypatch):
    monkeypatch.setattr(pg.email, "send_residential_budget_alert", AsyncMock(return_value=True))
    monkeypatch.delenv("OPS_ALERT_EMAIL", raising=False)
    redis = FakeRedis(_spend_kv(30, 70))
    out = asyncio.run(pg.run_proxy_guard(redis, NOW))
    assert out["breached"] is True and out["alerted"] is False
    pg.email.send_residential_budget_alert.assert_not_awaited()

import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import services.dispatcher as disp
from services.dispatcher import (
    TrackerRow, dispatch_due, fastest_plan, heal_unscheduled_urls, plan_dispatch,
    queue_for_class, read_streak, tick)
from services.scrape_scheduler import PLAN_INTERVALS_MS, PLAN_MAX_INTERVALS_MS

NOW = datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc)
M1 = uuid.UUID("11111111-1111-1111-1111-111111111111")
M2 = uuid.UUID("22222222-2222-2222-2222-222222222222")
CU = uuid.UUID("33333333-3333-3333-3333-333333333333")


def _row(mid, plan, ecl=None):
    return TrackerRow(id=uuid.uuid4(), merchant_id=mid, plan=plan, eclipse_interval_ms=ecl)


# ── Pure routing / helpers ─────────────────────────────────────────────────────

def test_queue_for_class_routes_known_classes_else_probe():
    assert queue_for_class("http_ok") == "scrape:http"
    assert queue_for_class("js_required") == "scrape:playwright"
    assert queue_for_class(None) == "scrape:probe"
    assert queue_for_class("unknown") == "scrape:probe"


def test_read_streak_parses_and_defaults():
    assert read_streak(MagicMock(get=lambda k: "5"), "d", "/p") == 5
    assert read_streak(MagicMock(get=lambda k: None), "d", "/p") == 0
    assert read_streak(MagicMock(get=lambda k: "garbage"), "d", "/p") == 0
    # A Redis failure must not raise — default to full plan speed.
    boom = MagicMock()
    boom.get.side_effect = RuntimeError("redis down")
    assert read_streak(boom, "d", "/p") == 0


def test_fastest_plan():
    assert fastest_plan(["recon", "predator"]) == "predator"
    assert fastest_plan(["recon"]) == "recon"
    assert fastest_plan([]) == "recon"


# ── plan_dispatch — the pure dispatch decision ─────────────────────────────────

def test_plan_dispatch_none_when_no_trackers():
    assert plan_dispatch(CU, "d.com", "/p", None, [], 0, None, NOW) is None


def test_plan_dispatch_one_crawl_serves_all_trackings_and_reconstructs_url():
    rows = [_row(M1, "recon"), _row(M2, "predator")]
    p = plan_dispatch(CU, "shop.com", "/products/x", None, rows, 0, "http_ok", NOW)
    assert p.url == "https://shop.com/products/x"
    assert p.queue == "scrape:http"
    assert len(p.competitor_tracking_ids) == 2           # one fetch, all trackings
    assert {m for m, _ in p.merchant_cycles} == {str(M1), str(M2)}


def test_plan_dispatch_schedules_at_fastest_plan_cross_plan_dedup():
    rows = [_row(M1, "recon"), _row(M2, "predator")]
    p = plan_dispatch(CU, "shop.com", "/p", None, rows, 0, None, NOW)
    assert p.interval_ms == PLAN_INTERVALS_MS["predator"]   # fastest plan wins
    assert p.plan == "predator"


def test_plan_dispatch_cycle_uses_each_merchants_own_plan_interval():
    rows = [_row(M1, "recon"), _row(M2, "predator")]
    p = plan_dispatch(CU, "shop.com", "/p", None, rows, 0, None, NOW)
    cycles = dict(p.merchant_cycles)
    assert cycles[str(M1)] == PLAN_INTERVALS_MS["recon"]     # decoupled from URL interval
    assert cycles[str(M2)] == PLAN_INTERVALS_MS["predator"]


def test_plan_dispatch_adaptive_backoff_is_bounded():
    rows = [_row(M1, "recon")]
    fresh = plan_dispatch(CU, "d", "/p", None, rows, 0, None, NOW)
    stale = plan_dispatch(CU, "d", "/p", None, rows, 9, None, NOW)
    assert fresh.interval_ms == PLAN_INTERVALS_MS["recon"]
    assert stale.interval_ms == PLAN_MAX_INTERVALS_MS["recon"]   # capped, never past 24h


def test_plan_dispatch_next_run_advances_past_now():
    p = plan_dispatch(CU, "d", "/p", None, [_row(M1, "recon")], 0, None, NOW)
    assert p.next_run_at > NOW


# ── dispatch_due — orchestration (mocked DB/queue, in-memory cycle store) ───────

class FakeStore:
    def __init__(self):
        self.expected: dict = {}
    def incr_expected(self, m, c, n, ttl):
        self.expected[(m, c)] = self.expected.get((m, c), 0) + n
        return self.expected[(m, c)]
    def incr_done(self, m, c, ttl): return 0
    def get_counts(self, m, c): return (0, 0)
    def try_set_fired(self, m, c, ttl): return True
    def all_cycles(self): return []
    def cleanup(self, m, c): ...


class FakeCU:
    def __init__(self):
        self.id = CU
        self.domain = "shop.com"
        self.url_path = "/p/x"
        self.phase_offset_ms = None
        self.interval_ms = None
        self.next_run_at = NOW
        self.last_scraped_at = None


def _patch_db(monkeypatch, cu, rows):
    monkeypatch.setattr(disp, "claim_due_urls", AsyncMock(return_value=[cu]))
    monkeypatch.setattr(disp, "enabled_trackings_for_url", AsyncMock(return_value=rows))
    enq = MagicMock()
    monkeypatch.setattr(disp, "enqueue_scrape_job", enq)
    return enq


def test_dispatch_due_enqueues_one_shared_crawl_and_advances_schedule(monkeypatch):
    cu = FakeCU()
    rows = [_row(M1, "recon"), _row(M2, "predator")]
    enq = _patch_db(monkeypatch, cu, rows)
    redis = MagicMock(); redis.get.return_value = None  # streak 0, domain_class None
    store = FakeStore()
    session = MagicMock(); session.commit = AsyncMock()

    result = asyncio.run(dispatch_due(session, redis, store, NOW))

    assert result == {"claimed": 1, "dispatched": 1}
    enq.assert_called_once()
    kw = enq.call_args.kwargs
    assert kw["queue"] == "scrape:probe"
    assert len(kw["competitor_tracking_ids"]) == 2        # both trackings, one crawl
    assert len(kw["merchant_cycle_ids"]) == 2             # one cycle slot per merchant
    # EXPECTED incremented exactly once per merchant
    assert sum(store.expected.values()) == 2
    assert all(v == 1 for v in store.expected.values())
    # schedule advanced + last_scraped stamped
    assert cu.next_run_at > NOW
    assert cu.last_scraped_at == NOW
    session.commit.assert_awaited_once()


def test_dispatch_due_pauses_url_with_no_active_trackers(monkeypatch):
    cu = FakeCU()
    enq = _patch_db(monkeypatch, cu, [])     # no enabled trackings
    redis = MagicMock(); redis.get.return_value = None
    session = MagicMock(); session.commit = AsyncMock()

    result = asyncio.run(dispatch_due(session, redis, FakeStore(), NOW))

    assert result["dispatched"] == 0
    assert cu.next_run_at is None            # paused — no more wasted crawls
    enq.assert_not_called()


# ── heal_unscheduled_urls — self-heal NULL-schedule rows so prices flow ─────────

def test_heal_unscheduled_urls_schedules_tracked_url(monkeypatch):
    # A URL with enabled trackings but next_run_at NULL (legacy/seed data) would
    # never be claimed by claim_due_urls and stay 'pending' forever. Heal must
    # recompute its schedule so it starts dispatching.
    cu = FakeCU()
    cu.next_run_at = None
    cu.phase_offset_ms = None
    cu.interval_ms = None
    monkeypatch.setattr(disp, "select_unscheduled_tracked_urls", AsyncMock(return_value=[cu]))
    monkeypatch.setattr(disp, "enabled_trackings_for_url", AsyncMock(return_value=[_row(M1, "recon")]))
    redis = MagicMock(); redis.get.return_value = None
    session = MagicMock(); session.commit = AsyncMock()

    healed = asyncio.run(heal_unscheduled_urls(session, redis, NOW))

    assert healed == 1
    assert cu.next_run_at is not None and cu.next_run_at > NOW
    assert cu.interval_ms == PLAN_INTERVALS_MS["recon"]
    session.commit.assert_awaited_once()


def test_heal_unscheduled_urls_skips_when_trackings_vanished(monkeypatch):
    # Race: tracking disabled between the SELECT and the refresh — refresh clears
    # next_run_at and the row must NOT be counted as healed.
    cu = FakeCU()
    cu.next_run_at = None
    monkeypatch.setattr(disp, "select_unscheduled_tracked_urls", AsyncMock(return_value=[cu]))
    monkeypatch.setattr(disp, "enabled_trackings_for_url", AsyncMock(return_value=[]))
    redis = MagicMock(); redis.get.return_value = None
    session = MagicMock(); session.commit = AsyncMock()

    healed = asyncio.run(heal_unscheduled_urls(session, redis, NOW))

    assert healed == 0
    assert cu.next_run_at is None


def test_heal_unscheduled_urls_noop_commits_nothing_when_none(monkeypatch):
    monkeypatch.setattr(disp, "select_unscheduled_tracked_urls", AsyncMock(return_value=[]))
    redis = MagicMock(); redis.get.return_value = None
    session = MagicMock(); session.commit = AsyncMock()

    healed = asyncio.run(heal_unscheduled_urls(session, redis, NOW))

    assert healed == 0
    session.commit.assert_not_awaited()      # nothing changed — no write


def test_tick_heals_before_dispatching(monkeypatch):
    cu = FakeCU()
    rows = [_row(M1, "recon")]
    _patch_db(monkeypatch, cu, rows)
    monkeypatch.setattr(disp, "select_unscheduled_tracked_urls", AsyncMock(return_value=[]))
    redis = MagicMock(); redis.get.return_value = None
    session = MagicMock(); session.commit = AsyncMock()

    result = asyncio.run(tick(session, redis, FakeStore(), NOW))

    assert result["claimed"] == 1 and result["dispatched"] == 1
    assert result["healed"] == 0

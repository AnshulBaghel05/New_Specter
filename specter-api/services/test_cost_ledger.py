import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import services.cost_ledger as cl

NOW = datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc)
M1 = uuid.uuid4()
M2 = uuid.uuid4()


class FakeRedis:
    """Minimal sync redis: incrbyfloat/expire/get/scan_iter over a dict."""
    def __init__(self): self.kv = {}
    def incrbyfloat(self, k, amt): self.kv[k] = float(self.kv.get(k, 0)) + float(amt); return self.kv[k]
    def expire(self, k, ttl): return True
    def get(self, k):
        v = self.kv.get(k)
        return None if v is None else str(v)
    def scan_iter(self, match=None, count=None):
        import fnmatch
        return [k for k in list(self.kv) if match is None or fnmatch.fnmatch(k, match)]


def test_record_scrape_cost_splits_across_distinct_merchants():
    redis = FakeRedis()
    session = MagicMock(add=MagicMock())
    # residential 1 GB shared by 2 merchants → each pays half of $8.40 = $4.20 proxy
    asyncio.run(cl.record_scrape_cost(
        session, redis, [M1, M2, M1], "residential", 1_000_000_000, False,
        domain="shop.com", now=NOW, rng=MagicMock(random=lambda: 0.99)))
    k1 = f"cost:daily:{M1}:2026-06-09:proxy"
    k2 = f"cost:daily:{M2}:2026-06-09:proxy"
    assert round(float(redis.get(k1)), 4) == 4.20
    assert round(float(redis.get(k2)), 4) == 4.20
    # The GLOBAL per-tier counter holds the FULL (un-split) proxy cost = $8.40,
    # which the residential-spend guard reads.
    assert round(float(redis.get("proxyspend:2026-06-09:residential")), 2) == 8.40


def test_record_scrape_cost_skips_zero_captcha():
    redis = FakeRedis()
    session = MagicMock(add=MagicMock())
    asyncio.run(cl.record_scrape_cost(
        session, redis, [M1], "datacenter", 1_000, False,
        domain="d.com", now=NOW, rng=MagicMock(random=lambda: 0.99)))
    assert redis.get(f"cost:daily:{M1}:2026-06-09:captcha") is None  # no captcha key written


def test_record_scrape_cost_samples_when_rng_below_rate():
    redis = FakeRedis()
    session = MagicMock(add=MagicMock())
    asyncio.run(cl.record_scrape_cost(
        session, redis, [M1], "residential", 1_000_000_000, True,
        domain="d.com", now=NOW, rng=MagicMock(random=lambda: 0.0)))   # always sample
    assert session.add.called   # a CostEventSample row was added


def test_record_scrape_cost_swallows_errors():
    boom = MagicMock()
    boom.incrbyfloat.side_effect = RuntimeError("redis down")
    session = MagicMock(add=MagicMock())
    # must not raise
    asyncio.run(cl.record_scrape_cost(
        session, boom, [M1], "residential", 1_000_000_000, False, domain="d.com", now=NOW))


def test_record_ai_cost_accrues_to_one_merchant():
    redis = FakeRedis()
    session = MagicMock(add=MagicMock())
    asyncio.run(cl.record_ai_cost(
        session, redis, M1, "gemini-1.5-pro", 1_000_000, 1_000_000,
        now=NOW, rng=MagicMock(random=lambda: 0.99)))
    assert round(float(redis.get(f"cost:daily:{M1}:2026-06-09:ai")), 4) == round(1.25 + 5.00, 4)


def test_flush_daily_upserts_rollup_rows():
    redis = FakeRedis()
    redis.kv[f"cost:daily:{M1}:2026-06-09:proxy"] = 4.2
    redis.kv[f"cost:daily:{M1}:2026-06-09:proxy:units"] = 3
    session = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    written = asyncio.run(cl.flush_daily(session, redis, "2026-06-09"))
    assert written == 1
    session.execute.assert_awaited()      # an upsert statement was executed
    session.commit.assert_awaited_once()

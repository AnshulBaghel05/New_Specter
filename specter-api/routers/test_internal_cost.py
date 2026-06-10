"""Audit #4 Task 6 — the ingest router accrues per-merchant scrape cost.

A fetch's cost is recorded once per NEW snapshot (split across the merchants
sharing the crawl) and once per failed fetch. Recording is best-effort; these
tests assert it is invoked with the right attribution, not that it persists."""
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ["SCRAPER_INGEST_SECRET"] = "test-ingest-secret"

import uuid
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

import routers.internal as internal
from auth.internal_auth import require_ingest_auth
from db import get_db
from redis_client import get_redis
from main import app


def test_ingest_records_scrape_cost_for_new_snapshot():
    app.dependency_overrides[require_ingest_auth] = lambda: None
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()

    internal._excluded_domains = AsyncMock(return_value=set())
    internal._write_audit = AsyncMock()
    internal._resolve_competitor_url_id = AsyncMock(return_value=uuid.uuid4())
    j = uuid.uuid4()
    internal._bulk_upsert_snapshots = AsyncMock(return_value={j: uuid.uuid4()})
    internal.dispatch_on_snapshot = AsyncMock()
    internal.generate_cycle_signals = AsyncMock()
    cost = AsyncMock()
    internal.record_scrape_cost = cost

    m1, m2 = str(uuid.uuid4()), str(uuid.uuid4())
    item = {
        "domain": "shop.com", "url_path": "/p", "price": 9, "in_stock": True,
        "job_uuid": str(j), "proxy_tier": "residential",
        "resp_bytes": 1_000_000, "captcha_solved": True,
        "merchant_cycle_ids": [
            {"merchant_id": m1, "cycle_id": 1},
            {"merchant_id": m2, "cycle_id": 1},
        ],
    }
    try:
        with TestClient(app) as c:
            r = c.post("/internal/price-snapshot", json=item)
        assert r.status_code == 200
        cost.assert_awaited_once()
        kw = cost.await_args.kwargs
        a = cost.await_args.args
        # signature: record_scrape_cost(session, redis, merchant_ids, proxy_tier, resp_bytes, captcha_solved, *, domain=...)
        assert sorted(str(x) for x in a[2]) == sorted([m1, m2])
        assert a[3] == "residential"
        assert a[4] == 1_000_000
        assert a[5] is True
        assert kw.get("domain") == "shop.com"
    finally:
        app.dependency_overrides.clear()


def test_ingest_skips_cost_for_retried_snapshot():
    app.dependency_overrides[require_ingest_auth] = lambda: None
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()

    internal._excluded_domains = AsyncMock(return_value=set())
    internal._write_audit = AsyncMock()
    internal._resolve_competitor_url_id = AsyncMock(return_value=uuid.uuid4())
    # Empty map → the snapshot already existed (retry), so no new snapshot.
    internal._bulk_upsert_snapshots = AsyncMock(return_value={})
    internal.dispatch_on_snapshot = AsyncMock()
    internal.generate_cycle_signals = AsyncMock()
    cost = AsyncMock()
    internal.record_scrape_cost = cost

    item = {
        "domain": "shop.com", "url_path": "/p", "price": 9, "in_stock": True,
        "job_uuid": str(uuid.uuid4()), "proxy_tier": "datacenter",
    }
    try:
        with TestClient(app) as c:
            r = c.post("/internal/price-snapshot", json=item)
        assert r.status_code == 200
        assert r.json()["inserted"] == 0
        cost.assert_not_awaited()   # retried fetch incurs no new cost here
    finally:
        app.dependency_overrides.clear()


def test_scrape_failed_records_scrape_cost():
    app.dependency_overrides[require_ingest_auth] = lambda: None
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()

    internal._write_audit = AsyncMock()
    internal.generate_cycle_signals = AsyncMock()
    cost = AsyncMock()
    internal.record_scrape_cost = cost

    m1 = str(uuid.uuid4())
    body = {
        "domain": "d.com", "url_path": "/p", "error": "403 banned",
        "proxy_tier": "residential", "resp_bytes": 4_096, "captcha_solved": False,
        "merchant_cycle_ids": [{"merchant_id": m1, "cycle_id": 7}],
    }
    try:
        with TestClient(app) as c:
            r = c.post("/internal/scrape-failed", json=body)
        assert r.status_code == 200
        cost.assert_awaited_once()
        a = cost.await_args.args
        assert [str(x) for x in a[2]] == [m1]
        assert a[3] == "residential"
        assert a[4] == 4_096
    finally:
        app.dependency_overrides.clear()

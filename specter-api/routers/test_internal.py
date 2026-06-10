import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ["SCRAPER_INGEST_SECRET"] = "test-ingest-secret"

import hashlib
import hmac
import json
import time
import uuid
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

import routers.internal as internal
from auth.internal_auth import require_ingest_auth
from db import get_db
from redis_client import get_redis
from main import app


def _signed(client: TestClient, path: str, payload: dict):
    body = json.dumps(payload).encode()
    ts = str(int(time.time()))
    sig = hmac.new(b"test-ingest-secret", ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    return client.post(
        path,
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Specter-Timestamp": ts,
            "X-Specter-Signature": sig,
        },
    )


def test_unsigned_request_rejected():
    with TestClient(app) as c:
        r = c.post("/internal/price-snapshot", json={"domain": "x", "url_path": "/p", "price": 1, "in_stock": True})
    assert r.status_code == 401
    assert r.json()["detail"]["error"] == "invalid_ingest_signature"


def test_valid_signature_accepted_real_hmac():
    # Real HMAC passes auth; helpers patched so no DB/redis is touched.
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()
    internal._excluded_domains = AsyncMock(return_value=set())
    internal._write_audit = AsyncMock()
    internal._resolve_competitor_url_id = AsyncMock(return_value=uuid.uuid4())
    internal._upsert_snapshot = AsyncMock(return_value=uuid.uuid4())
    internal.dispatch_on_snapshot = AsyncMock()
    internal.generate_cycle_signals = AsyncMock()
    try:
        with TestClient(app) as c:
            r = _signed(c, "/internal/price-snapshot", {
                "domain": "shop.example.com", "url_path": "/p/1",
                "price": 19.99, "in_stock": True,
            })
        assert r.status_code == 200
        assert r.json()["inserted"] == 1
    finally:
        app.dependency_overrides.clear()


def test_batch_dedupes_on_job_uuid_and_skips_side_effects():
    app.dependency_overrides[require_ingest_auth] = lambda: None
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()

    internal._excluded_domains = AsyncMock(return_value=set())
    internal._write_audit = AsyncMock()
    internal._resolve_competitor_url_id = AsyncMock(return_value=uuid.uuid4())
    job = str(uuid.uuid4())
    snap_id = uuid.uuid4()
    # The bulk insert dedupes within the batch + against existing rows: a single
    # job_uuid survives once (maps to one snap id) no matter how often it repeats.
    bulk = AsyncMock(return_value={uuid.UUID(job): snap_id})
    internal._bulk_upsert_snapshots = bulk
    internal.dispatch_on_snapshot = AsyncMock()
    internal.generate_cycle_signals = AsyncMock()

    item = {"domain": "d.com", "url_path": "/p", "price": 5, "in_stock": True, "job_uuid": job}
    try:
        with TestClient(app) as c:
            r = _signed(c, "/internal/price-snapshot:batch", {"items": [item, item]})
        assert r.status_code == 200
        body = r.json()
        assert body == {"inserted": 1, "received": 2, "cycles_fired": 0}
        # The duplicate must NOT re-run OOS detection.
        assert internal.dispatch_on_snapshot.await_count == 1
        # Intra-batch dedup → the bulk insert receives exactly ONE unique row.
        assert bulk.await_count == 1
        assert len(bulk.await_args.args[1]) == 1
    finally:
        app.dependency_overrides.clear()


def test_batch_bulk_inserts_distinct_items_in_one_statement():
    app.dependency_overrides[require_ingest_auth] = lambda: None
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()

    internal._excluded_domains = AsyncMock(return_value=set())
    internal._write_audit = AsyncMock()
    internal._resolve_competitor_url_id = AsyncMock(side_effect=lambda *a, **k: uuid.uuid4())
    j1, j2, j3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    bulk = AsyncMock(return_value={j1: uuid.uuid4(), j2: uuid.uuid4(), j3: uuid.uuid4()})
    internal._bulk_upsert_snapshots = bulk
    internal.dispatch_on_snapshot = AsyncMock()
    internal.generate_cycle_signals = AsyncMock()

    items = [
        {"domain": "d.com", "url_path": f"/p{i}", "price": 5 + i, "in_stock": True, "job_uuid": str(j)}
        for i, j in enumerate((j1, j2, j3))
    ]
    try:
        with TestClient(app) as c:
            r = _signed(c, "/internal/price-snapshot:batch", {"items": items})
        assert r.status_code == 200
        assert r.json() == {"inserted": 3, "received": 3, "cycles_fired": 0}
        # All three rows go through a SINGLE bulk-insert call (not three per-row inserts).
        assert bulk.await_count == 1
        assert len(bulk.await_args.args[1]) == 3
        assert internal.dispatch_on_snapshot.await_count == 3
    finally:
        app.dependency_overrides.clear()


def test_scrape_failed_advances_cycle(monkeypatch):
    app.dependency_overrides[require_ingest_auth] = lambda: None
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()

    rec = MagicMock(return_value=False)
    monkeypatch.setattr(internal.cycle_coordinator, "record_scrape", rec)
    internal._write_audit = AsyncMock()
    internal.generate_cycle_signals = AsyncMock()

    merchant_id = str(uuid.uuid4())
    try:
        with TestClient(app) as c:
            r = _signed(c, "/internal/scrape-failed", {
                "domain": "d.com", "url_path": "/p", "error": "403 banned",
                "merchant_cycle_ids": [{"merchant_id": merchant_id, "cycle_id": 42}],
            })
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # A failed URL still advances the cycle counter.
        assert rec.call_count == 1
        assert rec.call_args.args[2] == merchant_id   # (store, enqueue, merchant_id, ...)
        assert rec.call_args.args[3] == 42
    finally:
        app.dependency_overrides.clear()


def test_excluded_domain_short_circuits_with_audit():
    app.dependency_overrides[require_ingest_auth] = lambda: None
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()

    # blocked.com is on the kill-switch list; allowed.com is not.
    internal._excluded_domains = AsyncMock(return_value={"blocked.com"})
    audit = AsyncMock()
    internal._write_audit = audit
    internal._resolve_competitor_url_id = AsyncMock(return_value=uuid.uuid4())
    j = uuid.uuid4()
    internal._bulk_upsert_snapshots = AsyncMock(return_value={j: uuid.uuid4()})
    internal.dispatch_on_snapshot = AsyncMock()
    internal.generate_cycle_signals = AsyncMock()

    items = [
        {"domain": "blocked.com", "url_path": "/p", "price": 9, "in_stock": True, "job_uuid": str(uuid.uuid4())},
        {"domain": "allowed.com", "url_path": "/p", "price": 9, "in_stock": True, "job_uuid": str(j)},
    ]
    try:
        with TestClient(app) as c:
            r = _signed(c, "/internal/price-snapshot:batch", {"items": items})
        assert r.status_code == 200
        # Only the allowed domain is inserted; the excluded one is dropped.
        assert r.json() == {"inserted": 1, "received": 2, "cycles_fired": 0}
        # The excluded item never reaches the bulk insert (resolved set excludes it).
        assert len(internal._bulk_upsert_snapshots.await_args.args[1]) == 1
        # No OOS/signal side-effects for the excluded domain.
        assert internal.dispatch_on_snapshot.await_count == 1
        # An audit row was written for the exclusion (status="excluded").
        statuses = [c.args[2] for c in audit.await_args_list]
        assert "excluded" in statuses
    finally:
        app.dependency_overrides.clear()

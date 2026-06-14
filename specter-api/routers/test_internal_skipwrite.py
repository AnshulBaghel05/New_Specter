"""Skip-write optimization: an unchanged snapshot is not re-inserted, but its
cycle still advances and its fetch cost is still recorded (no signal stall, no
lost cost). Off by default — exercised here with SNAPSHOT_SKIP_UNCHANGED on.
"""
import os
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

from fastapi.testclient import TestClient  # noqa: E402

from auth.internal_auth import require_ingest_auth  # noqa: E402
from db import get_db  # noqa: E402
from main import app  # noqa: E402
from redis_client import get_redis  # noqa: E402
from routers import internal  # noqa: E402


def test_unchanged_snapshot_skipped_but_cycle_and_cost_preserved(monkeypatch):
    monkeypatch.setenv("SNAPSHOT_SKIP_UNCHANGED", "true")
    app.dependency_overrides[require_ingest_auth] = lambda: None
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()

    cu1, cu2 = uuid.uuid4(), uuid.uuid4()
    j2 = uuid.uuid4()
    monkeypatch.setattr(internal, "_excluded_domains", AsyncMock(return_value=set()))
    monkeypatch.setattr(internal, "_write_audit", AsyncMock())
    monkeypatch.setattr(internal, "_resolve_competitor_url_id", AsyncMock(side_effect=[cu1, cu2]))
    # cu1's last stored value matches item 1 (unchanged); cu2 has no prior value.
    monkeypatch.setattr(internal, "_last_values", AsyncMock(return_value={cu1: (Decimal("9"), True)}))
    bulk = AsyncMock(return_value={j2: uuid.uuid4()})
    monkeypatch.setattr(internal, "_bulk_upsert_snapshots", bulk)
    monkeypatch.setattr(internal, "dispatch_on_snapshot", AsyncMock())
    monkeypatch.setattr(internal, "generate_cycle_signals", AsyncMock())
    monkeypatch.setattr(internal, "record_scrape_cost", AsyncMock())
    rec = MagicMock(return_value=False)
    monkeypatch.setattr(internal.cycle_coordinator, "record_scrape", rec)

    m1 = str(uuid.uuid4())
    items = [
        {"domain": "a.com", "url_path": "/p", "price": 9, "in_stock": True,
         "job_uuid": str(uuid.uuid4()), "merchant_cycle_ids": [{"merchant_id": m1, "cycle_id": 1}]},  # unchanged
        {"domain": "b.com", "url_path": "/p", "price": 5, "in_stock": True,
         "job_uuid": str(j2), "merchant_cycle_ids": [{"merchant_id": m1, "cycle_id": 2}]},            # new
    ]
    try:
        with TestClient(app) as c:
            r = c.post("/internal/price-snapshot:batch", json={"items": items})
        assert r.status_code == 200
        # Only the changed item is inserted.
        assert r.json()["inserted"] == 1
        assert len(bulk.await_args.args[1]) == 1
        # Dispatch (OOS/signal) runs only for the inserted (changed) item.
        assert internal.dispatch_on_snapshot.await_count == 1
        # BOTH items advance a cycle and record cost (the fetch happened either way).
        assert rec.call_count == 2
        assert internal.record_scrape_cost.await_count == 2
    finally:
        app.dependency_overrides.clear()

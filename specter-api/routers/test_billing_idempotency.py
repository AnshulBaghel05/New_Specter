"""L1: Razorpay webhook idempotency.

Razorpay redelivers an event (same X-Razorpay-Event-Id) until it gets a 2xx. The
endpoint must process a given event id at most once and short-circuit redeliveries.
DB is mocked via dependency override; the signature math is real stdlib HMAC.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import uuid
from unittest.mock import AsyncMock, MagicMock

# ── Env before app import (mirrors test_billing.py) ──────────────────────────
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ["ENCRYPTION_KEY"] = base64.urlsafe_b64encode(b"t" * 32).decode()
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "whsec_test_secret")

import pytest
from fastapi.testclient import TestClient

from db import get_db
from main import app
from models.merchants import Merchant
from models.processed_webhook_events import ProcessedWebhookEvent

WEBHOOK_SECRET = "whsec_test_secret"


def sign(raw: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def override_db(session):
    async def _gen():
        yield session
    return _gen


def make_merchant(plan: str = "free") -> MagicMock:
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = plan
    m.trial_ends_at = "set"
    m.read_only = False
    m.razorpay_subscription_id = None
    m.max_competitors_per_sku = 3
    m.subscription_current_end = None
    m.subscription_cancel_at = None
    return m


def _seen_result(value):
    r = MagicMock()
    r.scalar_one_or_none = MagicMock(return_value=value)
    return r


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def _post(client, body: dict, session, event_id: str | None):
    raw = json.dumps(body).encode()
    headers = {"Content-Type": "application/json", "X-Razorpay-Signature": sign(raw)}
    if event_id is not None:
        headers["X-Razorpay-Event-Id"] = event_id
    app.dependency_overrides[get_db] = override_db(session)
    return client.post("/billing/webhook", content=raw, headers=headers)


_ACTIVATION = {
    "event": "subscription.activated",
    "payload": {"subscription": {"entity": {
        "id": "sub_ABC123",
        "plan_id": "plan_recon_monthly",
        "notes": {"merchant_id": str(uuid.uuid4())},
    }}},
}


def test_duplicate_event_is_skipped(client):
    """A redelivered event id is already recorded → endpoint returns 'duplicate'
    WITHOUT touching the business logic (session.get never called)."""
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_seen_result(uuid.uuid4()))  # already seen
    session.get = AsyncMock()
    session.commit = AsyncMock()
    session.add = MagicMock()

    resp = _post(client, _ACTIVATION, session, event_id="evt_dup_1")

    assert resp.status_code == 200
    assert resp.json()["status"] == "duplicate"
    session.get.assert_not_awaited()          # business logic skipped
    session.add.assert_not_called()           # no second event row written


def test_first_delivery_processes_and_records(client):
    """A never-seen event id is processed (plan elevated) AND recorded so a later
    redelivery will be skipped."""
    merchant = make_merchant(plan="free")
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_seen_result(None))   # not seen yet
    session.get = AsyncMock(return_value=merchant)
    session.commit = AsyncMock()
    added: list = []
    session.add = MagicMock(side_effect=lambda obj: added.append(obj))

    resp = _post(client, _ACTIVATION, session, event_id="evt_new_1")

    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert merchant.plan == "recon"           # business logic ran
    # the event id was recorded for future dedup
    assert any(isinstance(o, ProcessedWebhookEvent) and o.event_id == "evt_new_1" for o in added)


def test_no_event_id_header_still_processes(client):
    """Backward-compatible: an event with no X-Razorpay-Event-Id header is processed
    as before (no dedup), so nothing regresses for events lacking the header."""
    merchant = make_merchant(plan="free")
    session = AsyncMock()
    session.get = AsyncMock(return_value=merchant)
    session.commit = AsyncMock()
    session.add = MagicMock()
    # No seen-check should run, so execute is never needed.
    session.execute = AsyncMock(side_effect=AssertionError("seen-check must not run without an event id"))

    resp = _post(client, _ACTIVATION, session, event_id=None)

    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert merchant.plan == "recon"

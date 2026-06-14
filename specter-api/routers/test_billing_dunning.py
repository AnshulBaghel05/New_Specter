"""Dunning webhook tests — failed-payment lifecycle.

subscription.halted (Razorpay exhausted payment retries) must revoke access by
dropping the merchant to free, reusing the cancellation transition. subscription.
pending (retry in progress) must NOT change the plan, so an active paying customer
mid-retry is never wrongly downgraded.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import uuid
from unittest.mock import AsyncMock, MagicMock

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ["ENCRYPTION_KEY"] = base64.urlsafe_b64encode(b"t" * 32).decode()
os.environ["RAZORPAY_WEBHOOK_SECRET"] = "whsec_test_secret"
os.environ["RAZORPAY_KEY_ID"] = "rzp_test_key"
os.environ["RAZORPAY_KEY_SECRET"] = "rzp_test_secret"
os.environ["RAZORPAY_PLAN_CIPHER_MONTHLY"] = "plan_cipher_monthly"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from db import get_db  # noqa: E402
from main import app  # noqa: E402
from models.merchants import Merchant  # noqa: E402

WEBHOOK_SECRET = "whsec_test_secret"


def _merchant(plan: str) -> MagicMock:
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = plan
    m.read_only = False
    m.razorpay_subscription_id = "sub_LIVE"
    m.max_competitors_per_sku = 5
    m.subscription_current_end = "set"
    m.subscription_cancel_at = "set"
    return m


def _override_db(session):
    async def _gen():
        yield session
    return _gen


def _sign(raw: bytes) -> str:
    return hmac.new(WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _post(client, body, session=None):
    raw = json.dumps(body).encode()
    headers = {"Content-Type": "application/json", "X-Razorpay-Signature": _sign(raw)}
    if session is not None:
        app.dependency_overrides[get_db] = _override_db(session)
    return client.post("/billing/webhook", content=raw, headers=headers)


def test_halted_revokes_access_to_free(client):
    merchant = _merchant(plan="cipher")
    empty = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
    session = AsyncMock()
    session.get = AsyncMock(return_value=merchant)
    session.execute = AsyncMock(side_effect=[empty, empty, MagicMock()])
    session.commit = AsyncMock()

    body = {
        "event": "subscription.halted",
        "payload": {"subscription": {"entity": {
            "id": "sub_LIVE",
            "plan_id": "plan_cipher_monthly",
            "notes": {"merchant_id": str(merchant.id)},
        }}},
    }
    resp = _post(client, body, session=session)
    assert resp.status_code == 200
    assert merchant.plan == "free"
    assert merchant.razorpay_subscription_id is None


def test_pending_keeps_active_plan(client):
    """Payment retry in progress — access preserved, no plan change."""
    merchant = _merchant(plan="cipher")
    session = AsyncMock()
    session.get = AsyncMock(return_value=merchant)
    session.commit = AsyncMock()

    body = {
        "event": "subscription.pending",
        "payload": {"subscription": {"entity": {
            "id": "sub_LIVE",
            "plan_id": "plan_cipher_monthly",
            "notes": {"merchant_id": str(merchant.id)},
        }}},
    }
    resp = _post(client, body, session=session)
    assert resp.status_code == 200
    assert merchant.plan == "cipher"            # unchanged
    assert merchant.razorpay_subscription_id == "sub_LIVE"
    session.commit.assert_not_awaited()

"""
Tests for Razorpay billing & subscriptions (Prompt 15).

Run: pytest routers/test_billing.py -v

Covers:
  - webhook HMAC signature verification (valid, tampered, missing) — pure + endpoint
  - simulated subscription.activated webhook → merchants.plan updated in DB
  - plan downgrade → SKUs above new limit active=false; all add-ons deleted
  - add-on cap enforcement (4th add-on rejected with addon_limit_reached)
  - add-on duplicate + plan-eligibility rejections

DB/Razorpay are replaced with mocks; the signature math is real stdlib HMAC.
Env is set before any app import.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

# ── Env before app imports ───────────────────────────────────────────────────
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ["ENCRYPTION_KEY"] = base64.urlsafe_b64encode(b"t" * 32).decode()
os.environ["RAZORPAY_WEBHOOK_SECRET"] = "whsec_test_secret"
os.environ["RAZORPAY_KEY_ID"] = "rzp_test_key"
os.environ["RAZORPAY_KEY_SECRET"] = "rzp_test_secret"
os.environ["RAZORPAY_PLAN_RECON_MONTHLY"] = "plan_recon_monthly"
os.environ["RAZORPAY_PLAN_RECON_ANNUAL"] = "plan_recon_annual"
os.environ["RAZORPAY_PLAN_CIPHER_MONTHLY"] = "plan_cipher_monthly"
os.environ["RAZORPAY_PLAN_ADDON_50SKU"] = "plan_addon_50"
os.environ["RAZORPAY_PLAN_ADDON_100SKU"] = "plan_addon_100"
os.environ["RAZORPAY_PLAN_ADDON_SPEED_RECON"] = "plan_addon_speed_recon"

import pytest
from fastapi.testclient import TestClient

from auth.supabase import get_current_merchant
from db import get_db
from main import app
from models.merchant_addons import MerchantAddon
from models.merchants import Merchant
from models.skus import SKU
from services import billing

WEBHOOK_SECRET = "whsec_test_secret"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_merchant(plan: str = "recon") -> MagicMock:
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


def override_merchant(merchant):
    async def _dep():
        return merchant
    return _dep


def override_db(session):
    async def _gen():
        yield session
    return _gen


def sign(raw: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


# ════════════════════════════════════════════════════════════════════════════
# 1. WEBHOOK SIGNATURE VERIFICATION (pure)
# ════════════════════════════════════════════════════════════════════════════

class TestSignaturePure:
    def test_valid_signature_passes(self):
        raw = b'{"event":"subscription.charged"}'
        assert billing.verify_webhook_signature(raw, sign(raw), WEBHOOK_SECRET) is True

    def test_tampered_payload_fails(self):
        raw = b'{"event":"subscription.charged"}'
        sig = sign(raw)
        assert billing.verify_webhook_signature(raw + b"x", sig, WEBHOOK_SECRET) is False

    def test_tampered_signature_fails(self):
        raw = b'{"event":"subscription.charged"}'
        assert billing.verify_webhook_signature(raw, "deadbeef", WEBHOOK_SECRET) is False

    def test_missing_secret_or_signature_fails(self):
        raw = b"{}"
        assert billing.verify_webhook_signature(raw, "", WEBHOOK_SECRET) is False
        assert billing.verify_webhook_signature(raw, sign(raw), "") is False

    def test_plan_id_round_trip(self):
        assert billing.plan_id_for("recon", "monthly") == "plan_recon_monthly"
        assert billing.plan_id_for("recon", "annual") == "plan_recon_annual"
        assert billing.plan_from_plan_id("plan_recon_monthly") == "recon"
        assert billing.plan_from_plan_id("plan_addon_50") is None  # add-on, not a base plan


# ════════════════════════════════════════════════════════════════════════════
# 2. WEBHOOK ENDPOINT
# ════════════════════════════════════════════════════════════════════════════

class TestWebhookEndpoint:
    def _post(self, client, body: dict, *, secret=WEBHOOK_SECRET, session=None, header=True):
        raw = json.dumps(body).encode()
        headers = {"Content-Type": "application/json"}
        if header:
            headers["X-Razorpay-Signature"] = sign(raw, secret)
        if session is not None:
            app.dependency_overrides[get_db] = override_db(session)
        return client.post("/billing/webhook", content=raw, headers=headers)

    def test_unsigned_request_rejected_400(self, client):
        resp = self._post(client, {"event": "subscription.charged"}, header=False)
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "invalid_signature"

    def test_tampered_signature_rejected_400(self, client):
        resp = self._post(client, {"event": "subscription.charged"}, secret="wrong_secret")
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "invalid_signature"

    def test_activation_updates_plan_in_db(self, client):
        """Simulated subscription.activated → merchants.plan elevated to recon."""
        merchant = make_merchant(plan="free")
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.commit = AsyncMock()

        body = {
            "event": "subscription.activated",
            "payload": {"subscription": {"entity": {
                "id": "sub_ABC123",
                "plan_id": "plan_recon_monthly",
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)

        assert resp.status_code == 200
        assert merchant.plan == "recon"
        assert merchant.razorpay_subscription_id == "sub_ABC123"
        assert merchant.trial_ends_at is None
        assert merchant.read_only is False
        assert merchant.max_competitors_per_sku == 3  # recon competitor limit
        session.commit.assert_awaited()

    def test_charged_for_addon_plan_id_does_not_change_plan(self, client):
        """An add-on subscription event must not alter the base plan."""
        merchant = make_merchant(plan="recon")
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.commit = AsyncMock()

        body = {
            "event": "subscription.charged",
            "payload": {"subscription": {"entity": {
                "id": "sub_addon",
                "plan_id": "plan_addon_50",   # add-on, not a base plan
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)
        assert resp.status_code == 200
        assert merchant.plan == "recon"          # unchanged
        session.commit.assert_not_awaited()

    def test_cancelled_drops_plan_to_free(self, client):
        """subscription.cancelled for a base plan → merchant falls to free."""
        merchant = make_merchant(plan="cipher")
        merchant.razorpay_subscription_id = "sub_LIVE"
        # apply_downgrade does 3 executes: select SKUs, select add-ons, delete add-ons.
        empty = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.execute = AsyncMock(side_effect=[empty, empty, MagicMock()])
        session.commit = AsyncMock()

        body = {
            "event": "subscription.cancelled",
            "payload": {"subscription": {"entity": {
                "id": "sub_LIVE",
                "plan_id": "plan_cipher_monthly",
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)

        assert resp.status_code == 200
        assert merchant.plan == "free"
        assert merchant.razorpay_subscription_id is None
        assert merchant.subscription_cancel_at is None
        assert merchant.subscription_current_end is None

    def test_cancelled_for_addon_plan_id_is_ignored(self, client):
        """An add-on subscription.cancelled must NOT change the base plan."""
        merchant = make_merchant(plan="cipher")
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.commit = AsyncMock()
        body = {
            "event": "subscription.cancelled",
            "payload": {"subscription": {"entity": {
                "id": "sub_addon", "plan_id": "plan_addon_50",
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)
        assert resp.status_code == 200
        assert merchant.plan == "cipher"  # unchanged

    def test_cancelled_for_already_free_merchant_is_noop(self, client):
        """Redelivered subscription.cancelled on a free merchant changes nothing
        and never touches apply_downgrade (no session.execute)."""
        merchant = make_merchant(plan="free")
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        body = {
            "event": "subscription.cancelled",
            "payload": {"subscription": {"entity": {
                "id": "sub_LIVE", "plan_id": "plan_cipher_monthly",
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)
        assert resp.status_code == 200
        assert merchant.plan == "free"
        session.execute.assert_not_called()

    def test_cancelled_for_superseded_subscription_is_ignored(self, client):
        """After an upgrade, the OLD plan's subscription.cancelled must NOT drop a
        merchant who now sits on a newer subscription. Resolves to the same
        merchant (shared notes) but the id no longer matches the current sub."""
        merchant = make_merchant(plan="cipher")
        merchant.razorpay_subscription_id = "sub_NEW"
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        body = {
            "event": "subscription.cancelled",
            "payload": {"subscription": {"entity": {
                "id": "sub_OLD", "plan_id": "plan_recon_monthly",
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)
        assert resp.status_code == 200
        assert merchant.plan == "cipher"  # unchanged
        assert merchant.razorpay_subscription_id == "sub_NEW"  # untouched
        session.execute.assert_not_called()

    def test_activation_stamps_current_end(self, client):
        merchant = make_merchant(plan="free")
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.commit = AsyncMock()
        body = {
            "event": "subscription.activated",
            "payload": {"subscription": {"entity": {
                "id": "sub_A", "plan_id": "plan_recon_monthly",
                "current_end": 1783036800,  # 2026-07-13T00:00:00Z
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)
        assert resp.status_code == 200
        assert merchant.subscription_current_end is not None
        assert merchant.subscription_current_end.year == 2026


# ════════════════════════════════════════════════════════════════════════════
# 2b. SUBSCRIBE / UPGRADE
# ════════════════════════════════════════════════════════════════════════════

class TestSubscribe:
    def test_subscribe_creates_razorpay_subscription(self, client):
        merchant = make_merchant(plan="free")
        session = AsyncMock()
        session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        with patch("services.billing.create_subscription",
                   new=AsyncMock(return_value={"id": "sub_R1", "status": "created", "short_url": "https://rzp/x"})):
            resp = client.post("/billing/subscribe", json={"plan": "recon", "cadence": "annual"})

        assert resp.status_code == 200
        assert resp.json()["subscription_id"] == "sub_R1"
        assert merchant.razorpay_subscription_id == "sub_R1"

    def test_subscribe_rejects_eclipse(self, client):
        merchant = make_merchant(plan="free")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(AsyncMock())
        resp = client.post("/billing/subscribe", json={"plan": "eclipse"})
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "plan_not_self_serve"

    def test_subscribe_rejects_bad_cadence(self, client):
        merchant = make_merchant(plan="free")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(AsyncMock())
        resp = client.post("/billing/subscribe", json={"plan": "recon", "cadence": "weekly"})
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "invalid_cadence"

    def test_upgrade_rejects_same_or_lower_plan(self, client):
        merchant = make_merchant(plan="cipher")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(AsyncMock())
        resp = client.post("/billing/upgrade", json={"plan": "recon"})
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "not_an_upgrade"

    def test_upgrade_cancels_previous_subscription(self, client):
        """recon→cipher creates a new sub AND cancels the old one so the customer
        isn't double-billed; the merchant points at the new sub."""
        merchant = make_merchant(plan="recon")
        merchant.razorpay_subscription_id = "sub_OLD"
        session = AsyncMock()
        session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        with patch("services.billing.create_subscription",
                   new=AsyncMock(return_value={"id": "sub_NEW", "status": "created", "short_url": "https://rzp/y"})), \
             patch("services.billing.cancel_subscription", new=AsyncMock(return_value=True)) as cancel:
            resp = client.post("/billing/upgrade", json={"plan": "cipher"})

        assert resp.status_code == 200
        assert resp.json()["subscription_id"] == "sub_NEW"
        assert merchant.razorpay_subscription_id == "sub_NEW"
        cancel.assert_awaited_once_with("sub_OLD")


# ════════════════════════════════════════════════════════════════════════════
# 3. DOWNGRADE (immediate)
# ════════════════════════════════════════════════════════════════════════════

class TestDowngrade:
    def test_downgrade_pauses_excess_skus_and_drops_addons(self, client):
        """recon → free: every active SKU paused (limit 0); all add-ons deleted."""
        merchant = make_merchant(plan="recon")

        sku1, sku2 = MagicMock(spec=SKU), MagicMock(spec=SKU)
        sku1.active = sku2.active = True
        addon = MagicMock(spec=MerchantAddon)
        addon.razorpay_subscription_id = "sub_addon_1"

        skus_result = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[sku1, sku2]))))
        addons_result = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[addon]))))
        delete_result = MagicMock()

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[skus_result, addons_result, delete_result])
        session.commit = AsyncMock()

        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        with patch("services.billing.cancel_subscription", new=AsyncMock(return_value=True)) as cancel:
            resp = client.post("/billing/downgrade", json={"plan": "free"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["plan"] == "free"
        assert body["skus_paused"] == 2
        assert body["addons_removed"] == 1
        assert sku1.active is False and sku2.active is False
        assert merchant.plan == "free"
        assert merchant.max_competitors_per_sku == 0
        cancel.assert_awaited_once_with("sub_addon_1")
        # 3 executes: select SKUs, select add-ons, delete add-ons.
        assert session.execute.await_count == 3

    def test_rejects_non_downgrade(self, client):
        merchant = make_merchant(plan="recon")
        session = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.post("/billing/downgrade", json={"plan": "cipher"})  # higher, not a downgrade
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "not_a_downgrade"


# ════════════════════════════════════════════════════════════════════════════
# 4. ADD-ON MANAGEMENT
# ════════════════════════════════════════════════════════════════════════════

class TestAddons:
    def _count_session(self, count: int, dup=None) -> AsyncMock:
        session = AsyncMock()
        count_result = MagicMock(scalar_one=MagicMock(return_value=count))
        dup_result = MagicMock(scalar_one_or_none=MagicMock(return_value=dup))
        session.execute = AsyncMock(side_effect=[count_result, dup_result])
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.add = MagicMock()
        return session

    def test_fourth_addon_rejected(self, client):
        """At the 3-add-on cap, a 4th is rejected with addon_limit_reached."""
        merchant = make_merchant(plan="cipher")
        session = AsyncMock()
        session.execute = AsyncMock(return_value=MagicMock(scalar_one=MagicMock(return_value=3)))
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.post("/billing/addon", json={"addon_type": "sku_50"})
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "addon_limit_reached"

    def test_duplicate_addon_type_rejected(self, client):
        merchant = make_merchant(plan="cipher")
        existing = MagicMock(spec=MerchantAddon)
        session = self._count_session(count=1, dup=existing)
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.post("/billing/addon", json={"addon_type": "sku_50"})
        assert resp.status_code == 409
        assert resp.json()["detail"]["error"] == "addon_already_active"

    def test_speed_addon_rejected_on_wrong_plan(self, client):
        """speed_recon is RECON-only — rejected on CIPHER before any DB work."""
        merchant = make_merchant(plan="cipher")
        session = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.post("/billing/addon", json={"addon_type": "speed_recon"})
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "addon_not_available_on_plan"

    def test_addon_created_when_under_cap(self, client):
        """Under the cap + no duplicate → 201 and a Razorpay subscription is created."""
        merchant = make_merchant(plan="cipher")
        new_id = uuid.uuid4()
        session = self._count_session(count=1, dup=None)

        async def flush_side_effect():
            for call in session.add.call_args_list:
                obj = call.args[0] if call.args else None
                if isinstance(obj, MerchantAddon) and obj.id is None:
                    obj.id = new_id
        session.flush.side_effect = flush_side_effect

        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        with patch("services.billing.create_subscription",
                   new=AsyncMock(return_value={"id": "sub_new_addon"})):
            resp = client.post("/billing/addon", json={"addon_type": "sku_100"})

        assert resp.status_code == 201
        body = resp.json()
        assert body["addon_type"] == "sku_100"
        assert body["razorpay_subscription_id"] == "sub_new_addon"
        session.commit.assert_awaited()


# ════════════════════════════════════════════════════════════════════════════
# 5. CANCEL AT PERIOD END
# ════════════════════════════════════════════════════════════════════════════

class TestCancel:
    def test_cancel_marks_period_end_and_calls_razorpay(self, client):
        """POST /billing/cancel → Razorpay cancel(cancel_at_cycle_end=True),
        stamps subscription_cancel_at from the known renewal date."""
        from datetime import datetime, timezone
        merchant = make_merchant(plan="cipher")
        merchant.razorpay_subscription_id = "sub_LIVE"
        merchant.subscription_current_end = datetime(2026, 7, 10, tzinfo=timezone.utc)
        session = AsyncMock()
        session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        with patch("services.billing.cancel_subscription",
                   new=AsyncMock(return_value=True)) as cancel:
            resp = client.post("/billing/cancel")

        assert resp.status_code == 200
        assert resp.json()["cancel_at"] == "2026-07-10T00:00:00+00:00"
        assert merchant.subscription_cancel_at == merchant.subscription_current_end
        cancel.assert_awaited_once_with("sub_LIVE", cancel_at_cycle_end=True)
        session.commit.assert_awaited()

    def test_cancel_without_subscription_returns_400(self, client):
        merchant = make_merchant(plan="free")
        merchant.razorpay_subscription_id = None
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(AsyncMock())
        resp = client.post("/billing/cancel")
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "no_active_subscription"

    def test_cancel_is_idempotent_if_already_scheduled(self, client):
        """A second cancel when one is already scheduled returns the existing
        date without calling Razorpay again."""
        from datetime import datetime, timezone
        merchant = make_merchant(plan="cipher")
        merchant.razorpay_subscription_id = "sub_LIVE"
        merchant.subscription_cancel_at = datetime(2026, 7, 10, tzinfo=timezone.utc)
        session = AsyncMock()
        session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        with patch("services.billing.cancel_subscription", new=AsyncMock(return_value=True)) as cancel:
            resp = client.post("/billing/cancel")

        assert resp.status_code == 200
        assert resp.json()["cancel_at"] == "2026-07-10T00:00:00+00:00"
        cancel.assert_not_awaited()


# ════════════════════════════════════════════════════════════════════════════
# 6. LIST ADD-ONS
# ════════════════════════════════════════════════════════════════════════════

class TestListAddons:
    def test_list_returns_merchant_addons(self, client):
        import uuid as _uuid
        merchant = make_merchant(plan="cipher")
        row = MagicMock(spec=MerchantAddon)
        row.id = _uuid.uuid4()
        row.addon_type = "sku_50"
        row.razorpay_subscription_id = "sub_addon_x"
        result = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[row]))))
        session = AsyncMock()
        session.execute = AsyncMock(return_value=result)
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.get("/billing/addons")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["addon_type"] == "sku_50"
        assert body[0]["razorpay_subscription_id"] == "sub_addon_x"

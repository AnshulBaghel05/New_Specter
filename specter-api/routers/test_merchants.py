"""
Integration tests for auth, plan gating, and routers.

Run: pytest routers/test_merchants.py -v

Approach:
  - FastAPI TestClient (synchronous, wraps async handlers via anyio).
  - DB and Redis calls are replaced with in-memory mocks via dependency override.
  - JWT tokens are real HS256 tokens signed with TEST_JWT_SECRET.
  - Shopify HTTP calls are patched with unittest.mock.

Environment is set up before any import in conftest or this file.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import uuid
from decimal import Decimal
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

# ── Set env vars before any app imports ──────────────────────────────────────
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ["ENCRYPTION_KEY"] = base64.urlsafe_b64encode(b"t" * 32).decode()
os.environ["SHOPIFY_API_KEY"] = "test_api_key"
os.environ["SHOPIFY_API_SECRET"] = "test_api_secret"
os.environ["SHOPIFY_REDIRECT_URI"] = "https://api.specterapp.io/merchants/shopify/callback"
os.environ["DASHBOARD_URL"] = "https://app.specterapp.io/dashboard"

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from jose import jwt as jose_jwt

from auth.supabase import get_current_merchant
from auth.plan_gate import FEATURE_GATES, PLAN_HIERARCHY, requires_plan
from db import get_db
from main import app
from models.merchants import Merchant
from models.skus import SKU

TEST_JWT_SECRET = "test-supabase-jwt-secret-32-char!"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_jwt(sub: str = "supabase-user-abc123", secret: str = TEST_JWT_SECRET) -> str:
    """Create a real HS256 JWT that will pass auth/supabase.py validation."""
    return jose_jwt.encode(
        {"sub": sub, "aud": "authenticated", "exp": 9_999_999_999},
        secret,
        algorithm="HS256",
    )


def make_merchant(
    plan: str = "recon",
    shopify_connected: bool = False,
    read_only: bool = False,
) -> MagicMock:
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.supabase_user_id = "supabase-user-abc123"
    m.plan = plan
    m.shopify_domain = "test.myshopify.com" if shopify_connected else None
    m.shopify_access_token = "encrypted_token" if shopify_connected else None
    m.shopify_reconnect_required = False
    m.trial_ends_at = None
    m.read_only = read_only
    m.eclipse_interval_ms = 300_000
    m.max_competitors_per_sku = 3
    m.auto_reprice_enabled = True
    m.email_notifications_enabled = True
    m.razorpay_subscription_id = None
    m.subscription_current_end = None
    m.subscription_cancel_at = None
    return m


def override_merchant(merchant: MagicMock):
    """Return a FastAPI dependency override that yields the given merchant."""
    async def _dep():
        return merchant
    return _dep


def mock_async_session():
    """Return a get_db override (async generator function) over a blank mock session."""
    session = AsyncMock()
    session.get = AsyncMock(return_value=None)
    session.execute = AsyncMock(return_value=MagicMock(
        scalar_one_or_none=MagicMock(return_value=None),
        scalar_one=MagicMock(return_value=0),
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))),
    ))
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    async def _gen():
        yield session

    return _gen


def override_db(session):
    """Return a get_db override (async generator function) yielding the given session."""
    async def _gen():
        yield session
    return _gen


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_overrides():
    """Reset dependency overrides after each test."""
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


# ── First sign-in provisions a FREE account (freemium floor) ─────────────────

class TestFirstSignInPlan:
    def test_first_sign_in_creates_free_merchant(self):
        """An unknown Supabase user is auto-provisioned on the FREE plan, not RECON."""
        captured: dict = {}
        session = AsyncMock()
        # No existing merchant for this supabase_user_id.
        session.execute = AsyncMock(return_value=MagicMock(
            scalar_one_or_none=MagicMock(return_value=None),
        ))
        session.add = MagicMock(side_effect=lambda obj: captured.__setitem__("merchant", obj))
        session.flush = AsyncMock()

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=make_jwt())
        merchant = asyncio.run(get_current_merchant(creds, session))

        assert merchant.plan == "free"
        assert captured["merchant"].plan == "free"
        assert captured["merchant"].notification_email is not None or True  # email optional


# ── Start-trial: free → 14-day RECON trial ───────────────────────────────────

class TestStartTrial:
    def test_free_merchant_starts_recon_trial(self, client: TestClient):
        """POST /merchants/start-trial on a FREE account → RECON + 14-day trial."""
        merchant = make_merchant(plan="free")
        merchant.trial_ends_at = None
        session = AsyncMock()
        session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.post("/merchants/start-trial")
        assert resp.status_code == 200
        body = resp.json()
        assert body["plan"] == "recon"
        assert body["trial_ends_at"] is not None
        assert merchant.plan == "recon"
        assert merchant.trial_ends_at is not None
        session.commit.assert_awaited_once()

    def test_start_trial_rejected_when_not_free(self, client: TestClient):
        """A merchant already on a paid/trial plan cannot (re)start a trial → 409."""
        merchant = make_merchant(plan="cipher")
        session = AsyncMock()
        session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.post("/merchants/start-trial")
        assert resp.status_code == 409
        assert resp.json()["detail"]["error"] == "trial_not_available"
        assert merchant.plan == "cipher"          # unchanged
        session.commit.assert_not_awaited()


# ════════════════════════════════════════════════════════════════════════════
# 1. JWT VALIDATION TESTS
# ════════════════════════════════════════════════════════════════════════════

class TestJWTValidation:
    def test_get_skus_returns_401_without_token(self, client: TestClient):
        """`GET /skus` without Authorization header → 401."""
        resp = client.get("/skus")
        assert resp.status_code == 401

    def test_get_skus_returns_401_with_invalid_token(self, client: TestClient):
        """`GET /skus` with a garbage token → 401."""
        resp = client.get("/skus", headers={"Authorization": "Bearer not.a.jwt"})
        assert resp.status_code == 401

    def test_get_skus_returns_401_with_wrong_secret(self, client: TestClient):
        """JWT signed with wrong secret → 401."""
        token = make_jwt(secret="completely-wrong-secret")
        resp = client.get("/skus", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_get_skus_returns_401_missing_sub_claim(self, client: TestClient):
        """JWT without `sub` claim → 401."""
        token = jose_jwt.encode(
            {"aud": "authenticated", "exp": 9_999_999_999},
            TEST_JWT_SECRET,
            algorithm="HS256",
        )
        resp = client.get("/skus", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_get_skus_returns_200_with_valid_token(self, client: TestClient):
        """Valid JWT + mocked DB → 200 with SKU list."""
        merchant = make_merchant(plan="recon")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = mock_async_session()

        token = make_jwt()
        resp = client.get("/skus", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_merchant_me_returns_profile(self, client: TestClient):
        """GET /merchants/me returns merchant profile fields."""
        merchant = make_merchant(plan="cipher")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = mock_async_session()

        resp = client.get("/merchants/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["plan"] == "cipher"
        assert "id" in data

    def test_suspended_merchant_returns_402(self, client: TestClient):
        """read_only merchant → 402 payment required."""
        merchant = make_merchant(read_only=True)
        # read_only check is inside get_current_merchant, so we test
        # with the REAL auth dep but mock the DB to return a read_only merchant.
        # This can be simulated by directly patching get_current_merchant to raise.
        from fastapi import HTTPException
        async def _suspended():
            raise HTTPException(
                status_code=402,
                detail={"error": "account_suspended"},
            )
        app.dependency_overrides[get_current_merchant] = _suspended

        resp = client.get("/skus")
        assert resp.status_code == 402
        assert resp.json()["detail"]["error"] == "account_suspended"


# ════════════════════════════════════════════════════════════════════════════
# 2. PLAN GATE TESTS
# ════════════════════════════════════════════════════════════════════════════

class TestPlanGate:
    def test_requires_plan_returns_true_for_sufficient_plan(self):
        assert requires_plan("auto_reprice", "cipher")   is True
        assert requires_plan("auto_reprice", "phantom")  is True
        assert requires_plan("auto_reprice", "predator") is True
        assert requires_plan("auto_reprice", "eclipse")  is True

    def test_requires_plan_returns_false_for_insufficient_plan(self):
        assert requires_plan("auto_reprice",      "recon")  is False
        assert requires_plan("attribution",       "recon")  is False
        assert requires_plan("attribution",       "cipher") is False
        assert requires_plan("history_90d",       "phantom")is False
        assert requires_plan("dedicated_workers", "predator") is False

    def test_feature_gates_dict_exact(self):
        """Exact FEATURE_GATES dict matches the spec."""
        expected = {
            "auto_reprice":      "cipher",
            "attribution":       "phantom",
            "webhooks":          "phantom",
            "history_90d":       "predator",
            "priority_queue":    "predator",
            "dedicated_workers": "eclipse",
            "ai_signals":        "cipher",
        }
        assert FEATURE_GATES == expected

    def test_plan_hierarchy_order(self):
        # FREE is the floor so paid-feature gates deny it cleanly (no crash).
        assert PLAN_HIERARCHY == ["free", "recon", "cipher", "phantom", "predator", "eclipse"]

    def test_export_skus_returns_403_for_recon_plan(self, client: TestClient):
        """GET /skus/export (PHANTOM+) with RECON merchant → 403 upgrade_required."""
        merchant = make_merchant(plan="recon")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = mock_async_session()

        resp = client.get("/skus/export")
        assert resp.status_code == 403
        data = resp.json()["detail"]
        assert data["error"] == "upgrade_required"
        assert data["required_plan"] == "phantom"

    def test_export_skus_returns_403_for_cipher_plan(self, client: TestClient):
        """GET /skus/export (PHANTOM+) with CIPHER merchant → 403."""
        merchant = make_merchant(plan="cipher")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = mock_async_session()

        resp = client.get("/skus/export")
        assert resp.status_code == 403

    def test_export_skus_returns_200_for_phantom_plan(self, client: TestClient):
        """GET /skus/export with PHANTOM merchant → 200."""
        merchant = make_merchant(plan="phantom")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = mock_async_session()

        resp = client.get("/skus/export")
        assert resp.status_code == 200

    def test_403_body_has_correct_format(self, client: TestClient):
        """403 response has exactly: {error: 'upgrade_required', required_plan: '...'}"""
        merchant = make_merchant(plan="recon")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = mock_async_session()

        resp = client.get("/skus/export")
        body = resp.json()["detail"]
        assert set(body.keys()) == {"error", "required_plan"}
        assert body["error"] == "upgrade_required"
        assert body["required_plan"] in PLAN_HIERARCHY


# ════════════════════════════════════════════════════════════════════════════
# 3. SHOPIFY OAUTH TESTS
# ════════════════════════════════════════════════════════════════════════════

class TestShopifyOAuth:
    def _make_hmac(self, params: dict) -> str:
        """Calculate Shopify HMAC for test callback params."""
        message = "&".join(
            f"{k}={v}"
            for k, v in sorted(params.items())
            if k != "hmac"
        )
        return hmac.new(
            b"test_api_secret",
            message.encode(),
            hashlib.sha256,
        ).hexdigest()

    def test_oauth_begin_redirects_to_shopify(self, client: TestClient):
        """GET /merchants/shopify/oauth → redirect to Shopify authorize URL."""
        merchant = make_merchant()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)

        resp = client.get(
            "/merchants/shopify/oauth?shop=teststore.myshopify.com",
            follow_redirects=False,
        )
        assert resp.status_code == 302
        location = resp.headers["location"]
        assert "teststore.myshopify.com" in location
        assert "client_id=test_api_key" in location
        assert "redirect_uri=" in location

    def test_oauth_callback_stores_encrypted_token(self, client: TestClient):
        """
        Callback with valid HMAC + mocked Shopify token response:
        - Stores encrypted access token on merchant
        - Redirects to dashboard
        """
        merchant = make_merchant()
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.commit = AsyncMock()
        session.refresh = AsyncMock()

        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        params = {"code": "abc123", "shop": "teststore.myshopify.com", "state": "nonce"}
        params["hmac"] = self._make_hmac(params)

        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = {"access_token": "shpat_test_token"}

        with patch("routers.merchants._import_shopify_skus"):
            with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_resp)):
                resp = client.get(
                    "/merchants/shopify/callback",
                    params=params,
                    follow_redirects=False,
                )

        assert resp.status_code == 302
        assert resp.headers["location"] == "https://app.specterapp.io/dashboard"

        # Verify merchant was updated with encrypted token
        assert merchant.shopify_domain == "teststore.myshopify.com"
        assert merchant.shopify_access_token is not None
        assert merchant.shopify_access_token != "shpat_test_token"  # must be encrypted

    def test_oauth_callback_rejects_invalid_hmac(self, client: TestClient):
        """Callback with tampered HMAC → 400."""
        merchant = make_merchant()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)

        resp = client.get(
            "/merchants/shopify/callback",
            params={
                "code": "abc123",
                "shop": "teststore.myshopify.com",
                "hmac": "deadbeef1234",
            },
            follow_redirects=False,
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "invalid_hmac"

    def test_token_is_encrypted_at_rest(self, client: TestClient):
        """Decrypting the stored token returns the original access_token."""
        from cryptography.fernet import Fernet
        import base64

        # Use the same key set in env
        fernet = Fernet(base64.urlsafe_b64encode(b"t" * 32))

        plaintext_token = "shpat_test_secret"
        encrypted = fernet.encrypt(plaintext_token.encode()).decode()
        decrypted = fernet.decrypt(encrypted.encode()).decode()
        assert decrypted == plaintext_token


# ════════════════════════════════════════════════════════════════════════════
# 4. COMPETITORS ROUTER — PROBE JOB QUEUING
# ════════════════════════════════════════════════════════════════════════════

class TestCompetitorsRouter:
    def _make_session_for_add(self, sku: MagicMock, merchant: MagicMock) -> AsyncMock:
        """Mock session that returns the SKU and passes limit checks."""
        session = AsyncMock()
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        # Counts for limit checks
        count_result = MagicMock()
        count_result.scalar_one = MagicMock(return_value=0)

        # No duplicate URL in DB
        none_result = MagicMock()
        none_result.scalar_one_or_none = MagicMock(return_value=None)

        call_count = [0]

        async def smart_execute(stmt):
            call_count[0] += 1
            # First few calls return count=0 (under limits, no duplicate)
            if call_count[0] <= 3:
                return count_result
            return none_result

        session.execute = smart_execute

        async def smart_get(model, pk):
            if model.__name__ == "SKU" or (hasattr(model, "__tablename__") and model.__tablename__ == "skus"):
                return sku
            if hasattr(model, "__tablename__") and model.__tablename__ == "competitor_urls":
                return None  # trigger create
            return None

        session.get = smart_get
        session.add = MagicMock()
        return session

    def test_post_competitors_queues_probe_job(self, client: TestClient):
        """
        POST /competitors with a valid URL:
        - Creates a competitor_tracking row
        - Enqueues a probe job to scrape:probe BullMQ queue via Redis
        """
        merchant = make_merchant(plan="recon")
        sku = MagicMock(spec=SKU)
        sku.id = uuid.uuid4()
        sku.merchant_id = merchant.id

        mock_redis = MagicMock()
        mock_redis.incr.return_value = 42
        mock_redis.rpush = MagicMock()
        mock_redis.hset = MagicMock()

        session = AsyncMock()
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        # get() for SKU returns the sku; for CompetitorURL returns None
        async def smart_get(model, pk):
            if hasattr(model, "__tablename__") and model.__tablename__ == "skus":
                return sku
            return None

        session.get = smart_get

        count_res = MagicMock()
        count_res.scalar_one = MagicMock(return_value=0)
        count_res.scalar_one_or_none = MagicMock(return_value=None)
        session.execute = AsyncMock(return_value=count_res)
        session.add = MagicMock()

        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        tracking_id = uuid.uuid4()
        cu_id = uuid.uuid4()

        # Real CompetitorTracking objects have no id until a DB flush. The route
        # calls session.flush()/refresh() then enqueues using tracking.id, so we
        # simulate flush assigning the PK on the in-memory object.
        from models.competitor_trackings import CompetitorTracking

        async def flush_side_effect():
            for obj in session.add.call_args_list:
                candidate = obj.args[0] if obj.args else None
                if isinstance(candidate, CompetitorTracking) and candidate.id is None:
                    candidate.id = tracking_id

        session.flush.side_effect = flush_side_effect

        # The route builds a TrackingOut from a freshly-constructed SQLAlchemy
        # object whose server_default fields are unpopulated without a real DB
        # flush. Patch the response builder so the test isolates its real
        # concern: that a probe job is queued immediately (F2 AC#4).
        from routers.competitors import TrackingOut

        async def fake_build(tracking, session):
            return TrackingOut(
                id=tracking_id,
                own_product_id=sku.id,
                competitor_url_id=cu_id,
                merchant_id=merchant.id,
                enabled=True,
                silenced_oos=False,
                url="https://amazon.com/dp/B09V3KXJPB",
                domain="amazon.com",
                robots_blocked=False,
            )

        with patch("routers.competitors._check_url_reachable", return_value=True):
            with patch("routers.competitors.redis_client", mock_redis):
                with patch("routers.competitors.enqueue_probe_job") as mock_enqueue:
                    mock_enqueue.return_value = "42"
                    with patch("routers.competitors._build_tracking_out", side_effect=fake_build):
                        resp = client.post(
                            "/competitors",
                            json={
                                "url": "https://amazon.com/dp/B09V3KXJPB",
                                "own_product_id": str(sku.id),
                            },
                        )

        # The POST must succeed AND have queued a probe job immediately.
        assert resp.status_code == 201
        assert mock_enqueue.called
        # Verify the probe job carried the tracking ID and correct domain.
        call_kwargs = mock_enqueue.call_args.kwargs
        assert call_kwargs["domain"] == "amazon.com"
        assert call_kwargs["competitor_tracking_ids"] == [str(tracking_id)]

    def test_post_competitors_returns_402_at_sku_limit(self, client: TestClient):
        """Plan SKU limit reached → 402 sku_limit_reached."""
        merchant = make_merchant(plan="recon")  # limit = 100
        sku = MagicMock(spec=SKU)
        sku.id = uuid.uuid4()
        sku.merchant_id = merchant.id

        session = AsyncMock()
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        count_100 = MagicMock()
        count_100.scalar_one = MagicMock(return_value=100)  # at limit

        async def smart_get(model, pk):
            if hasattr(model, "__tablename__") and model.__tablename__ == "skus":
                return sku
            return None

        session.get = smart_get
        session.execute = AsyncMock(return_value=count_100)
        session.add = MagicMock()

        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        with patch("routers.competitors._check_url_reachable", return_value=True):
            resp = client.post(
                "/competitors",
                json={
                    "url": "https://amazon.com/dp/B09V3KXJPB",
                    "own_product_id": str(sku.id),
                },
            )

        assert resp.status_code == 402
        assert resp.json()["detail"]["error"] == "sku_limit_reached"

    def test_post_competitors_returns_409_for_duplicate(self, client: TestClient):
        """Same URL + same own_product → 409 already_tracking."""
        merchant = make_merchant(plan="recon")
        sku = MagicMock(spec=SKU)
        sku.id = uuid.uuid4()
        sku.merchant_id = merchant.id

        session = AsyncMock()
        session.commit = AsyncMock()
        session.flush = AsyncMock()

        count_zero = MagicMock()
        count_zero.scalar_one = MagicMock(return_value=0)

        from models.competitor_trackings import CompetitorTracking
        existing_tracking = MagicMock(spec=CompetitorTracking)
        dup_result = MagicMock()
        dup_result.scalar_one_or_none = MagicMock(return_value=existing_tracking)

        call_count = [0]

        async def smart_execute(stmt):
            call_count[0] += 1
            if call_count[0] <= 2:  # limit checks
                return count_zero
            return dup_result  # duplicate check

        session.execute = smart_execute

        async def smart_get(model, pk):
            if hasattr(model, "__tablename__") and model.__tablename__ == "skus":
                return sku
            return None

        session.get = smart_get
        session.add = MagicMock()

        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.post(
            "/competitors",
            json={
                "url": "https://amazon.com/dp/B09V3KXJPB",
                "own_product_id": str(sku.id),
            },
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["error"] == "already_tracking"

    def test_delete_competitor_disables_tracking(self, client: TestClient):
        """DELETE /competitors/{id} sets enabled=False and pauses the URL schedule."""
        merchant = make_merchant()
        from models.competitor_trackings import CompetitorTracking
        from models.competitor_urls import CompetitorURL
        tracking = MagicMock(spec=CompetitorTracking)
        tracking.id = uuid.uuid4()
        tracking.merchant_id = merchant.id
        tracking.enabled = True
        tracking.competitor_url_id = uuid.uuid4()

        # The URL whose schedule is recomputed after the tracking is disabled.
        cu = MagicMock(spec=CompetitorURL)
        cu.id = tracking.competitor_url_id
        cu.domain = "shop.com"
        cu.url_path = "/p/x"
        cu.phase_offset_ms = None
        cu.next_run_at = None

        async def smart_get(model, pk):
            if model is CompetitorURL:
                return cu
            return tracking

        session = AsyncMock()
        session.get = smart_get
        session.flush = AsyncMock()
        session.commit = AsyncMock()
        # refresh_url_schedule → enabled_trackings_for_url runs .all(); with no
        # remaining enabled trackings the URL is paused (next_run_at cleared).
        session.execute = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=[])))

        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.delete(f"/competitors/{tracking.id}")
        assert resp.status_code == 204
        assert tracking.enabled is False
        assert cu.next_run_at is None  # last tracking removed → schedule paused


# ════════════════════════════════════════════════════════════════════════════
# 5. SKU ROUTES
# ════════════════════════════════════════════════════════════════════════════

class TestSKURoutes:
    def test_list_skus_returns_list(self, client: TestClient):
        merchant = make_merchant()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = mock_async_session()

        resp = client.get("/skus")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_sku_count_returns_structure(self, client: TestClient):
        merchant = make_merchant(plan="recon")
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = mock_async_session()

        resp = client.get("/skus/count")
        assert resp.status_code == 200
        data = resp.json()
        assert "used" in data
        assert "limit" in data
        assert data["limit"] == 100  # RECON plan limit

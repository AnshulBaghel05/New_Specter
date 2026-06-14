"""
Root pytest conftest — runs before any test module is collected.

Several production modules read configuration from os.environ *at import time*
(db.py → DATABASE_URL, auth/supabase.py → SUPABASE_JWT_SECRET, routers/merchants.py
→ SHOPIFY_*/ENCRYPTION_KEY, services/billing.py → RAZORPAY_*). Whichever test
module imports `main` first locks in those values. Setting the shared test env
here — before collection — makes the suite independent of test-file import order.

Individual test modules may still set/override these for their own scenarios.
"""
import base64
import os

# Infra connections (never actually opened in tests — mocked via dependency overrides).
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

# Rate limiting off by default for the suite so high-volume tests don't trip it;
# the dedicated rate-limit test enables a limiter explicitly.
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

# Auth / crypto.
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret-32-char!")
os.environ.setdefault("ENCRYPTION_KEY", base64.urlsafe_b64encode(b"t" * 32).decode())

# Shopify OAuth (routers/merchants.py reads these at import).
os.environ.setdefault("SHOPIFY_API_KEY", "test_api_key")
os.environ.setdefault("SHOPIFY_API_SECRET", "test_api_secret")
os.environ.setdefault("SHOPIFY_REDIRECT_URI", "https://api.specterapp.io/merchants/shopify/callback")
os.environ.setdefault("DASHBOARD_URL", "https://app.specterapp.io/dashboard")

# Razorpay billing (services/billing.py resolves these at call time; set for completeness).
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "whsec_test_secret")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_key")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "rzp_test_secret")
os.environ.setdefault("RAZORPAY_PLAN_RECON_MONTHLY", "plan_recon_monthly")
os.environ.setdefault("RAZORPAY_PLAN_RECON_ANNUAL", "plan_recon_annual")
os.environ.setdefault("RAZORPAY_PLAN_CIPHER_MONTHLY", "plan_cipher_monthly")
os.environ.setdefault("RAZORPAY_PLAN_ADDON_50SKU", "plan_addon_50")
os.environ.setdefault("RAZORPAY_PLAN_ADDON_100SKU", "plan_addon_100")
os.environ.setdefault("RAZORPAY_PLAN_ADDON_SPEED_RECON", "plan_addon_speed_recon")

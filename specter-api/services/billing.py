"""
Razorpay billing service — config, plan-ID resolution, webhook signature
verification, and a thin httpx wrapper over the Razorpay REST API.

We wrap the REST API with httpx rather than pulling in the `razorpay` SDK,
matching the repo convention (services/email.py wraps Resend the same way) —
it keeps the dependency surface small and the unit tests free of a network SDK.
The webhook signature check is pure stdlib (hmac/hashlib), so it is fully
unit-testable with a known secret.

Env vars (Railway):
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   — REST API basic-auth credentials
  RAZORPAY_WEBHOOK_SECRET                — HMAC secret for POST /billing/webhook
  RAZORPAY_PLAN_<PLAN>_<CADENCE>         — subscription plan ids (see PRICING.md)
  RAZORPAY_PLAN_ADDON_*                  — add-on plan ids

Env that maps to plan/cadence/add-on is read at *call time* (not import) so tests
can set it after the module is imported.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("specter.billing")

_API_BASE = "https://api.razorpay.com/v1"

# ── Policy constants (PRICING.md) ────────────────────────────────────────────

CADENCES: tuple[str, ...] = ("monthly", "annual")
MAX_ADDONS = 3
# Self-serve subscribe/upgrade plans. ECLIPSE is sales-led — no self-serve flow.
SELF_SERVE_PLANS: tuple[str, ...] = ("recon", "cipher", "phantom", "predator")

# plan -> {cadence: env var holding the Razorpay plan id}
_PLAN_ENV: dict[str, dict[str, str]] = {
    "recon":    {"monthly": "RAZORPAY_PLAN_RECON_MONTHLY",    "annual": "RAZORPAY_PLAN_RECON_ANNUAL"},
    "cipher":   {"monthly": "RAZORPAY_PLAN_CIPHER_MONTHLY",   "annual": "RAZORPAY_PLAN_CIPHER_ANNUAL"},
    "phantom":  {"monthly": "RAZORPAY_PLAN_PHANTOM_MONTHLY",  "annual": "RAZORPAY_PLAN_PHANTOM_ANNUAL"},
    "predator": {"monthly": "RAZORPAY_PLAN_PREDATOR_MONTHLY", "annual": "RAZORPAY_PLAN_PREDATOR_ANNUAL"},
}

# addon_type -> env var for its plan id, the SKU-limit delta it grants, and the
# base plans it is available on (None = all plans). Mirrors PRICING.md À La Carte.
ADDONS: dict[str, dict] = {
    "sku_50":        {"env": "RAZORPAY_PLAN_ADDON_50SKU",         "sku_delta": 50,  "plans": None},
    "sku_100":       {"env": "RAZORPAY_PLAN_ADDON_100SKU",        "sku_delta": 100, "plans": None},
    "speed_recon":   {"env": "RAZORPAY_PLAN_ADDON_SPEED_RECON",   "sku_delta": 0,   "plans": ("recon",)},
    "speed_cipher":  {"env": "RAZORPAY_PLAN_ADDON_SPEED_CIPHER",  "sku_delta": 0,   "plans": ("cipher",)},
    "speed_phantom": {"env": "RAZORPAY_PLAN_ADDON_SPEED_PHANTOM", "sku_delta": 0,   "plans": ("phantom",)},
}


# ── Webhook signature (pure stdlib — security critical) ──────────────────────

def verify_webhook_signature(payload: bytes, signature: str, secret: Optional[str] = None) -> bool:
    """True iff `signature` is a valid Razorpay HMAC-SHA256 of the raw `payload`.

    Razorpay signs the *raw request body* with the webhook secret. We recompute
    and constant-time compare. A missing secret or signature is a hard fail
    (returns False) — never trust an unsigned/unverifiable webhook.
    """
    secret = secret if secret is not None else os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


# ── Plan / add-on id resolution (pure — env read at call time) ───────────────

def is_self_serve_plan(plan: str) -> bool:
    return plan.lower() in SELF_SERVE_PLANS


def plan_id_for(plan: str, cadence: str) -> Optional[str]:
    """The configured Razorpay plan id for a (plan, cadence), or None."""
    envs = _PLAN_ENV.get(plan.lower())
    if not envs or cadence not in envs:
        return None
    return os.environ.get(envs[cadence]) or None


def plan_from_plan_id(plan_id: Optional[str]) -> Optional[str]:
    """Reverse-map a Razorpay plan id back to our internal plan name.

    Returns None for add-on plan ids or anything unknown — the webhook uses this
    to ignore add-on subscription events when deciding a plan change.
    """
    if not plan_id:
        return None
    for plan, envs in _PLAN_ENV.items():
        for env in envs.values():
            if os.environ.get(env) == plan_id:
                return plan
    return None


def addon_plan_id(addon_type: str) -> Optional[str]:
    spec = ADDONS.get(addon_type)
    return os.environ.get(spec["env"]) if spec else None


def addon_sku_delta(addon_type: str) -> int:
    spec = ADDONS.get(addon_type)
    return int(spec["sku_delta"]) if spec else 0


def addon_allowed_on(addon_type: str, plan: str) -> bool:
    """True if `addon_type` may be purchased on `plan` (per PRICING.md)."""
    spec = ADDONS.get(addon_type)
    if not spec:
        return False
    plans = spec["plans"]
    return plans is None or plan.lower() in plans


# ── Razorpay REST wrapper (best-effort, httpx) ───────────────────────────────

def _auth() -> tuple[str, str]:
    return (os.environ.get("RAZORPAY_KEY_ID", ""), os.environ.get("RAZORPAY_KEY_SECRET", ""))


async def create_subscription(
    plan_id: str,
    *,
    merchant_id: str,
    total_count: int = 12,
    customer_notify: bool = True,
) -> Optional[dict]:
    """Create a Razorpay subscription for `plan_id`. Returns the entity dict
    (with `id`, `short_url`, `status`) or None on failure.

    `merchant_id` is stamped into the subscription `notes` so the webhook can
    map an activation back to the right merchant.
    """
    body = {
        "plan_id": plan_id,
        "total_count": total_count,
        "customer_notify": 1 if customer_notify else 0,
        "notes": {"merchant_id": merchant_id},
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{_API_BASE}/subscriptions", json=body, auth=_auth())
        if resp.status_code >= 300:
            logger.error("Razorpay create_subscription failed (%s): %s", resp.status_code, resp.text[:200])
            return None
        return resp.json()
    except httpx.HTTPError as err:
        logger.error("Razorpay create_subscription request error: %s", err)
        return None


async def cancel_subscription(subscription_id: str, cancel_at_cycle_end: bool = False) -> bool:
    """Cancel a Razorpay subscription. Best-effort — returns True on success."""
    if not subscription_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{_API_BASE}/subscriptions/{subscription_id}/cancel",
                json={"cancel_at_cycle_end": 1 if cancel_at_cycle_end else 0},
                auth=_auth(),
            )
        if resp.status_code >= 300:
            logger.error("Razorpay cancel_subscription failed (%s): %s", resp.status_code, resp.text[:200])
            return False
        return True
    except httpx.HTTPError as err:
        logger.error("Razorpay cancel_subscription request error: %s", err)
        return False

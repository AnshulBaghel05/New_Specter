"""
Plan gating — FEATURE_GATES, PLAN_HIERARCHY, and the FastAPI dependency factory.

Usage in a router:
    @router.get("/auto-reprice", dependencies=[Depends(plan_gate("auto_reprice"))])
    async def auto_reprice_settings(...):
        ...

Or to get the merchant AND enforce the gate at the same time:
    @router.get("/attribution")
    async def attribution(merchant: Merchant = Depends(plan_gate("attribution"))):
        ...
"""
from __future__ import annotations

from typing import Callable

from fastapi import Depends, HTTPException, status

from models.merchants import Merchant

# NOTE: `auth.supabase` (which pulls in `db`) is imported lazily inside
# `plan_gate()` so this module's pure limit logic / constants can be imported
# without a database or JWT environment — keeps the unit tests truly pure.

# ── Plan hierarchy (ascending — higher index = more capable) ─────────────────
# FREE is the floor: it sits below RECON so every paid-feature gate denies it
# cleanly (instead of crashing on an unknown plan). See requires_plan.

PLAN_HIERARCHY: list[str] = ["free", "recon", "cipher", "phantom", "predator", "eclipse"]

# ── Feature gates (exact values from ARCHITECTURE.md spec) ──────────────────

FEATURE_GATES: dict[str, str] = {
    "auto_reprice":      "cipher",
    "attribution":       "phantom",
    "webhooks":          "phantom",
    "history_90d":       "predator",
    "priority_queue":    "predator",
    "dedicated_workers": "eclipse",
    "ai_signals":        "cipher",
}

# ── Plan SKU limits (canonical — PRICING.md "Tier Table") ────────────────────
# Value is the ceiling on active (product × competitor) trackings.
#   FREE = 0 (no live monitoring); ECLIPSE = None (unlimited, custom contract).

PLAN_MAX_SKUS: dict[str, int | None] = {
    "free":     0,
    "recon":    100,
    "cipher":   500,
    "phantom":  1_000,
    "predator": 2_000,
    "eclipse":  None,  # unlimited — custom contract
}

# ── Max competitors per own product (canonical — PRICING.md) ─────────────────
#   FREE = 0; ECLIPSE = None (unlimited / custom).

PLAN_COMPETITOR_LIMITS: dict[str, int | None] = {
    "free":     0,
    "recon":    3,
    "cipher":   5,
    "phantom":  8,
    "predator": 12,
    "eclipse":  None,
}


# ── Limit resolvers (pure — single source of truth for the routers) ──────────

def plan_max_skus(plan: str) -> int | None:
    """Effective SKU ceiling for `plan`. None = unlimited (ECLIPSE only).

    Unknown / stale plan strings resolve to 0 (deny) rather than None, so a typo
    can never silently grant unlimited SKUs.
    """
    return PLAN_MAX_SKUS.get(plan.lower(), 0)


def plan_competitor_limit(plan: str) -> int | None:
    """Per-product competitor ceiling for `plan`. None = unlimited (ECLIPSE)."""
    return PLAN_COMPETITOR_LIMITS.get(plan.lower(), 0)


def competitor_limit_for(plan: str, eclipse_override: int | None = None) -> int | None:
    """Per-product competitor limit, plan-driven.

    For every self-serve plan the limit comes straight from the plan (so a stale
    `merchants.max_competitors_per_sku` column can't desync it). ECLIPSE is a
    custom contract, so its per-merchant `eclipse_override` wins (None = unlimited).
    """
    if plan.lower() == "eclipse":
        return eclipse_override
    return plan_competitor_limit(plan)


# ── Core gate function (pure — no I/O) ───────────────────────────────────────

def requires_plan(feature: str, merchant_plan: str) -> bool:
    """
    Return True when `merchant_plan` satisfies the minimum required for `feature`.
    Raises KeyError if `feature` is not in FEATURE_GATES. An unknown merchant plan
    is treated as below FREE (always denied) rather than raising.
    """
    min_plan = FEATURE_GATES[feature]
    try:
        merchant_idx = PLAN_HIERARCHY.index(merchant_plan.lower())
    except ValueError:
        merchant_idx = -1  # unknown plan → below the floor → always denied
    required_idx = PLAN_HIERARCHY.index(min_plan)
    return merchant_idx >= required_idx


# ── FastAPI dependency factory ────────────────────────────────────────────────

def plan_gate(feature: str) -> Callable:
    """
    Return a FastAPI dependency that:
      1. Validates the Supabase JWT (via get_current_merchant).
      2. Checks the merchant's plan against FEATURE_GATES[feature].
      3. Returns the Merchant on pass; raises HTTP 403 on denial.

    403 body: {"error": "upgrade_required", "required_plan": "<plan>"}
    """
    from auth.supabase import get_current_merchant  # lazy — avoids db import at module load

    async def _gate(
        merchant: Merchant = Depends(get_current_merchant),
    ) -> Merchant:
        if not requires_plan(feature, merchant.plan):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error":         "upgrade_required",
                    "required_plan": FEATURE_GATES[feature],
                },
            )
        return merchant

    # Preserve the feature name in the dependency for OpenAPI docs
    _gate.__name__ = f"plan_gate_{feature}"
    return _gate

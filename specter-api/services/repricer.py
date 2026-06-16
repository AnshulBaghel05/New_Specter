"""
Auto-reprice service (F7, CIPHER+).

Two concerns, deliberately split so the pricing math is unit-testable without
any Shopify I/O:

  compute_reprice(...)      — pure: signal + bounds + competitor prices → new price
  apply_price_change(...)   — effectful: Shopify Admin API PUT (3x retry) + DB write

Formulas (F7 AC#3–4):
  RAISE  new = min(min_instock_competitor_price - 0.01, ceiling_price)
  LOWER  new = max(median_competitor_price       - 0.01, floor_price)
"""
from __future__ import annotations

import asyncio
import statistics
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from models.merchants import Merchant
from models.price_changes import PriceChange
from models.skus import SKU
from services import crypto

PENNY = Decimal("0.01")
SHOPIFY_API_VERSION = "2024-01"
MAX_RETRIES = 3
RETRY_BACKOFF_S = 2.0  # base for exponential backoff; patched to ~0 in tests


def _q(value: Decimal) -> Decimal:
    return value.quantize(PENNY, rounding=ROUND_HALF_UP)


# ── Pure pricing decision ─────────────────────────────────────────────────────

@dataclass(frozen=True)
class RepriceDecision:
    new_price: Decimal
    clamped: Optional[str]   # "floor" | "ceiling" | None
    reason: str


def compute_reprice(
    signal_type: str,
    current_price: Decimal,
    floor_price: Optional[Decimal],
    ceiling_price: Optional[Decimal],
    instock_competitor_prices: list[Decimal],
) -> Optional[RepriceDecision]:
    """
    Compute the target price for a RAISE/LOWER signal.

    Returns None when no price change should be applied (HOLD, no competitor
    data, or the computed price equals the current price).
    """
    signal = signal_type.upper()
    if signal not in ("RAISE", "LOWER"):
        return None
    if not instock_competitor_prices:
        return None
    if current_price is None or current_price <= 0:
        return None

    if signal == "RAISE":
        # Undercut the cheapest in-stock competitor by a penny.
        target = min(instock_competitor_prices) - PENNY
        reason = (
            f"RAISE: undercut lowest in-stock competitor "
            f"(${min(instock_competitor_prices):.2f}) by $0.01"
        )
    else:  # LOWER
        median_price = Decimal(str(statistics.median(float(p) for p in instock_competitor_prices)))
        target = median_price - PENNY
        reason = f"LOWER: match market median (${median_price:.2f}) minus $0.01"

    # Clamp into [floor, ceiling] regardless of signal direction. Previously RAISE
    # honored only the ceiling and LOWER only the floor, so a wrong-direction signal
    # (e.g. a RAISE whose target lands below floor_price) could breach the unclamped
    # bound and sell below the merchant's floor. The floor is the stronger guarantee
    # (never sell below it), so it is applied last and wins if a floor > ceiling
    # misconfiguration ever makes both apply.
    clamped: Optional[str] = None
    if ceiling_price is not None and target > ceiling_price:
        target = ceiling_price
        clamped = "ceiling"
    if floor_price is not None and target < floor_price:
        target = floor_price
        clamped = "floor"

    target = _q(target)
    if target <= 0:
        return None
    if target == _q(current_price):
        return None  # no-op — already at target

    if clamped:
        reason += f" — {clamped}-clamped to ${target:.2f}"

    return RepriceDecision(new_price=target, clamped=clamped, reason=reason)


# ── Shopify Admin API call (isolated for mocking) ────────────────────────────

async def _update_shopify_price(
    shop_domain: str,
    access_token: str,
    variant_id: str,
    new_price: Decimal,
) -> None:
    """
    PUT the new price to a Shopify variant. Raises on non-2xx so the retry loop
    can catch it. Raises ShopifyAuthError on 401 (token expired/revoked).
    """
    url = f"https://{shop_domain}/admin/api/{SHOPIFY_API_VERSION}/variants/{variant_id}.json"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.put(
            url,
            json={"variant": {"id": variant_id, "price": f"{new_price:.2f}"}},
            headers={"X-Shopify-Access-Token": access_token},
        )
    if resp.status_code == 401:
        raise ShopifyAuthError("Shopify token expired or revoked")
    if resp.status_code >= 300:
        raise ShopifyApiError(f"Shopify returned {resp.status_code}: {resp.text[:200]}")


class ShopifyApiError(Exception):
    """Transient/retryable Shopify failure (5xx, 429, network)."""


class ShopifyAuthError(Exception):
    """Shopify auth failure (401) — stop repricing, require reconnect."""


# ── Effectful apply: Shopify PUT (3x retry) + DB write ───────────────────────

@dataclass
class RepriceOutcome:
    applied: bool
    price_change: Optional[PriceChange]
    reason: str
    needs_reconnect: bool = False


async def apply_price_change(
    session: AsyncSession,
    merchant: Merchant,
    sku: SKU,
    decision: RepriceDecision,
    signal_id: Optional[str] = None,
) -> RepriceOutcome:
    """
    Apply a RepriceDecision to Shopify and record it.

    - 3x retry with exponential backoff on transient Shopify errors.
    - On 401: set merchant.shopify_reconnect_required, return needs_reconnect.
    - On success: write a price_changes row (source='auto'), update sku.current_price.
    - Does NOT commit — the caller owns the transaction.
    """
    if not merchant.shopify_domain or not merchant.shopify_access_token:
        return RepriceOutcome(False, None, "no_shopify_connection")
    if not sku.shopify_variant_id:
        return RepriceOutcome(False, None, "no_variant_id")

    token = crypto.decrypt(merchant.shopify_access_token)
    old_price = sku.current_price

    last_err: Optional[Exception] = None
    for attempt in range(MAX_RETRIES):
        try:
            await _update_shopify_price(
                merchant.shopify_domain, token, sku.shopify_variant_id, decision.new_price
            )
            # Success — record the change.
            pc = PriceChange(
                sku_id=sku.id,
                signal_id=signal_id,
                old_price=old_price,
                new_price=decision.new_price,
                source="auto",
                revenue_delta=None,  # filled later by attribution service
            )
            session.add(pc)
            sku.current_price = decision.new_price
            return RepriceOutcome(True, pc, decision.reason)

        except ShopifyAuthError:
            # Do not retry auth failures — token must be re-granted.
            merchant.shopify_reconnect_required = True
            return RepriceOutcome(False, None, "shopify_auth_failed", needs_reconnect=True)

        except (ShopifyApiError, httpx.HTTPError) as err:
            last_err = err
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_BACKOFF_S * (2 ** attempt))

    # All retries exhausted.
    return RepriceOutcome(False, None, f"shopify_failed:{last_err}")

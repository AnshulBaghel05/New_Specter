"""
Revenue attribution service (F8, PHANTOM+).

revenue_delta = (new_price - old_price) × units_sold_in_next_24hr   (F8 AC#2)

units_sold pulled from the Shopify Orders API for the 24h window after each
price change. The math is a pure function; the Shopify fetch is isolated for
mocking.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.merchants import Merchant
from models.price_changes import PriceChange
from models.skus import SKU
from services import crypto

PENNY = Decimal("0.01")
SHOPIFY_API_VERSION = "2024-01"
_MAX_RETRIES = 3
_RETRY_BACKOFF_S = 1.0   # base for 429 backoff; patched ~0 in tests


async def _sleep_retry_after(resp: httpx.Response, attempt: int) -> None:
    """Wait per Shopify's Retry-After header (seconds) on a 429, falling back to
    exponential backoff when the header is absent/unparseable."""
    try:
        delay = float(resp.headers.get("Retry-After", ""))
    except ValueError:
        delay = _RETRY_BACKOFF_S * (2 ** attempt)
    await asyncio.sleep(delay)


def _q(value: Decimal) -> Decimal:
    return value.quantize(PENNY, rounding=ROUND_HALF_UP)


# ── Pure calculation ──────────────────────────────────────────────────────────

def compute_revenue_delta(
    old_price: Decimal,
    new_price: Decimal,
    units_sold_24h: int,
) -> Decimal:
    """
    Dollar impact of a price change over the 24h after it was applied.

    Positive = recovered (price raised and still sold).
    Negative = lost margin (price lowered).
    """
    return _q((Decimal(new_price) - Decimal(old_price)) * Decimal(units_sold_24h))


# ── Shopify Orders fetch (isolated for mocking) ──────────────────────────────

class OrdersScopeError(Exception):
    """Shopify rejected the Orders read (401/403) — token lacks read_orders or was
    revoked. Caller flags the merchant for reconnect; attribution degrades to empty
    rather than crashing."""


async def fetch_units_sold(
    shop_domain: str,
    access_token: str,
    variant_id: str,
    since_iso: str,
    until_iso: str,
) -> int:
    """
    Count units of a variant sold in [since, until) via the Shopify Orders API.
    Sums line_item quantities matching the variant across paid orders.

    Raises OrdersScopeError on 401/403 (missing read_orders / revoked token).
    Honors Shopify's 429 Retry-After with a bounded retry so a rate-limit blip
    doesn't lose the data point.
    """
    url = f"https://{shop_domain}/admin/api/{SHOPIFY_API_VERSION}/orders.json"
    params = {
        "status": "any",
        "created_at_min": since_iso,
        "created_at_max": until_iso,
        "fields": "id,line_items",
        "limit": 250,
    }
    units = 0
    async with httpx.AsyncClient(timeout=20.0) as client:
        for attempt in range(_MAX_RETRIES):
            resp = await client.get(
                url, params=params, headers={"X-Shopify-Access-Token": access_token}
            )
            if resp.status_code in (401, 403):
                raise OrdersScopeError(f"Shopify orders read denied ({resp.status_code})")
            if resp.status_code == 429 and attempt < _MAX_RETRIES - 1:
                await _sleep_retry_after(resp, attempt)
                continue
            resp.raise_for_status()
            for order in resp.json().get("orders", []):
                for li in order.get("line_items", []):
                    if str(li.get("variant_id")) == str(variant_id):
                        units += int(li.get("quantity", 0))
            return units
    return units


# ── Effectful: compute + persist revenue_delta for a price change ────────────

@dataclass
class AttributionResult:
    price_change_id: str
    units_sold: int
    revenue_delta: Decimal


async def attribute_price_change(
    session: AsyncSession,
    merchant: Merchant,
    price_change: PriceChange,
    sku: SKU,
) -> Optional[AttributionResult]:
    """
    Fill `price_changes.revenue_delta` for one change using the 24h sales window.
    Returns None if the merchant has no Shopify connection or SKU has no variant.
    Does NOT commit — caller owns the transaction.
    """
    if not merchant.shopify_domain or not merchant.shopify_access_token:
        return None
    if not sku.shopify_variant_id:
        return None

    token = crypto.decrypt(merchant.shopify_access_token)
    since = price_change.created_at
    until = since + timedelta(hours=24)

    try:
        units = await fetch_units_sold(
            merchant.shopify_domain,
            token,
            sku.shopify_variant_id,
            since.isoformat(),
            until.isoformat(),
        )
    except OrdersScopeError:
        # Token lacks read_orders (older connection) or was revoked. Flag for
        # reconnect and skip — attribution stays empty for this change rather than
        # crashing the whole run. Reconnecting grants read_orders going forward.
        merchant.shopify_reconnect_required = True
        return None

    delta = compute_revenue_delta(price_change.old_price, price_change.new_price, units)
    price_change.revenue_delta = delta

    return AttributionResult(
        price_change_id=str(price_change.id),
        units_sold=units,
        revenue_delta=delta,
    )


# ── Aggregation for the /attribution chart ───────────────────────────────────

async def run_attribution_backfill(session: AsyncSession, *, max_changes: int = 500) -> dict:
    """Fill revenue_delta for price changes whose 24h sales window has fully elapsed.

    Selects auto + manual changes that are ≥24h old and not yet attributed, looks up
    each one's merchant + SKU, and computes the delta from real Shopify Orders data.
    Best-effort per change: one failure (missing connection, scope, Shopify error) is
    skipped, never aborting the run. Idempotent — once revenue_delta is set the row
    drops out of the candidate set. Intended to be driven by a daily cron."""
    from datetime import datetime, timezone

    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=24)
    rows = list((await session.execute(
        select(PriceChange)
        .where(
            PriceChange.source.in_(("auto", "manual")),
            PriceChange.revenue_delta.is_(None),
            PriceChange.created_at <= cutoff,
        )
        .order_by(PriceChange.created_at)
        .limit(max_changes)
    )).scalars().all())

    attributed = skipped = 0
    for pc in rows:
        try:
            sku = await session.get(SKU, pc.sku_id)
            if sku is None:
                skipped += 1
                continue
            merchant = await session.get(Merchant, sku.merchant_id)
            if merchant is None:
                skipped += 1
                continue
            result = await attribute_price_change(session, merchant, pc, sku)
            if result is None:
                skipped += 1
            else:
                attributed += 1
        except Exception:  # noqa: BLE001 — one bad change must not abort the run
            skipped += 1

    await session.commit()
    return {"candidates": len(rows), "attributed": attributed, "skipped": skipped}


@dataclass
class DailyAttribution:
    date: str          # YYYY-MM-DD
    revenue_delta: float


async def daily_attribution(
    session: AsyncSession,
    merchant_id,
    days: int = 30,
) -> list[DailyAttribution]:
    """
    Sum revenue_delta per calendar day over the trailing `days` window for a
    merchant's auto price changes. Used by the bar chart endpoint.
    """
    from datetime import datetime, timezone
    since = datetime.now(tz=timezone.utc) - timedelta(days=days)

    stmt = (
        select(PriceChange.created_at, PriceChange.revenue_delta)
        .join(SKU, PriceChange.sku_id == SKU.id)
        .where(
            SKU.merchant_id == merchant_id,
            # Both auto-reprices AND manual one-click reprices are attributed, so a
            # merchant who reprices by hand still sees the revenue impact.
            PriceChange.source.in_(("auto", "manual")),
            PriceChange.created_at >= since,
            PriceChange.revenue_delta.is_not(None),
        )
    )
    rows = (await session.execute(stmt)).all()

    by_day: dict[str, Decimal] = {}
    for created_at, delta in rows:
        day = created_at.date().isoformat()
        by_day[day] = by_day.get(day, Decimal("0")) + (delta or Decimal("0"))

    return [
        DailyAttribution(date=day, revenue_delta=float(total))
        for day, total in sorted(by_day.items())
    ]

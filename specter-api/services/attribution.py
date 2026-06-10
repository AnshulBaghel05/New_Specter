"""
Revenue attribution service (F8, PHANTOM+).

revenue_delta = (new_price - old_price) × units_sold_in_next_24hr   (F8 AC#2)

units_sold pulled from the Shopify Orders API for the 24h window after each
price change. The math is a pure function; the Shopify fetch is isolated for
mocking.
"""
from __future__ import annotations

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
        resp = await client.get(
            url, params=params, headers={"X-Shopify-Access-Token": access_token}
        )
        resp.raise_for_status()
        for order in resp.json().get("orders", []):
            for li in order.get("line_items", []):
                if str(li.get("variant_id")) == str(variant_id):
                    units += int(li.get("quantity", 0))
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

    units = await fetch_units_sold(
        merchant.shopify_domain,
        token,
        sku.shopify_variant_id,
        since.isoformat(),
        until.isoformat(),
    )

    delta = compute_revenue_delta(price_change.old_price, price_change.new_price, units)
    price_change.revenue_delta = delta

    return AttributionResult(
        price_change_id=str(price_change.id),
        units_sold=units,
        revenue_delta=delta,
    )


# ── Aggregation for the /attribution chart ───────────────────────────────────

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
            PriceChange.source == "auto",
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

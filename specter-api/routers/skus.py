"""
SKU (own product) routes.

Routes:
  GET   /skus             — list all active SKUs for the merchant
  GET   /skus/count       — SKU usage: {used, limit, max_competitors_per_sku}
  POST  /skus             — manually create a SKU (bulk import handled by Shopify OAuth flow)
  PATCH /skus/{sku_id}    — update floor/ceiling price; toggle active
  GET   /skus/export      — CIPHER+ gated: returns SKUs as CSV-ready JSON (F8)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import competitor_limit_for, plan_gate, plan_max_skus
from auth.supabase import get_current_merchant
from db import get_db
from models.competitor_trackings import CompetitorTracking
from models.competitor_urls import CompetitorURL
from models.merchants import Merchant
from models.oos_alerts import OOSAlert
from models.price_changes import PriceChange
from models.signals import Signal
from models.skus import SKU
from redis_client import redis as redis_client
from services.dispatcher import refresh_url_schedule

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SKUOut(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    title: str
    handle: Optional[str]
    current_price: Optional[Decimal]
    floor_price: Optional[Decimal]
    ceiling_price: Optional[Decimal]
    shopify_variant_id: Optional[str]
    active: bool

    model_config = {"from_attributes": True}


class SKUCreate(BaseModel):
    title: str
    handle: Optional[str] = None
    current_price: Optional[Decimal] = None
    shopify_variant_id: Optional[str] = None


class SKUPatch(BaseModel):
    floor_price: Optional[Decimal] = None
    ceiling_price: Optional[Decimal] = None
    current_price: Optional[Decimal] = None
    active: Optional[bool] = None


class SKUCountOut(BaseModel):
    used: int
    limit: Optional[int]
    max_competitors_per_sku: Optional[int]


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/skus", tags=["skus"])

# Absolute ceiling on SKU rows a single merchant may hold via manual creation.
# Plan SKU *limits* count enabled competitor trackings (the billing unit), not
# product rows — so POST /skus is otherwise unbounded and a merchant could spam
# product rows to bloat the table. This is a high abuse ceiling, well above any
# realistic manual catalog; the Shopify import path is trusted and not capped here.
MAX_SKUS_PER_MERCHANT = 10_000


@router.get("", response_model=list[SKUOut])
async def list_skus(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> list[SKUOut]:
    """List all SKUs for the authenticated merchant. Available on all plans."""
    stmt = (
        select(SKU)
        .where(SKU.merchant_id == merchant.id)
        .order_by(SKU.created_at.desc())
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return [SKUOut.model_validate(r) for r in rows]


@router.get("/count", response_model=SKUCountOut)
async def sku_count(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SKUCountOut:
    """
    Return SKU usage for the merchant's plan.
    `used` = COUNT(competitor_trackings WHERE merchant_id = ? AND enabled = true)
    so it reflects the billing definition: 1 SKU = 1 (product × competitor) pair.
    """
    from models.competitor_trackings import CompetitorTracking
    stmt = select(func.count()).where(
        CompetitorTracking.merchant_id == merchant.id,
        CompetitorTracking.enabled.is_(True),
    )
    used = (await session.execute(stmt)).scalar_one()
    return SKUCountOut(
        used=used,
        limit=plan_max_skus(merchant.plan),
        max_competitors_per_sku=competitor_limit_for(merchant.plan, merchant.max_competitors_per_sku),
    )


@router.get(
    "/export",
    response_model=list[SKUOut],
    dependencies=[Depends(plan_gate("attribution"))],
)
async def export_skus(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> list[SKUOut]:
    """
    Export all SKUs as JSON (PHANTOM+ only — gated via `attribution` feature).
    Frontend uses this for the revenue attribution CSV download (F8).
    """
    stmt = select(SKU).where(SKU.merchant_id == merchant.id)
    rows = list((await session.execute(stmt)).scalars().all())
    return [SKUOut.model_validate(r) for r in rows]


@router.post("", response_model=SKUOut, status_code=status.HTTP_201_CREATED)
async def create_sku(
    body: SKUCreate,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SKUOut:
    count = (await session.execute(
        select(func.count()).where(SKU.merchant_id == merchant.id)
    )).scalar_one()
    if count >= MAX_SKUS_PER_MERCHANT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "sku_limit_reached",
                    "message": f"You can hold up to {MAX_SKUS_PER_MERCHANT} products."},
        )

    sku = SKU(
        merchant_id=merchant.id,
        title=body.title,
        handle=body.handle,
        current_price=body.current_price,
        shopify_variant_id=body.shopify_variant_id,
    )
    session.add(sku)
    await session.commit()
    await session.refresh(sku)
    return SKUOut.model_validate(sku)


async def cascade_delete_sku(session: AsyncSession, redis_client, sku: SKU) -> dict:
    """Hard-delete a product and everything that hangs off it.

    Rows are removed children-first so no foreign key is ever violated:
      price_changes (→ signals, skus) → signals (→ skus) →
      oos_alerts (→ competitor_trackings, skus) → competitor_trackings (→ skus) → sku

    The competitor URLs this product tracked are captured BEFORE the trackings are
    deleted, then each has its schedule recomputed from whatever enabled trackings
    remain (other products/merchants). refresh_url_schedule clears next_run_at when
    none remain, so a URL nobody tracks anymore stops being scraped — no wasted
    crawls. SKU *usage* is derived live from enabled competitor_trackings (see
    GET /skus/count), so removing the trackings here is the usage recalculation;
    there is no stored counter to adjust."""
    sku_id = sku.id

    affected_url_ids = set((await session.execute(
        select(CompetitorTracking.competitor_url_id)
        .where(CompetitorTracking.own_product_id == sku_id)
    )).scalars().all())

    await session.execute(delete(PriceChange).where(PriceChange.sku_id == sku_id))
    await session.execute(delete(Signal).where(Signal.sku_id == sku_id))
    await session.execute(delete(OOSAlert).where(OOSAlert.sku_id == sku_id))
    await session.execute(delete(CompetitorTracking).where(CompetitorTracking.own_product_id == sku_id))
    await session.delete(sku)
    await session.flush()

    now = datetime.now(timezone.utc)
    for url_id in affected_url_ids:
        cu = await session.get(CompetitorURL, url_id)
        if cu is not None:
            await refresh_url_schedule(session, redis_client, cu, now)

    await session.commit()
    return {"competitor_urls_rescheduled": len(affected_url_ids)}


@router.delete("/{sku_id}", status_code=status.HTTP_204_NO_CONTENT,
               response_class=Response)
async def delete_sku(
    sku_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Permanently delete a product and all of its trackings, signals, alerts and
    price history (cascade). Irreversible — the frontend gates this behind a typed
    confirmation. Returns 404 (not 403) for a row the caller doesn't own so the
    endpoint never leaks the existence of another merchant's product."""
    sku = await session.get(SKU, sku_id)
    if sku is None or sku.merchant_id != merchant.id:
        raise HTTPException(status_code=404, detail={"error": "sku_not_found"})

    await cascade_delete_sku(session, redis_client, sku)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{sku_id}", response_model=SKUOut)
async def patch_sku(
    sku_id: uuid.UUID,
    body: SKUPatch,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SKUOut:
    sku = await session.get(SKU, sku_id)
    if sku is None or sku.merchant_id != merchant.id:
        raise HTTPException(status_code=404, detail={"error": "sku_not_found"})

    if body.floor_price is not None:
        sku.floor_price = body.floor_price
    if body.ceiling_price is not None:
        sku.ceiling_price = body.ceiling_price
    if body.current_price is not None:
        sku.current_price = body.current_price
    if body.active is not None:
        sku.active = body.active

    await session.commit()
    await session.refresh(sku)
    return SKUOut.model_validate(sku)

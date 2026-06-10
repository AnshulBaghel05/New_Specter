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
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import competitor_limit_for, plan_gate, plan_max_skus
from auth.supabase import get_current_merchant
from db import get_db
from models.merchants import Merchant
from models.skus import SKU

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

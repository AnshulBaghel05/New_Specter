"""
Repricing routes (F7, CIPHER+ gated via the `auto_reprice` feature).

Routes (all require CIPHER+):
  GET   /repricing              — SKUs with floor/ceiling/auto-reprice + latest AI suggestion
  PATCH /repricing/settings     — global auto_reprice_enabled toggle
  PATCH /repricing/sku/{id}     — per-SKU floor_price / ceiling_price / auto_reprice_enabled
  GET   /repricing/changes      — price-change history (newest first)

The plan gate returns 403 {"error":"upgrade_required","required_plan":"cipher"}
for RECON merchants — the frontend renders the upgrade prompt off that.
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import plan_gate
from db import get_db
from models.merchants import Merchant
from models.price_changes import PriceChange
from models.signals import Signal
from models.skus import SKU

# CIPHER+ gate reused as the auth dependency for every route here.
_cipher = plan_gate("auto_reprice")


# ── Schemas ───────────────────────────────────────────────────────────────────

class LatestSuggestion(BaseModel):
    type: str
    price_suggestion: Optional[float]
    confidence: float
    created_at: str


class RepriceSKUOut(BaseModel):
    id: str
    title: str
    current_price: Optional[float]
    floor_price: Optional[float]
    ceiling_price: Optional[float]
    currency: str
    auto_reprice_enabled: bool
    latest_suggestion: Optional[LatestSuggestion]


class RepriceListOut(BaseModel):
    global_auto_reprice_enabled: bool
    skus: list[RepriceSKUOut]


class SettingsPatch(BaseModel):
    auto_reprice_enabled: bool


class SKURepricePatch(BaseModel):
    floor_price: Optional[Decimal] = None
    ceiling_price: Optional[Decimal] = None
    auto_reprice_enabled: Optional[bool] = None


class PriceChangeOut(BaseModel):
    id: str
    sku_id: str
    sku_title: str
    old_price: float
    new_price: float
    source: str
    revenue_delta: Optional[float]
    created_at: str


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/repricing", tags=["repricing"])


def _to_float(v: Optional[Decimal]) -> Optional[float]:
    return float(v) if v is not None else None


@router.get("", response_model=RepriceListOut)
async def list_repricing(
    merchant: Merchant = Depends(_cipher),
    session: AsyncSession = Depends(get_db),
) -> RepriceListOut:
    sku_rows = list(
        (await session.execute(
            select(SKU).where(SKU.merchant_id == merchant.id, SKU.active.is_(True))
            .order_by(SKU.created_at.desc())
        )).scalars().all()
    )

    # Latest signal (with a suggestion) per SKU — fetch recent signals, pick first per sku.
    sku_ids = [s.id for s in sku_rows]
    latest_by_sku: dict[uuid.UUID, Signal] = {}
    if sku_ids:
        sig_rows = list(
            (await session.execute(
                select(Signal)
                .where(Signal.sku_id.in_(sku_ids))
                .order_by(Signal.created_at.desc())
            )).scalars().all()
        )
        for sig in sig_rows:
            latest_by_sku.setdefault(sig.sku_id, sig)

    out: list[RepriceSKUOut] = []
    for s in sku_rows:
        sig = latest_by_sku.get(s.id)
        out.append(RepriceSKUOut(
            id=str(s.id),
            title=s.title,
            current_price=_to_float(s.current_price),
            floor_price=_to_float(s.floor_price),
            ceiling_price=_to_float(s.ceiling_price),
            currency=getattr(s, "currency", None) or "USD",
            auto_reprice_enabled=s.auto_reprice_enabled,
            latest_suggestion=LatestSuggestion(
                type=sig.type,
                price_suggestion=_to_float(sig.price_suggestion),
                confidence=float(sig.confidence),
                created_at=sig.created_at.isoformat(),
            ) if sig else None,
        ))

    return RepriceListOut(
        global_auto_reprice_enabled=merchant.auto_reprice_enabled,
        skus=out,
    )


@router.patch("/settings", response_model=RepriceListOut)
async def update_settings(
    body: SettingsPatch,
    merchant: Merchant = Depends(_cipher),
    session: AsyncSession = Depends(get_db),
) -> RepriceListOut:
    merchant.auto_reprice_enabled = body.auto_reprice_enabled
    await session.commit()
    return await list_repricing(merchant, session)


@router.patch("/sku/{sku_id}", response_model=RepriceSKUOut)
async def update_sku_reprice(
    sku_id: uuid.UUID,
    body: SKURepricePatch,
    merchant: Merchant = Depends(_cipher),
    session: AsyncSession = Depends(get_db),
) -> RepriceSKUOut:
    sku = await session.get(SKU, sku_id)
    if sku is None or sku.merchant_id != merchant.id:
        raise HTTPException(404, detail={"error": "sku_not_found"})

    if body.floor_price is not None:
        sku.floor_price = body.floor_price
    if body.ceiling_price is not None:
        sku.ceiling_price = body.ceiling_price
    if body.auto_reprice_enabled is not None:
        sku.auto_reprice_enabled = body.auto_reprice_enabled

    # Guardrail: floor must not exceed ceiling when both are set.
    if (
        sku.floor_price is not None
        and sku.ceiling_price is not None
        and sku.floor_price > sku.ceiling_price
    ):
        raise HTTPException(
            422,
            detail={"error": "invalid_bounds", "message": "Floor price cannot exceed ceiling price"},
        )

    await session.commit()
    await session.refresh(sku)

    return RepriceSKUOut(
        id=str(sku.id),
        title=sku.title,
        current_price=_to_float(sku.current_price),
        floor_price=_to_float(sku.floor_price),
        ceiling_price=_to_float(sku.ceiling_price),
        currency=getattr(sku, "currency", None) or "USD",
        auto_reprice_enabled=sku.auto_reprice_enabled,
        latest_suggestion=None,
    )


@router.get("/changes", response_model=list[PriceChangeOut])
async def price_change_history(
    merchant: Merchant = Depends(_cipher),
    session: AsyncSession = Depends(get_db),
) -> list[PriceChangeOut]:
    rows = (await session.execute(
        select(PriceChange, SKU.title)
        .join(SKU, PriceChange.sku_id == SKU.id)
        .where(SKU.merchant_id == merchant.id)
        .order_by(PriceChange.created_at.desc())
        .limit(100)
    )).all()

    return [
        PriceChangeOut(
            id=str(pc.id),
            sku_id=str(pc.sku_id),
            sku_title=title,
            old_price=float(pc.old_price),
            new_price=float(pc.new_price),
            source=pc.source,
            revenue_delta=_to_float(pc.revenue_delta),
            created_at=pc.created_at.isoformat(),
        )
        for pc, title in rows
    ]

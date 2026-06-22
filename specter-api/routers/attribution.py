"""
Revenue attribution routes (F8, PHANTOM+ gated via the `attribution` feature).

Routes (all require PHANTOM+):
  GET /attribution/chart?days=30   — daily revenue_delta series + recovered/lost totals
  GET /attribution/export.csv      — CSV download (date, sku, old_price, new_price, revenue_delta)
"""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import plan_gate
from db import get_db
from models.merchants import Merchant
from models.price_changes import PriceChange
from models.skus import SKU
from routers.signals import RangeExceedsPlan, _history_window_days, resolve_history_range
from services.attribution import daily_attribution

# PHANTOM+ gate.
_phantom = plan_gate("attribution")


class DailyPoint(BaseModel):
    date: str
    revenue_delta: float


class AttributionChartOut(BaseModel):
    series: list[DailyPoint]
    total_recovered: float
    total_lost: float
    net: float


router = APIRouter(prefix="/attribution", tags=["attribution"])


@router.get("/chart", response_model=AttributionChartOut)
async def attribution_chart(
    days: int = Query(30, ge=1, le=90),
    date_from: Optional[date] = Query(None, description="Start of range (ISO date); PREDATOR+ up to 90 days back, else 30"),
    date_to: Optional[date] = Query(None, description="End of range (ISO date); defaults to now"),
    merchant: Merchant = Depends(_phantom),
    session: AsyncSession = Depends(get_db),
) -> AttributionChartOut:
    now = datetime.now(tz=timezone.utc)
    if date_from is not None or date_to is not None:
        try:
            start, _ = resolve_history_range(merchant.plan, date_from, date_to, now)
        except RangeExceedsPlan as exc:
            raise HTTPException(400, detail={"error": "range_exceeds_plan", "max_days": exc.max_days})
        effective_days = max(1, (now.date() - start.date()).days)
    else:
        # Legacy trailing-window param, capped by the plan's max lookback.
        effective_days = min(days, _history_window_days(merchant.plan))

    series = await daily_attribution(session, merchant.id, days=effective_days)

    recovered = sum(p.revenue_delta for p in series if p.revenue_delta > 0)
    lost = sum(p.revenue_delta for p in series if p.revenue_delta < 0)

    return AttributionChartOut(
        series=[DailyPoint(date=p.date, revenue_delta=p.revenue_delta) for p in series],
        total_recovered=round(recovered, 2),
        total_lost=round(lost, 2),
        net=round(recovered + lost, 2),
    )


@router.get("/export.csv")
async def attribution_csv(
    merchant: Merchant = Depends(_phantom),
    session: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    rows = (await session.execute(
        select(PriceChange, SKU.title)
        .join(SKU, PriceChange.sku_id == SKU.id)
        .where(SKU.merchant_id == merchant.id, PriceChange.source.in_(("auto", "manual")))
        .order_by(PriceChange.created_at.desc())
    )).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["date", "sku", "old_price", "new_price", "revenue_delta"])
    for pc, title in rows:
        writer.writerow([
            pc.created_at.date().isoformat(),
            title,
            f"{pc.old_price:.2f}",
            f"{pc.new_price:.2f}",
            f"{pc.revenue_delta:.2f}" if pc.revenue_delta is not None else "",
        ])
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="attribution.csv"'},
    )

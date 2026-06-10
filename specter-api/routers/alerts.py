"""
OOS alert log routes (F5).

Routes:
  GET   /alerts               — alert list (active + resolved), newest first
  PATCH /alerts/{id}/silence  — silence/unsilence OOS alerts for the alert's
                                competitor tracking (F5 AC#6)

Alerts auto-resolve when a competitor restocks — that transition is written by
the signal engine's oos_detector (F5 AC#5); this router only reads + silences.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.supabase import get_current_merchant
from db import get_db
from models.competitor_trackings import CompetitorTracking
from models.competitor_urls import CompetitorURL
from models.merchants import Merchant
from models.oos_alerts import OOSAlert
from models.skus import SKU


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: str
    competitor_tracking_id: str
    sku_id: str
    sku_title: str
    competitor_domain: str
    competitor_url: str
    detected_at: str
    resolved_at: str | None
    notified_at: str | None
    silenced: bool
    status: str  # "active" | "resolved"


class AlertListOut(BaseModel):
    items: list[AlertOut]
    active_count: int


class SilencePatch(BaseModel):
    silenced: bool


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertListOut)
async def list_alerts(
    status: str | None = Query(None, description="Filter by active | resolved"),
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> AlertListOut:
    base = (
        select(OOSAlert, SKU.title, CompetitorURL, CompetitorTracking)
        .join(CompetitorTracking, OOSAlert.competitor_tracking_id == CompetitorTracking.id)
        .join(SKU, OOSAlert.sku_id == SKU.id)
        .join(CompetitorURL, CompetitorTracking.competitor_url_id == CompetitorURL.id)
        .where(CompetitorTracking.merchant_id == merchant.id)
    )
    if status == "active":
        base = base.where(OOSAlert.resolved_at.is_(None))
    elif status == "resolved":
        base = base.where(OOSAlert.resolved_at.is_not(None))

    rows = (await session.execute(base.order_by(OOSAlert.detected_at.desc()))).all()

    items: list[AlertOut] = []
    active_count = 0
    for alert, sku_title, cu, tracking in rows:
        is_active = alert.resolved_at is None
        if is_active:
            active_count += 1
        items.append(AlertOut(
            id=str(alert.id),
            competitor_tracking_id=str(alert.competitor_tracking_id),
            sku_id=str(alert.sku_id),
            sku_title=sku_title,
            competitor_domain=cu.domain,
            competitor_url=f"https://{cu.domain}{cu.url_path}",
            detected_at=alert.detected_at.isoformat(),
            resolved_at=alert.resolved_at.isoformat() if alert.resolved_at else None,
            notified_at=alert.notified_at.isoformat() if alert.notified_at else None,
            silenced=tracking.silenced_oos,
            status="active" if is_active else "resolved",
        ))

    return AlertListOut(items=items, active_count=active_count)


@router.patch("/{alert_id}/silence", response_model=AlertOut)
async def silence_alert(
    alert_id: uuid.UUID,
    body: SilencePatch,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> AlertOut:
    """
    Silence (or unsilence) OOS alerts for the competitor tracking behind this
    alert. Sets competitor_trackings.silenced_oos so future OOS transitions for
    that URL do not create new alerts (F5 AC#6).
    """
    alert = await session.get(OOSAlert, alert_id)
    if alert is None:
        raise HTTPException(404, detail={"error": "alert_not_found"})

    tracking = await session.get(CompetitorTracking, alert.competitor_tracking_id)
    if tracking is None or tracking.merchant_id != merchant.id:
        raise HTTPException(404, detail={"error": "alert_not_found"})

    tracking.silenced_oos = body.silenced
    await session.commit()

    sku = await session.get(SKU, alert.sku_id)
    cu = await session.get(CompetitorURL, tracking.competitor_url_id)

    return AlertOut(
        id=str(alert.id),
        competitor_tracking_id=str(alert.competitor_tracking_id),
        sku_id=str(alert.sku_id),
        sku_title=sku.title if sku else "",
        competitor_domain=cu.domain if cu else "",
        competitor_url=f"https://{cu.domain}{cu.url_path}" if cu else "",
        detected_at=alert.detected_at.isoformat(),
        resolved_at=alert.resolved_at.isoformat() if alert.resolved_at else None,
        notified_at=alert.notified_at.isoformat() if alert.notified_at else None,
        silenced=tracking.silenced_oos,
        status="active" if alert.resolved_at is None else "resolved",
    )

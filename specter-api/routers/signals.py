"""
Signal feed + dashboard summary routes (F4, F6).

Routes:
  GET /signals          — paginated signal list for the merchant (newest first)
  GET /signals/summary  — dashboard overview stats:
                          RAISE/LOWER/HOLD counts (last 24hr),
                          revenue recovered MTD, active OOS count

Signals link to a merchant via signals.sku_id → skus.merchant_id.
The visible history window depends on plan (F9): 90 days for PREDATOR+, else 30.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.supabase import get_current_merchant
from db import get_db
from models.competitor_trackings import CompetitorTracking
from models.merchants import Merchant
from models.oos_alerts import OOSAlert
from models.price_changes import PriceChange
from models.signals import Signal
from models.skus import SKU

# Plans with 90-day signal history (F9 history_90d feature gate).
_HISTORY_90D_PLANS = frozenset({"predator", "eclipse"})


def _history_window_days(plan: str) -> int:
    return 90 if plan.lower() in _HISTORY_90D_PLANS else 30


class RangeExceedsPlan(Exception):
    """A requested date_from is further back than the merchant's plan allows."""

    def __init__(self, max_days: int) -> None:
        self.max_days = max_days


def resolve_history_range(
    plan: str,
    date_from: Optional[date],
    date_to: Optional[date],
    now: datetime,
) -> tuple[datetime, datetime]:
    """Resolve the [start, end] query window, enforcing the plan's lookback cap.

    PREDATOR/ECLIPSE may look back up to 90 days; every other plan is capped at
    30. A `date_from` beyond the cap raises RangeExceedsPlan (→ 400). With no
    explicit range we keep the existing trailing-window behaviour.
    """
    max_days = _history_window_days(plan)
    if date_from is not None:
        if (now.date() - date_from).days > max_days:
            raise RangeExceedsPlan(max_days)
        start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    else:
        start = now - timedelta(days=max_days)
    end = datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to is not None else now
    return start, end


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SignalOut(BaseModel):
    id: str
    sku_id: str
    sku_title: str
    type: str            # RAISE | LOWER | HOLD
    confidence: float
    reasoning: str | None
    price_suggestion: float | None
    current_price: float | None  # from the SKU join
    source: str          # ai | rule
    ai_fallback: bool
    created_at: str


class SignalTypeCounts(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    raise_: int = Field(0, alias="raise")
    lower: int = 0
    hold: int = 0


class SignalListOut(BaseModel):
    items: list[SignalOut]
    total: int
    limit: int
    offset: int
    counts: SignalTypeCounts


class SignalSummaryOut(BaseModel):
    raise_24h: int
    lower_24h: int
    hold_24h: int
    revenue_recovered_mtd: float
    active_oos_count: int


def _signal_counts(rows: list[tuple[str, int]]) -> SignalTypeCounts:
    """Map GROUP BY Signal.type rows -> per-type counts (missing types -> 0)."""
    by_type = {str(t): int(n) for t, n in rows}
    return SignalTypeCounts(
        raise_=by_type.get("RAISE", 0),
        lower=by_type.get("LOWER", 0),
        hold=by_type.get("HOLD", 0),
    )


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("", response_model=SignalListOut)
async def list_signals(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: str | None = Query(None, description="Filter by RAISE | LOWER | HOLD"),
    sort: Literal["recent", "confidence"] = Query("recent"),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    date_from: Optional[date] = Query(None, description="Start of range (ISO date); PREDATOR+ up to 90 days back, else 30"),
    date_to: Optional[date] = Query(None, description="End of range (ISO date); defaults to now"),
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SignalListOut:
    try:
        window_start, window_end = resolve_history_range(
            merchant.plan, date_from, date_to, datetime.now(tz=timezone.utc)
        )
    except RangeExceedsPlan as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "range_exceeds_plan", "max_days": exc.max_days},
        )

    # Shared base: merchant-scoped + history window + confidence threshold.
    base = (
        select(Signal, SKU.title, SKU.current_price)
        .join(SKU, Signal.sku_id == SKU.id)
        .where(
            SKU.merchant_id == merchant.id,
            Signal.created_at >= window_start,
            Signal.created_at <= window_end,
            Signal.confidence >= min_confidence,
        )
    )

    typed = base.where(Signal.type == type.upper()) if type else base

    # Total count (for pagination UI), respecting the active type filter.
    count_stmt = select(func.count()).select_from(typed.subquery())
    total = (await session.execute(count_stmt)).scalar_one()

    if sort == "confidence":
        order = (Signal.confidence.desc(), Signal.created_at.desc())
    else:
        order = (Signal.created_at.desc(),)
    page_stmt = typed.order_by(*order).limit(limit).offset(offset)
    rows = (await session.execute(page_stmt)).all()

    items = [
        SignalOut(
            id=str(sig.id),
            sku_id=str(sig.sku_id),
            sku_title=title,
            type=sig.type,
            confidence=float(sig.confidence),
            reasoning=sig.reasoning,
            price_suggestion=float(sig.price_suggestion) if sig.price_suggestion is not None else None,
            current_price=float(current_price) if current_price is not None else None,
            source=sig.source,
            ai_fallback=sig.ai_fallback,
            created_at=sig.created_at.isoformat(),
        )
        for sig, title, current_price in rows
    ]

    # Per-type counts over the same window + threshold, ignoring the type filter
    # so every tab can show its true total.
    counts_stmt = (
        select(Signal.type, func.count())
        .join(SKU, Signal.sku_id == SKU.id)
        .where(
            SKU.merchant_id == merchant.id,
            Signal.created_at >= window_start,
            Signal.created_at <= window_end,
            Signal.confidence >= min_confidence,
        )
        .group_by(Signal.type)
    )
    counts = _signal_counts((await session.execute(counts_stmt)).all())

    return SignalListOut(
        items=items, total=total, limit=limit, offset=offset, counts=counts
    )


@router.get("/summary", response_model=SignalSummaryOut)
async def signal_summary(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SignalSummaryOut:
    now = datetime.now(tz=timezone.utc)
    since_24h = now - timedelta(hours=24)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── 24hr signal counts by type ────────────────────────────────────────────
    counts_stmt = (
        select(Signal.type, func.count())
        .join(SKU, Signal.sku_id == SKU.id)
        .where(
            SKU.merchant_id == merchant.id,
            Signal.created_at >= since_24h,
        )
        .group_by(Signal.type)
    )
    counts = {row[0]: row[1] for row in (await session.execute(counts_stmt)).all()}

    # ── Revenue recovered MTD (auto repricer rows only; F6 AC#2) ───────────────
    revenue_stmt = (
        select(func.coalesce(func.sum(PriceChange.revenue_delta), 0))
        .join(SKU, PriceChange.sku_id == SKU.id)
        .where(
            SKU.merchant_id == merchant.id,
            PriceChange.source == "auto",
            PriceChange.created_at >= month_start,
        )
    )
    revenue_mtd: Decimal = (await session.execute(revenue_stmt)).scalar_one()

    # ── Active OOS count (resolved_at IS NULL) ─────────────────────────────────
    oos_stmt = (
        select(func.count())
        .select_from(OOSAlert)
        .join(CompetitorTracking, OOSAlert.competitor_tracking_id == CompetitorTracking.id)
        .where(
            CompetitorTracking.merchant_id == merchant.id,
            OOSAlert.resolved_at.is_(None),
        )
    )
    active_oos = (await session.execute(oos_stmt)).scalar_one()

    return SignalSummaryOut(
        raise_24h=counts.get("RAISE", 0),
        lower_24h=counts.get("LOWER", 0),
        hold_24h=counts.get("HOLD", 0),
        revenue_recovered_mtd=float(revenue_mtd or 0),
        active_oos_count=active_oos,
    )

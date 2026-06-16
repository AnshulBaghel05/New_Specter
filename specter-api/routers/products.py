"""
Products workspace — aggregated read endpoint (GET /products).

Returns the product-centric tree: each product → its enabled competitor
trackings (+ latest price snapshot) → the product's latest signal, plus the
merchant's SKU usage counters. Read-only; no schema changes.

SKU = one (product × competitor) pairing. Limit = COUNT(enabled trackings).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, PlainSerializer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import competitor_limit_for, plan_max_skus
from auth.supabase import get_current_merchant
from db import get_db
from models.competitor_trackings import CompetitorTracking
from models.competitor_urls import CompetitorURL
from models.merchants import Merchant
from models.price_snapshots import PriceSnapshot
from models.signals import Signal
from models.skus import SKU
from services.scrape_scheduler import PLAN_INTERVALS_MS

router = APIRouter(prefix="/products", tags=["products"])


# ── Schemas ──────────────────────────────────────────────────────────────────

# Pydantic v2 serializes a bare Decimal to a JSON *string*. The dashboard reads
# these as numbers (arithmetic + .toFixed), so this read surface emits JSON
# numbers. `Money` keeps Decimal precision in Python but serializes to float.
Money = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]


class CompetitorRow(BaseModel):
    tracking_id: uuid.UUID
    competitor_url_id: uuid.UUID
    url: str
    domain: str
    enabled: bool
    silenced_oos: bool
    robots_blocked: bool
    latest_price: Optional[Money]
    in_stock: Optional[bool]
    last_checked_at: Optional[str]
    # Per-URL scrape health, derived from DB state (no extra query): one of
    # live | stale | failing | pending | blocked, plus a human label.
    status: str
    status_label: str


def derive_competitor_status(
    *,
    robots_blocked: bool,
    last_dispatch_at: Optional[datetime],
    has_price: bool,
    plan_interval_ms: int,
    now: datetime,
) -> tuple[str, str]:
    """Turn a tracked URL's persisted state into a user-facing scrape status —
    so a silently-failing or blocked competitor is visible, not a stale price.
    Returns (status, label). Pure (no I/O), so it's unit-tested directly.

    Freshness is judged on the last DISPATCH, never the last snapshot: with the
    skip-unchanged write optimization a healthy-but-stable URL keeps an old
    snapshot, so snapshot age would falsely read "stale".
    """
    if robots_blocked:
        return "blocked", "Blocked by robots.txt or bot protection"
    if not has_price:
        if last_dispatch_at is None:
            return "pending", "Queued — first check in progress"
        return "failing", "Checked, but no price could be read yet"
    # Has at least one good price.
    if last_dispatch_at is None:
        return "live", "Tracking normally"
    stale_after = timedelta(milliseconds=max(plan_interval_ms, 1) * 2)
    if now - last_dispatch_at > stale_after:
        return "stale", "Checks are overdue — last fetch is older than expected"
    return "live", "Tracking normally"


class LatestSignal(BaseModel):
    type: str
    price_suggestion: Optional[Money]
    confidence: Money
    created_at: str


class ProductOut(BaseModel):
    id: uuid.UUID
    title: str
    handle: Optional[str]
    current_price: Optional[Money]
    source: str
    active: bool
    floor_price: Optional[Money]
    ceiling_price: Optional[Money]
    competitor_count: int
    latest_signal: Optional[LatestSignal]
    competitors: list[CompetitorRow]


class ProductsOut(BaseModel):
    items: list[ProductOut]
    total: int                     # total products for the merchant (for pagination)
    sku_used: int
    sku_limit: Optional[int]
    max_competitors_per_sku: Optional[int]


# Max products returned in one page. 2000 = the largest self-serve plan SKU ceiling
# (PREDATOR), so every self-serve merchant still gets their whole catalog in one
# call. It only caps ECLIPSE (unlimited SKUs), bounding the response size and the
# IN() lists below so this read never scales without limit. Use offset for the rest.
PRODUCTS_PAGE_MAX = 2000


# ── Pure builder (unit-tested without a DB) ──────────────────────────────────

def assemble_products(
    *,
    skus,
    trackings,
    url_by_id,
    snapshot_by_url,
    signal_by_sku,
    total: int,
    sku_used: int,
    sku_limit: Optional[int],
    max_competitors_per_sku: Optional[int],
    plan_interval_ms: int,
    now: datetime,
) -> ProductsOut:
    """Build the ProductsOut tree from already-fetched rows / lookup dicts.

    `trackings` must already be filtered to enabled rows. Reads attributes only,
    so plain objects (e.g. SimpleNamespace) work in tests.
    """
    trackings_by_product: dict[uuid.UUID, list] = {}
    for t in trackings:
        trackings_by_product.setdefault(t.own_product_id, []).append(t)

    items: list[ProductOut] = []
    for sku in skus:
        rows: list[CompetitorRow] = []
        for t in trackings_by_product.get(sku.id, []):
            url = url_by_id.get(t.competitor_url_id)
            snap = snapshot_by_url.get(t.competitor_url_id)
            # Freshness reflects the last actual CHECK (per-URL last_scraped_at,
            # maintained at dispatch), so it stays accurate when an unchanged
            # scrape is skip-written (no new snapshot row). Fall back to the
            # latest snapshot's scraped_at when the URL has no recorded check yet.
            last_dispatch = getattr(url, "last_scraped_at", None) if url else None
            last_checked = last_dispatch
            if last_checked is None and snap is not None:
                last_checked = snap.scraped_at
            robots_blocked = url.robots_blocked if url else False
            has_price = snap is not None and snap.price is not None
            status, status_label = derive_competitor_status(
                robots_blocked=robots_blocked,
                last_dispatch_at=last_dispatch,
                has_price=has_price,
                plan_interval_ms=plan_interval_ms,
                now=now,
            )
            rows.append(CompetitorRow(
                tracking_id=t.id,
                competitor_url_id=t.competitor_url_id,
                url=f"https://{url.domain}{url.url_path}" if url else "",
                domain=url.domain if url else "",
                enabled=t.enabled,
                silenced_oos=t.silenced_oos,
                robots_blocked=robots_blocked,
                latest_price=snap.price if snap else None,
                in_stock=snap.in_stock if snap else None,
                last_checked_at=last_checked.isoformat() if last_checked else None,
                status=status,
                status_label=status_label,
            ))
        sig = signal_by_sku.get(sku.id)
        latest = LatestSignal(
            type=sig.type,
            price_suggestion=sig.price_suggestion,
            confidence=sig.confidence,
            created_at=sig.created_at.isoformat(),
        ) if sig else None
        items.append(ProductOut(
            id=sku.id,
            title=sku.title,
            handle=sku.handle,
            current_price=sku.current_price,
            source="shopify" if sku.shopify_variant_id else "manual",
            active=sku.active,
            floor_price=sku.floor_price,
            ceiling_price=sku.ceiling_price,
            competitor_count=len(rows),
            latest_signal=latest,
            competitors=rows,
        ))
    return ProductsOut(
        items=items,
        total=total,
        sku_used=sku_used,
        sku_limit=sku_limit,
        max_competitors_per_sku=max_competitors_per_sku,
    )


# ── Route handler ─────────────────────────────────────────────────────────────

@router.get("", response_model=ProductsOut)
async def list_products(
    limit: int = Query(PRODUCTS_PAGE_MAX, ge=1, le=PRODUCTS_PAGE_MAX),
    offset: int = Query(0, ge=0),
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> ProductsOut:
    # 0. Total product count (for pagination); bounds nothing else.
    total = (await session.execute(
        select(func.count()).where(SKU.merchant_id == merchant.id)
    )).scalar_one()

    # 1. Products — ONE page only. Capped so an ECLIPSE (unlimited-SKU) catalog
    #    can't make this read — and the IN() lists below — grow without bound.
    skus = list((await session.execute(
        select(SKU)
        .where(SKU.merchant_id == merchant.id)
        .order_by(SKU.created_at.desc())
        .limit(limit)
        .offset(offset)
    )).scalars().all())
    sku_ids = [s.id for s in skus]

    # 2. Enabled trackings for THIS PAGE's products only (bounds the fan-out so a
    #    large catalog never loads every tracking at once).
    trackings = list((await session.execute(
        select(CompetitorTracking).where(
            CompetitorTracking.merchant_id == merchant.id,
            CompetitorTracking.enabled.is_(True),
            CompetitorTracking.own_product_id.in_(sku_ids),
        )
    )).scalars().all()) if sku_ids else []

    # 3. Competitor URLs referenced
    url_ids = list({t.competitor_url_id for t in trackings})
    url_by_id: dict[uuid.UUID, CompetitorURL] = {}
    if url_ids:
        for u in (await session.execute(
            select(CompetitorURL).where(CompetitorURL.id.in_(url_ids))
        )).scalars().all():
            url_by_id[u.id] = u

    # 4. Latest snapshot per URL (newest scraped_at wins).
    #    DISTINCT ON keeps ONE row per URL in the DB so this fetches at most
    #    one snapshot per tracked URL — not the entire (unbounded, ever-growing)
    #    price_snapshots history, which would make this read scale with retention.
    snapshot_by_url: dict[uuid.UUID, PriceSnapshot] = {}
    if url_ids:
        snaps = (await session.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.competitor_url_id.in_(url_ids))
            .order_by(PriceSnapshot.competitor_url_id, PriceSnapshot.scraped_at.desc())
            .distinct(PriceSnapshot.competitor_url_id)
        )).scalars().all()
        for s in snaps:
            snapshot_by_url.setdefault(s.competitor_url_id, s)  # one row per URL = newest

    # 5. Latest signal per product (newest created_at wins). DISTINCT ON bounds
    #    this to one signal per SKU instead of the full signals history.
    signal_by_sku: dict[uuid.UUID, Signal] = {}
    if sku_ids:
        sigs = (await session.execute(
            select(Signal)
            .where(Signal.sku_id.in_(sku_ids))
            .order_by(Signal.sku_id, Signal.created_at.desc())
            .distinct(Signal.sku_id)
        )).scalars().all()
        for sig in sigs:
            signal_by_sku.setdefault(sig.sku_id, sig)  # one row per SKU = newest

    # 6. SKU usage = enabled tracking count
    sku_used = (await session.execute(
        select(func.count()).where(
            CompetitorTracking.merchant_id == merchant.id,
            CompetitorTracking.enabled.is_(True),
        )
    )).scalar_one()

    # Per-URL freshness is judged against the merchant's plan cadence (ECLIPSE uses
    # its merchant-configured interval).
    plan = (merchant.plan or "recon").lower()
    plan_interval_ms = (
        merchant.eclipse_interval_ms if plan == "eclipse"
        else PLAN_INTERVALS_MS.get(plan, PLAN_INTERVALS_MS["recon"])
    )

    return assemble_products(
        skus=skus,
        trackings=trackings,
        url_by_id=url_by_id,
        snapshot_by_url=snapshot_by_url,
        signal_by_sku=signal_by_sku,
        total=total,
        sku_used=sku_used,
        sku_limit=plan_max_skus(merchant.plan),
        max_competitors_per_sku=competitor_limit_for(merchant.plan, merchant.max_competitors_per_sku),
        plan_interval_ms=plan_interval_ms,
        now=datetime.now(tz=timezone.utc),
    )

"""
Competitor URL management routes (F2).

Routes:
  GET    /competitors                          — list all trackings
  POST   /competitors                          — add tracking; enforces plan limits; queues probe immediately
  DELETE /competitors/{tracking_id}            — disable tracking (soft delete)
  PATCH  /competitors/{tracking_id}/silence-oos — toggle OOS alert silencing

SKU model:
  1 SKU = one (own_product -> competitor URL) link = one enabled competitor_tracking row
        = one competitor-URL scrape per refresh cycle.
  A merchant's SKU usage = COUNT(enabled trackings) = competitor scrapes per cycle.
  (e.g. 100 products x 1 competitor = 100 SKUs; 33 products x 3 competitors = 99 SKUs.)

Plan enforcement (server-side only — frontend shows meters but backend is the gate):
  1. Total enabled competitor_trackings for merchant < plan_max_skus(plan)        → else 402
  2. Enabled trackings for own_product < competitor_limit_for(plan, override)      → else 402
     (limit is plan-driven; ECLIPSE uses its custom max_competitors_per_sku column)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import competitor_limit_for, plan_max_skus
from auth.supabase import get_current_merchant
from db import get_db
from rate_limit import rate_limit_dependency
from services.url_safety import is_safe_competitor_url
from models.competitor_trackings import CompetitorTracking
from models.competitor_urls import CompetitorURL
from models.merchants import Merchant
from models.skus import SKU
from queue_client import enqueue_probe_job
from redis_client import redis as redis_client
from services.dispatcher import refresh_url_schedule

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CompetitorAdd(BaseModel):
    url: str
    own_product_id: uuid.UUID

    @field_validator("url")
    @classmethod
    def must_be_http(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v.rstrip("/")


class TrackingOut(BaseModel):
    id: uuid.UUID
    own_product_id: uuid.UUID
    competitor_url_id: uuid.UUID
    merchant_id: uuid.UUID
    enabled: bool
    silenced_oos: bool
    url: str          # full URL reconstructed from competitor_urls
    domain: str
    robots_blocked: bool

    model_config = {"from_attributes": False}


class SilenceOOSPatch(BaseModel):
    silenced_oos: bool


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/competitors", tags=["competitors"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _merchant_lock_key(merchant_id: uuid.UUID) -> int:
    """Stable signed 64-bit key for pg_advisory_xact_lock from a merchant UUID.

    The lock serializes a merchant's concurrent `add_competitor` calls so the
    SKU/competitor count→insert is atomic — without it two parallel POSTs both
    read `used < limit` and overshoot the plan ceiling (an unpaid scrape-cost
    leak). The lock is transaction-scoped (auto-released on commit/rollback).
    """
    return int.from_bytes(merchant_id.bytes[:8], "big", signed=True)


def _parse_url(raw_url: str) -> tuple[str, str]:
    """Return (domain, url_path) from a URL string."""
    parsed = urlparse(raw_url)
    domain = parsed.netloc.lower()
    url_path = parsed.path or "/"
    if parsed.query:
        url_path = f"{url_path}?{parsed.query}"
    return domain, url_path


async def _check_url_reachable(url: str) -> bool:
    """
    HEAD request to verify the URL is publicly reachable.
    Returns False on connection error or non-2xx/3xx response.
    Robots.txt checks happen during the actual probe job — this is just
    a basic reachability check.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.head(
                url,
                headers={"User-Agent": "Mozilla/5.0 Specter-Verify/1.0"},
            )
        # Accept 2xx, 3xx, 405 (HEAD not allowed but server responded)
        return resp.status_code < 500
    except (httpx.ConnectError, httpx.TimeoutException, httpx.RequestError):
        return False


async def _build_tracking_out(tracking: CompetitorTracking, session: AsyncSession) -> TrackingOut:
    cu = await session.get(CompetitorURL, tracking.competitor_url_id)
    url = f"https://{cu.domain}{cu.url_path}" if cu else ""
    return TrackingOut(
        id=tracking.id,
        own_product_id=tracking.own_product_id,
        competitor_url_id=tracking.competitor_url_id,
        merchant_id=tracking.merchant_id,
        enabled=tracking.enabled,
        silenced_oos=tracking.silenced_oos,
        url=url,
        domain=cu.domain if cu else "",
        robots_blocked=cu.robots_blocked if cu else False,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[TrackingOut])
async def list_competitors(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> list[TrackingOut]:
    stmt = (
        select(CompetitorTracking)
        .where(CompetitorTracking.merchant_id == merchant.id)
        .order_by(CompetitorTracking.created_at.desc())
    )
    trackings = list((await session.execute(stmt)).scalars().all())
    return [await _build_tracking_out(t, session) for t in trackings]


@router.post(
    "",
    response_model=TrackingOut,
    status_code=status.HTTP_201_CREATED,
    # Anti-spam on the cost-incurring endpoint (each add enqueues a scrape).
    dependencies=[Depends(rate_limit_dependency("20/minute", "competitors_post"))],
)
async def add_competitor(
    body: CompetitorAdd,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> TrackingOut:
    """
    Add a competitor tracking for one of the merchant's own products.

    Enforcement order (server-side only):
      1. Own product must belong to this merchant.
      2. Total active SKU count < plan limit  → else 402 sku_limit_reached.
      3. Competitors for this product < max_competitors_per_sku → else 402 competitor_limit_reached.
      4. Same URL already tracked for same product → 409 already_tracking.
      5. URL reachability check  → else 422.
      6. Upsert competitor_url, create competitor_tracking.
      7. Queue probe job immediately (F2 AC#4).
    """
    # 0. SSRF guard — reject URLs that target internal/private infrastructure
    #    (cloud metadata, localhost, private/link-local ranges) before the
    #    scraper ever fetches them.
    safe, reason = is_safe_competitor_url(body.url)
    if not safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "unsafe_url", "reason": reason},
        )

    # 1. Validate own product ownership
    sku = await session.get(SKU, body.own_product_id)
    if sku is None or sku.merchant_id != merchant.id:
        raise HTTPException(404, detail={"error": "product_not_found"})

    # 1b. Serialize concurrent adds for THIS merchant so the limit count→insert
    #     below is atomic (transaction-scoped advisory lock; see _merchant_lock_key).
    #     Held until this request's commit/rollback.
    await session.execute(
        text("SELECT pg_advisory_xact_lock(:k)"),
        {"k": _merchant_lock_key(merchant.id)},
    )

    # 2. Total SKU (tracking) limit
    plan_limit = plan_max_skus(merchant.plan)
    if plan_limit is not None:
        total_stmt = select(func.count()).where(
            CompetitorTracking.merchant_id == merchant.id,
            CompetitorTracking.enabled.is_(True),
        )
        total_used = (await session.execute(total_stmt)).scalar_one()
        if total_used >= plan_limit:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "sku_limit_reached", "limit": plan_limit, "used": total_used},
            )

    # 3. Per-product competitor limit (plan-driven; ECLIPSE uses its custom column)
    per_product_limit = competitor_limit_for(merchant.plan, merchant.max_competitors_per_sku)
    if per_product_limit is not None:
        per_product_stmt = select(func.count()).where(
            CompetitorTracking.own_product_id == body.own_product_id,
            CompetitorTracking.enabled.is_(True),
        )
        per_product_used = (await session.execute(per_product_stmt)).scalar_one()
        if per_product_used >= per_product_limit:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "competitor_limit_reached",
                    "limit": per_product_limit,
                    "used":  per_product_used,
                },
            )

    domain, url_path = _parse_url(body.url)

    # 4. Duplicate check
    dup_stmt = (
        select(CompetitorTracking)
        .join(CompetitorURL, CompetitorTracking.competitor_url_id == CompetitorURL.id)
        .where(
            CompetitorTracking.own_product_id == body.own_product_id,
            CompetitorURL.domain == domain,
            CompetitorURL.url_path == url_path,
        )
    )
    if (await session.execute(dup_stmt)).scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "already_tracking",
                    "message": "This competitor URL is already tracked for this product"},
        )

    # 5. Reachability check
    if not await _check_url_reachable(body.url):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "url_unreachable",
                    "message": "Could not reach this URL — ensure it is public and accessible"},
        )

    # 6. Upsert competitor_url (one row per unique domain+path, shared across merchants)
    cu_stmt = select(CompetitorURL).where(
        CompetitorURL.domain == domain,
        CompetitorURL.url_path == url_path,
    )
    cu: Optional[CompetitorURL] = (await session.execute(cu_stmt)).scalar_one_or_none()
    if cu is None:
        cu = CompetitorURL(domain=domain, url_path=url_path)
        session.add(cu)
        await session.flush()  # assign cu.id

    # Create competitor_tracking (the billing unit)
    tracking = CompetitorTracking(
        own_product_id=body.own_product_id,
        competitor_url_id=cu.id,
        merchant_id=merchant.id,
    )
    session.add(tracking)
    await session.flush()  # assign tracking.id

    # Register/refresh this URL on the control-plane schedule so the dispatcher
    # picks it up for recurring shared crawls (cross-merchant + cross-plan dedup).
    await refresh_url_schedule(session, redis_client, cu, datetime.now(timezone.utc))

    await session.commit()
    await session.refresh(tracking)

    # 7. Queue probe job immediately (F2 AC#4 — not on next scheduled run)
    try:
        enqueue_probe_job(
            redis_client,
            url=body.url,
            domain=domain,
            url_path=url_path,
            competitor_tracking_ids=[str(tracking.id)],
            plan=merchant.plan,
        )
    except Exception:
        pass  # Redis down shouldn't fail the HTTP response; probe will run on next cycle

    return await _build_tracking_out(tracking, session)


@router.delete("/{tracking_id}", status_code=status.HTTP_204_NO_CONTENT,
               response_class=Response)
async def delete_competitor(
    tracking_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Disable a competitor tracking (soft delete — data retained)."""
    tracking = await session.get(CompetitorTracking, tracking_id)
    if tracking is None or tracking.merchant_id != merchant.id:
        raise HTTPException(404, detail={"error": "tracking_not_found"})

    tracking.enabled = False
    await session.flush()

    # Recompute the URL's schedule from its remaining enabled trackings — when the
    # last one is removed, refresh clears next_run_at so the dispatcher stops
    # scraping an untracked URL (no wasted crawls).
    cu = await session.get(CompetitorURL, tracking.competitor_url_id)
    if cu is not None:
        await refresh_url_schedule(session, redis_client, cu, datetime.now(timezone.utc))

    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{tracking_id}/silence-oos", response_model=TrackingOut)
async def silence_oos(
    tracking_id: uuid.UUID,
    body: SilenceOOSPatch,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> TrackingOut:
    """Toggle OOS alert silencing for a specific competitor tracking (F5 AC#6)."""
    tracking = await session.get(CompetitorTracking, tracking_id)
    if tracking is None or tracking.merchant_id != merchant.id:
        raise HTTPException(404, detail={"error": "tracking_not_found"})

    tracking.silenced_oos = body.silenced_oos
    await session.commit()
    await session.refresh(tracking)
    return await _build_tracking_out(tracking, session)

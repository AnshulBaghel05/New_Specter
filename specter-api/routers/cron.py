"""Scheduled-job trigger endpoints (invoked by an external scheduler, e.g. a
Railway cron, not by users or the scraper).

Separate from routers/internal.py because that router is globally HMAC-guarded
for the scraper; these jobs use a simpler Bearer-token guard (auth.cron_auth)
that a cron `curl` can send without body-signing. Same /internal prefix, distinct
paths — each router only carries its own auth dependency.

Every periodic job ships a runnable script (run_*.py) AND an endpoint here so a
single scheduler can drive them all over HTTP with one bearer token, instead of
standing up a separate worker service per script. Without a scheduler wired to
these, trials never expire, old snapshots never purge (storage cost leak), and
the daily cost rollup never persists.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from redis import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from auth.cron_auth import require_cron_auth
from db import get_db
from redis_client import get_redis
from services import fx
from services.attribution import run_attribution_backfill
from services.cost_ledger import flush_daily
from services.proxy_guard import run_proxy_guard
from services.retention import purge_expired_snapshots
from services.trial_monitor import run_trial_monitor

router = APIRouter(prefix="/internal", tags=["internal"], dependencies=[Depends(require_cron_auth)])


@router.post("/run-trial-monitor")
async def trigger_trial_monitor(session: AsyncSession = Depends(get_db)) -> dict:
    """Daily tick: send day-12/14 trial reminder emails, then downgrade every
    lapsed RECON trial back to free. Idempotent — reminders are calendar-day
    gated and the expiry sweep only touches trials past their end date, so
    re-running (or an overlapping cron) is safe."""
    result = await run_trial_monitor(session)
    return {"status": "ok", **result}


@router.post("/run-retention-purge")
async def trigger_retention_purge(session: AsyncSession = Depends(get_db)) -> dict:
    """Daily tick: delete price_snapshots past their effective plan retention
    (and any whose downgrade-grace delete_at has elapsed). Idempotent — only
    purges rows already past their cutoff, so re-running is safe. Without this
    scheduled, snapshots accumulate indefinitely (storage cost leak)."""
    deleted = await purge_expired_snapshots(session, datetime.now(timezone.utc))
    return {"status": "ok", "rows_deleted": deleted}


@router.post("/run-cost-flush")
async def trigger_cost_flush(
    day: str | None = Query(
        default=None,
        description="YYYY-MM-DD to flush; defaults to yesterday (UTC), matching the cron default.",
    ),
    session: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict:
    """Daily tick: roll the day's best-effort Redis cost counters into the
    durable merchant_cost_daily rollup (the billing source of truth). Defaults
    to YESTERDAY (UTC) so a post-midnight cron flushes the just-completed day.
    Idempotent — flush_daily upserts, never double-adds."""
    target = day or (datetime.now(timezone.utc).date() - timedelta(days=1)).strftime("%Y-%m-%d")
    written = await flush_daily(session, redis, target)
    return {"status": "ok", "day": target, "rows_upserted": written}


@router.post("/run-proxy-guard")
async def trigger_proxy_guard(redis: Redis = Depends(get_redis)) -> dict:
    """Hourly tick: compare today's global residential vs datacenter proxy spend
    and, on a budget breach (RESIDENTIAL_MAX_SHARE / RESIDENTIAL_MAX_USD_PER_DAY),
    alert ops once for the day. Best-effort — never raises, and the once-per-day
    dedup means an overlapping/repeated run won't spam ops. Run more often than the
    daily jobs (e.g. hourly) so a residential storm is caught the hour it starts."""
    result = await run_proxy_guard(redis, datetime.now(timezone.utc))
    return {"status": "ok", **result}


@router.post("/run-attribution")
async def trigger_attribution(session: AsyncSession = Depends(get_db)) -> dict:
    """Daily tick: fill revenue_delta for price changes whose 24h sales window has
    elapsed, using real Shopify Orders data. Idempotent (only un-attributed rows)
    and best-effort per change, so a single store's Shopify outage can't block the
    rest. Without this, the attribution chart stays empty."""
    result = await run_attribution_backfill(session)
    return {"status": "ok", **result}


@router.post("/run-fx-refresh")
async def trigger_fx_refresh(redis: Redis = Depends(get_redis)) -> dict:
    """Daily tick: pull live USD-base FX rates and cache them in Redis (24h TTL) so
    the signal engine normalizes competitor prices on fresh rates. Best-effort and
    self-healing — on any fetch failure the embedded static table stays in effect, so
    a missed run only means slightly stale rates, never broken signals."""
    rates = fx.refresh_usd_rates(redis)
    return {"status": "ok", "refreshed": rates is not None,
            "currencies": len(rates) if rates else 0}

"""Scheduled-job trigger endpoints (invoked by an external scheduler, e.g. a
Railway cron, not by users or the scraper).

Separate from routers/internal.py because that router is globally HMAC-guarded
for the scraper; these jobs use a simpler Bearer-token guard (auth.cron_auth)
that a cron `curl` can send without body-signing. Same /internal prefix, distinct
paths — each router only carries its own auth dependency.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from auth.cron_auth import require_cron_auth
from db import get_db
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

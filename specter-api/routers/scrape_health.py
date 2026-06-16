"""
Operator-only scrape-health reporting.

Routes (guarded by ADMIN_API_KEY via X-Admin-Key, NOT per-merchant JWT):
  GET /admin/scrape/health
      — parser success rate, crawl success rate, blocked/failed rates, and
        per-domain health (worst first) over rolling 24h / 7d / 30d windows,
        aggregated from the scrape_audit trail.

`_health_dep` is a patchable seam so tests can substitute the aggregation
without standing up a database (mirrors routers/cost.py).
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from auth.admin_auth import require_admin
from db import get_db
from services import scrape_health

router = APIRouter(prefix="/admin/scrape", tags=["admin-scrape"], dependencies=[Depends(require_admin)])


def _health_dep():
    """Patchable seam: returns the aggregation callable used by the endpoint."""
    return scrape_health.scrape_health


@router.get("/health")
async def get_scrape_health(
    db: AsyncSession = Depends(get_db),
    health=Depends(_health_dep),
) -> dict:
    windows = await health(db)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "windows": windows,
    }

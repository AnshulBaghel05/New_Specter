"""
Operator-only cost & margin reporting (Audit #4).

Routes (guarded by ADMIN_API_KEY via X-Admin-Key, NOT per-merchant JWT):
  GET /admin/cost/margin?from=YYYY-MM-DD&to=YYYY-MM-DD
      — per-merchant cost-to-serve vs modeled revenue over a date window,
        worst margin first, with portfolio totals.

`_margins_dep` is a patchable seam so tests can substitute the aggregation
without standing up a database.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from auth.admin_auth import require_admin
from db import get_db
from services import cost_margin

router = APIRouter(prefix="/admin/cost", tags=["admin-cost"], dependencies=[Depends(require_admin)])


def _margins_dep():
    """Patchable seam: returns the aggregation callable used by the endpoint."""
    return cost_margin.merchant_margins


@router.get("/margin")
async def get_margin(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    db: AsyncSession = Depends(get_db),
    margins=Depends(_margins_dep),
) -> dict:
    rows = await margins(db, date_from, date_to)
    totals = {
        "cost_to_serve": round(sum(r["cost_to_serve"] for r in rows), 6),
        "revenue": round(sum(r["revenue"] for r in rows), 2),
        "margin_negative": sum(1 for r in rows if r["margin_negative"]),
    }
    return {
        "from": date_from.isoformat(),
        "to": date_to.isoformat(),
        "count": len(rows),
        "totals": totals,
        "merchants": rows,
    }

"""Per-customer margin from the cost rollup (Audit #4). compute_margin is pure;
merchant_margins aggregates merchant_cost_daily over a window and joins the plan."""
from __future__ import annotations

import uuid
from datetime import date as date_t

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.competitor_trackings import CompetitorTracking
from models.merchant_cost_daily import MerchantCostDaily
from models.merchants import Merchant
from services import cost_model


def compute_margin(plan: str, costs: dict) -> dict:
    """Pure: given a plan and summed costs by type, return the margin record."""
    cost_to_serve = round(sum(float(v) for v in costs.values()), 6)
    revenue = cost_model.monthly_revenue_usd(plan)
    if revenue > 0:
        gross_margin = (revenue - cost_to_serve) / revenue
        margin_negative = cost_to_serve > revenue
    else:
        gross_margin = None                       # undefined with no modeled revenue
        margin_negative = cost_to_serve > 0       # any spend on a $0 plan is a loss
    return {
        "plan": plan,
        "revenue": revenue,
        "cost_to_serve": cost_to_serve,
        "by_type": {k: float(v) for k, v in costs.items()},
        "gross_margin": gross_margin,
        "margin_negative": margin_negative,
    }


async def merchant_margins(session: AsyncSession, date_from: date_t, date_to: date_t) -> list[dict]:
    """Aggregate cost by (merchant, cost_type) over [date_from, date_to], join the
    merchant's plan, and compute each margin record. Sorted worst-margin first."""
    stmt = (
        select(MerchantCostDaily.merchant_id, MerchantCostDaily.cost_type,
               func.sum(MerchantCostDaily.cost_usd))
        .where(MerchantCostDaily.date >= date_from, MerchantCostDaily.date <= date_to)
        .group_by(MerchantCostDaily.merchant_id, MerchantCostDaily.cost_type)
    )
    rows = (await session.execute(stmt)).all()

    by_merchant: dict[uuid.UUID, dict] = {}
    for merchant_id, cost_type, total in rows:
        by_merchant.setdefault(merchant_id, {})[cost_type] = float(total or 0)

    if not by_merchant:
        return []

    plans = dict((await session.execute(
        select(Merchant.id, Merchant.plan).where(Merchant.id.in_(list(by_merchant.keys())))
    )).all())

    out = []
    for merchant_id, costs in by_merchant.items():
        rec = compute_margin(plans.get(merchant_id, ""), costs)
        rec["merchant_id"] = str(merchant_id)
        out.append(rec)
    # Worst first: margin-negative on top, then ascending gross margin (None treated as -inf).
    out.sort(key=lambda r: (not r["margin_negative"],
                            r["gross_margin"] if r["gross_margin"] is not None else float("-inf")))
    return out


async def merchant_cost_per_sku(session: AsyncSession, date_from: date_t, date_to: date_t) -> list[dict]:
    """Per-merchant cost-to-serve divided by active SKU count (= enabled
    competitor_trackings), over [date_from, date_to]. Surfaces which customers
    cost the most per unit tracked. Worst (highest cost/SKU) first; a merchant
    incurring cost with zero active SKUs is treated as the worst case.

    Builds on merchant_margins so the cost aggregation has a single source.
    """
    margins = await merchant_margins(session, date_from, date_to)
    if not margins:
        return []

    ids = [uuid.UUID(r["merchant_id"]) for r in margins]
    counts = dict((await session.execute(
        select(CompetitorTracking.merchant_id, func.count())
        .where(CompetitorTracking.merchant_id.in_(ids), CompetitorTracking.enabled.is_(True))
        .group_by(CompetitorTracking.merchant_id)
    )).all())

    out = []
    for r in margins:
        skus = int(counts.get(uuid.UUID(r["merchant_id"]), 0))
        cost_per_sku = round(r["cost_to_serve"] / skus, 6) if skus > 0 else None
        out.append({**r, "active_skus": skus, "cost_per_sku": cost_per_sku})

    # Worst first: cost incurred with zero SKUs (cost_per_sku=None) on top, then
    # highest cost-per-SKU descending.
    out.sort(key=lambda x: (x["cost_per_sku"] is not None, -(x["cost_per_sku"] or 0.0)))
    return out

"""
Price-snapshot data retention (F9 AC#3 + downgrade edge case).

Retention is tiered: PREDATOR/ECLIPSE merchants keep 90 days of price history,
everyone else 30. Snapshots are URL-level (shared across every merchant tracking
that URL via domain batching), so a snapshot's effective retention is the *max*
of the tiers tracking it — a 90-day URL keeps its history even if a 30-day
merchant also tracks it.

On a PREDATOR/ECLIPSE downgrade, history beyond 30 days isn't deleted instantly:
it's marked `delete_at = now + 7 days` (a grace window) and the purge respects it.

Split so the policy is unit-testable without a DB:
  retention_days(plan)                          — pure
  retention_cutoff(plan, now)                   — pure
  purge_expired_snapshots(session, now)         — effectful sweep (cron entrypoint)
  schedule_downgrade_deletion(session, mid, now)— mark a downgraded merchant's excess

Scheduling (cron / worker tick) is infra; it just calls purge_expired_snapshots().
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.competitor_trackings import CompetitorTracking
from models.merchants import Merchant
from models.price_snapshots import PriceSnapshot

# Plans that retain 90 days of price history (F9). Others: 30 days.
_RETAIN_90D_PLANS = frozenset({"predator", "eclipse"})

RETENTION_DAYS_LONG = 90
RETENTION_DAYS_SHORT = 30
DOWNGRADE_GRACE_DAYS = 7


def retention_days(plan: str) -> int:
    """Days of price history retained for `plan` (90 for PREDATOR/ECLIPSE, else 30)."""
    return RETENTION_DAYS_LONG if plan.lower() in _RETAIN_90D_PLANS else RETENTION_DAYS_SHORT


def retention_cutoff(plan: str, now: datetime) -> datetime:
    """The oldest scraped_at a `plan` keeps — rows before this are purgeable."""
    return now - timedelta(days=retention_days(plan))


def _urls_tracked_by_90d_plans():
    """Subquery: competitor_url_ids tracked by at least one PREDATOR/ECLIPSE merchant."""
    return (
        select(CompetitorTracking.competitor_url_id)
        .join(Merchant, CompetitorTracking.merchant_id == Merchant.id)
        .where(Merchant.plan.in_(tuple(_RETAIN_90D_PLANS)))
    )


async def purge_expired_snapshots(session: AsyncSession, now: datetime | None = None) -> int:
    """Delete price_snapshots past their effective retention. Returns rows deleted.

    Three passes:
      (a) any row whose scheduled delete_at has arrived (downgrade grace expired);
      (b) hard cap — nothing is retained beyond 90 days;
      (c) rows in the 30–90 day band whose URL is NOT tracked by a 90-day merchant.
    """
    now = now or datetime.now(tz=timezone.utc)
    cutoff_30 = now - timedelta(days=RETENTION_DAYS_SHORT)
    cutoff_90 = now - timedelta(days=RETENTION_DAYS_LONG)
    deleted = 0

    # (a) scheduled deletions whose grace window has elapsed.
    res = await session.execute(
        delete(PriceSnapshot).where(
            PriceSnapshot.delete_at.is_not(None),
            PriceSnapshot.delete_at <= now,
        )
    )
    deleted += res.rowcount or 0

    # (b) hard 90-day cap (no merchant retains beyond this).
    res = await session.execute(
        delete(PriceSnapshot).where(
            PriceSnapshot.delete_at.is_(None),
            PriceSnapshot.scraped_at < cutoff_90,
        )
    )
    deleted += res.rowcount or 0

    # (c) 30–90 day band dies unless a 90-day merchant tracks the URL.
    res = await session.execute(
        delete(PriceSnapshot).where(
            PriceSnapshot.delete_at.is_(None),
            PriceSnapshot.scraped_at < cutoff_30,
            PriceSnapshot.scraped_at >= cutoff_90,
            PriceSnapshot.competitor_url_id.not_in(_urls_tracked_by_90d_plans()),
        )
    )
    deleted += res.rowcount or 0

    await session.commit()
    return deleted


async def schedule_downgrade_deletion(session: AsyncSession, merchant_id, now: datetime | None = None) -> int:
    """Mark a downgraded merchant's >30-day snapshots for deletion in 7 days.

    Only URLs this merchant tracks that are NOT still tracked by another 90-day
    merchant are scheduled — shared history a remaining PREDATOR keeps is left
    alone. Returns the number of rows scheduled. Caller-agnostic of commit order.
    """
    now = now or datetime.now(tz=timezone.utc)
    cutoff_30 = now - timedelta(days=RETENTION_DAYS_SHORT)

    my_urls = (
        select(CompetitorTracking.competitor_url_id)
        .where(CompetitorTracking.merchant_id == merchant_id)
    )

    res = await session.execute(
        update(PriceSnapshot)
        .where(
            PriceSnapshot.competitor_url_id.in_(my_urls),
            PriceSnapshot.competitor_url_id.not_in(_urls_tracked_by_90d_plans()),
            PriceSnapshot.scraped_at < cutoff_30,
            PriceSnapshot.delete_at.is_(None),
        )
        .values(delete_at=now + timedelta(days=DOWNGRADE_GRACE_DAYS))
    )
    await session.commit()
    return res.rowcount or 0

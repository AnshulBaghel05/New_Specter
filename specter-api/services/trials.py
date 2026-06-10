"""
Trial lifecycle service.

A free merchant opts into a 14-day RECON trial (POST /merchants/start-trial),
which sets plan='recon' + trial_ends_at. When the trial lapses the merchant
falls back to the FREE plan — NOT a read-only lockout (per PRICING.md, FREE is
a usable floor: tools + Workspace stay available, only live-data SKUs go to 0).

Split so the policy is unit-testable without any DB:
  is_trial_expired(merchant, now)  — pure predicate
  expire_trials(session, now)      — effectful sweep (downgrade + commit)

Scheduling (cron / worker tick) is infra; it just calls expire_trials().
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.merchants import Merchant

TRIAL_DAYS = 14


def trial_end_at(now: datetime) -> datetime:
    """The trial expiry timestamp for a trial started at `now`."""
    return now + timedelta(days=TRIAL_DAYS)


def is_trial_expired(merchant, now: datetime) -> bool:
    """True when this merchant is a lapsed RECON trial that should fall to FREE.

    A trial is identified by plan=='recon' + a trial_ends_at with no paid
    subscription. A paying RECON customer (razorpay_subscription_id set) is
    never "trial-expired", and non-RECON plans are out of scope.
    """
    return (
        merchant.plan == "recon"
        and getattr(merchant, "razorpay_subscription_id", None) is None
        and merchant.trial_ends_at is not None
        and merchant.trial_ends_at <= now
    )


async def expire_trials(session: AsyncSession, now: datetime | None = None) -> int:
    """Downgrade every lapsed RECON trial back to FREE. Returns the count.

    No read-only lockout — FREE is the usable freemium floor.
    """
    now = now or datetime.now(timezone.utc)
    stmt = select(Merchant).where(
        Merchant.plan == "recon",
        Merchant.razorpay_subscription_id.is_(None),
        Merchant.trial_ends_at.isnot(None),
        Merchant.trial_ends_at <= now,
    )
    merchants = list((await session.execute(stmt)).scalars().all())
    for m in merchants:
        m.plan = "free"
        m.trial_ends_at = None
    await session.commit()
    return len(merchants)

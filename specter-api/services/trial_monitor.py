"""
Trial-monitor scheduled job.

A daily tick that:
  1. Sends Resend reminder emails on day 12 ("2 days left") and day 14 ("last
     day — add payment today") of a 14-day trial.
  2. Downgrades any trial that has fully lapsed back to the FREE plan (reusing
     services.trials.expire_trials — PRICING.md "Replaces the prior read-only
     lockout"; FREE is the usable freemium floor, no read-only).

Split so the policy is unit-testable without a DB:
  reminder_due(trial_ends_at, now)   — pure: which reminder (if any) is due today
  send_trial_reminders(session, now) — effectful sweep that emails due merchants
  run_trial_monitor(session, now)    — reminders + expiry sweep (the cron entrypoint)

Scheduling (cron / worker tick) is infra; it just calls run_trial_monitor().
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.merchants import Merchant
from services.email import send_trial_reminder_email
from services.trials import expire_trials


def reminder_due(trial_ends_at: Optional[datetime], now: datetime) -> Optional[str]:
    """Which trial reminder is due today, by whole calendar days remaining.

    14-day trial: day 12 → 2 days left ("two_days_left"); day 14 → ends today
    ("last_day"). Calendar-day granularity keeps a once-daily cron idempotent
    (each reminder fires on exactly one day), avoiding double-sends.
    """
    if trial_ends_at is None:
        return None
    days_left = (trial_ends_at.date() - now.date()).days
    if days_left == 2:
        return "two_days_left"
    if days_left == 0:
        return "last_day"
    return None


async def send_trial_reminders(session: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """Email every trial merchant whose reminder is due today. Returns counts.

    A "trial merchant" is anyone with a trial_ends_at, no paid subscription, and
    not read-only — plan-agnostic so it covers any trialing plan.
    """
    now = now or datetime.now(timezone.utc)
    stmt = select(Merchant).where(
        Merchant.trial_ends_at.isnot(None),
        Merchant.razorpay_subscription_id.is_(None),
        Merchant.read_only.is_(False),
    )
    merchants = list((await session.execute(stmt)).scalars().all())

    sent = {"two_days_left": 0, "last_day": 0}
    for m in merchants:
        kind = reminder_due(m.trial_ends_at, now)
        if kind is None:
            continue
        to = m.notification_email
        if not to or not m.email_notifications_enabled:
            continue
        if await send_trial_reminder_email(to, kind):
            sent[kind] += 1
    return sent


async def run_trial_monitor(session: AsyncSession, now: datetime | None = None) -> dict:
    """Cron entrypoint: send day-12/14 reminders, then downgrade lapsed trials."""
    now = now or datetime.now(timezone.utc)
    reminders = await send_trial_reminders(session, now)
    expired = await expire_trials(session, now)
    return {"reminders": reminders, "expired": expired}

"""In-app notification service.

Owns creation of `notifications` rows for the dashboard bell + /notifications page,
and the per-type plan gate. Creation is best-effort and fully defensive: a failure
here must NEVER break the signal / scrape / billing pipeline that triggers it, so
every public entry point swallows its own errors and returns None.

Plan gating mirrors the `auth.plan_gate` philosophy (enforced server-side, frontend
is display-only): account-level types (billing, system) reach every plan; alert
types that depend on live monitoring (signal, oos, competitor_change) require a paid
plan — free merchants have 0 SKUs and never generate them anyway.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import PLAN_HIERARCHY
from models.notifications import Notification

logger = logging.getLogger("specter.notifications")

# Minimum plan (index into PLAN_HIERARCHY) required to receive each notification
# type. Types not listed are account-level and reach everyone.
_MIN_PLAN: dict[str, str] = {
    "signal": "recon",
    "oos": "recon",
    "competitor_change": "recon",
}

VALID_TYPES = {"signal", "oos", "billing", "competitor_change", "system"}


def notification_allowed(plan: str, type: str) -> bool:
    """True when `plan` may receive a notification of `type`. Pure.

    Account-level types (billing, system, or any not in _MIN_PLAN) always pass.
    Gated types require the merchant's plan to meet the minimum; an unknown plan
    sorts below the floor and is denied (never silently granted)."""
    min_plan = _MIN_PLAN.get(type)
    if min_plan is None:
        return True
    try:
        merchant_idx = PLAN_HIERARCHY.index(plan.lower())
    except ValueError:
        return False
    return merchant_idx >= PLAN_HIERARCHY.index(min_plan)


async def create_notification(
    session: AsyncSession,
    merchant_id: uuid.UUID,
    *,
    type: str,
    severity: str,
    title: str,
    body: str,
    link: Optional[str] = None,
    dedup_key: Optional[str] = None,
    plan: Optional[str] = None,
) -> Optional[Notification]:
    """Create one notification, honouring the plan gate and optional dedup.

    Returns the row (added + flushed) or None when the gate denies it, a row with
    the same `dedup_key` already exists for the merchant, or anything goes wrong.
    Never raises — callers are pipelines that must not fail on a notification."""
    try:
        if type not in VALID_TYPES:
            logger.warning("notifications: unknown type %r — skipping", type)
            return None
        if plan is not None and not notification_allowed(plan, type):
            return None

        if dedup_key is not None:
            existing = (await session.execute(
                select(Notification.id).where(
                    Notification.merchant_id == merchant_id,
                    Notification.dedup_key == dedup_key,
                ).limit(1)
            )).scalar()
            if existing is not None:
                return None

        row = Notification(
            merchant_id=merchant_id,
            type=type,
            severity=severity,
            title=title,
            body=body,
            link=link,
            dedup_key=dedup_key,
        )
        session.add(row)
        await session.flush()
        return row
    except Exception:  # noqa: BLE001 — never break the triggering pipeline
        logger.exception("notifications: create failed (merchant=%s type=%s)", merchant_id, type)
        return None


# ── Typed trigger wrappers ──────────────────────────────────────────────────────

async def notify_signal(
    session: AsyncSession, merchant_id: uuid.UUID, plan: str,
    *, sku_title: str, signal_type: str, dedup_key: Optional[str] = None,
) -> Optional[Notification]:
    """New actionable price signal (RAISE/LOWER). Gated to paid plans."""
    sev = "warning" if signal_type == "LOWER" else "success"
    return await create_notification(
        session, merchant_id, type="signal", severity=sev,
        title=f"{signal_type} signal — {sku_title}",
        body=f"A new {signal_type} pricing signal is ready for {sku_title}.",
        link="/signals", dedup_key=dedup_key, plan=plan,
    )


async def notify_oos(
    session: AsyncSession, merchant_id: uuid.UUID, plan: str,
    *, sku_title: str, competitor_domain: str, dedup_key: Optional[str] = None,
) -> Optional[Notification]:
    """A tracked competitor went out of stock. Gated to paid plans."""
    return await create_notification(
        session, merchant_id, type="oos", severity="warning",
        title=f"Competitor out of stock — {sku_title}",
        body=f"{competitor_domain} is out of stock for {sku_title} — consider raising your price.",
        link="/alerts", dedup_key=dedup_key, plan=plan,
    )


async def notify_billing(
    session: AsyncSession, merchant_id: uuid.UUID,
    *, severity: str, title: str, body: str, dedup_key: Optional[str] = None,
) -> Optional[Notification]:
    """Subscription / payment event. Reaches every plan (account-level)."""
    return await create_notification(
        session, merchant_id, type="billing", severity=severity,
        title=title, body=body, link="/settings", dedup_key=dedup_key,
    )

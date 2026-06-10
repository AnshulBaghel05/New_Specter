"""
OOS (out-of-stock) transition detector.

Triggered after every price_snapshot insert.  Detects the in_stock true→false
transition and writes oos_alerts rows for each affected competitor_tracking.
Resolves existing alerts when a competitor restocks (false→true).

Deduplication:
- An oos_alert is only created if no un-resolved alert already exists for
  the same competitor_tracking_id.  This handles the flap case
  (true→false→true→false within one scrape cycle: only 1 alert sent).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.competitor_trackings import CompetitorTracking
from models.oos_alerts import OOSAlert
from models.price_snapshots import PriceSnapshot


# ── Pure helper (exported for unit tests) ────────────────────────────────────

def is_oos_transition(current_in_stock: bool, previous_in_stock: Optional[bool]) -> bool:
    """
    Return True when a competitor has just gone out of stock.

    Args:
        current_in_stock:   in_stock value of the snapshot just inserted.
        previous_in_stock:  in_stock value of the snapshot before this one;
                            None when this is the first snapshot for the URL
                            (treated as "was in stock" — assume availability).
    """
    was_in_stock = previous_in_stock if previous_in_stock is not None else True
    return (not current_in_stock) and was_in_stock


def is_restock(current_in_stock: bool, previous_in_stock: Optional[bool]) -> bool:
    """Return True when a competitor has just come back into stock."""
    was_oos = previous_in_stock is False
    return current_in_stock and was_oos


# ── Async detector ────────────────────────────────────────────────────────────

async def detect_and_write(
    session: AsyncSession,
    competitor_url_id: uuid.UUID,
    current_snapshot_id: uuid.UUID,
    current_in_stock: bool,
) -> list[OOSAlert]:
    """
    Detect in_stock transitions and maintain oos_alerts rows.

    Returns a list of newly created OOSAlert objects (empty on restock or no
    transition).  Caller is responsible for triggering Resend notifications
    for any returned alerts.

    Does NOT call session.commit() — caller owns the transaction boundary.
    """
    prev_in_stock = await _previous_in_stock(session, competitor_url_id, current_snapshot_id)

    # ── Restock: resolve active alerts ───────────────────────────────────────
    if is_restock(current_in_stock, prev_in_stock):
        await _resolve_alerts(session, competitor_url_id)
        return []

    # ── OOS transition: create alerts if not already active ──────────────────
    if not is_oos_transition(current_in_stock, prev_in_stock):
        return []

    trackings = await _enabled_trackings(session, competitor_url_id)
    now = datetime.now(tz=timezone.utc)
    new_alerts: list[OOSAlert] = []

    for tracking in trackings:
        if await _has_active_alert(session, tracking.id):
            continue  # already alerted for this tracking — skip (handles flapping)

        alert = OOSAlert(
            competitor_tracking_id=tracking.id,
            sku_id=tracking.own_product_id,
            detected_at=now,
        )
        session.add(alert)
        new_alerts.append(alert)

    return new_alerts


# ── Private helpers ───────────────────────────────────────────────────────────

async def _previous_in_stock(
    session: AsyncSession,
    competitor_url_id: uuid.UUID,
    exclude_snapshot_id: uuid.UUID,
) -> Optional[bool]:
    """Return in_stock value of the most recent prior snapshot, or None if first."""
    stmt = (
        select(PriceSnapshot.in_stock)
        .where(
            PriceSnapshot.competitor_url_id == competitor_url_id,
            PriceSnapshot.id != exclude_snapshot_id,
        )
        .order_by(PriceSnapshot.scraped_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def _enabled_trackings(
    session: AsyncSession,
    competitor_url_id: uuid.UUID,
) -> list[CompetitorTracking]:
    """Return all enabled, non-silenced trackings for a competitor URL."""
    stmt = (
        select(CompetitorTracking)
        .where(
            CompetitorTracking.competitor_url_id == competitor_url_id,
            CompetitorTracking.enabled.is_(True),
            CompetitorTracking.silenced_oos.is_(False),
        )
    )
    return list((await session.execute(stmt)).scalars().all())


async def _has_active_alert(
    session: AsyncSession,
    competitor_tracking_id: uuid.UUID,
) -> bool:
    """Return True if there is an un-resolved oos_alert for this tracking."""
    stmt = select(OOSAlert.id).where(
        OOSAlert.competitor_tracking_id == competitor_tracking_id,
        OOSAlert.resolved_at.is_(None),
    )
    return (await session.execute(stmt)).scalar_one_or_none() is not None


async def _resolve_alerts(
    session: AsyncSession,
    competitor_url_id: uuid.UUID,
) -> None:
    """Set resolved_at on all active alerts for a competitor URL."""
    stmt = (
        select(OOSAlert)
        .join(CompetitorTracking, OOSAlert.competitor_tracking_id == CompetitorTracking.id)
        .where(
            CompetitorTracking.competitor_url_id == competitor_url_id,
            OOSAlert.resolved_at.is_(None),
        )
    )
    alerts = list((await session.execute(stmt)).scalars().all())
    now = datetime.now(tz=timezone.utc)
    for alert in alerts:
        alert.resolved_at = now

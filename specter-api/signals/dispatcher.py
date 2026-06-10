"""
Signal dispatcher — triggered after every price_snapshot insert (OOS only)
and once per merchant per scrape cycle (price signals via generate_cycle_signals).

Flow (new cycle-barrier design):
  dispatch_on_snapshot — OOS detection only, fires immediately per snapshot.
  generate_cycle_signals — RAISE/LOWER/HOLD signals, fires once per merchant
                           after the whole scrape cycle lands (cycle barrier).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from redis import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.competitor_trackings import CompetitorTracking
from models.competitor_urls import CompetitorURL
from models.merchants import Merchant
from models.oos_alerts import OOSAlert
from models.price_snapshots import PriceSnapshot
from models.signals import Signal
from models.skus import SKU
from services import email, repricer
from signals import oos_detector
from signals.rule_engine import CompetitorDataPoint, SignalResult, compute_signal

logger = logging.getLogger("specter.dispatcher")

# Plans routed to the Gemini AI engine (F11). These are exactly the plans that
# may auto-reprice (F7 is CIPHER+), so repricing is wired into the AI branch.
_AI_PLANS = frozenset({"cipher", "phantom", "predator", "eclipse"})

# Redis dedup TTL — same signal type not re-emitted for the same SKU within 1 hour.
_DEDUP_TTL_SECONDS = 3600


# ── Public helpers (exported for unit tests) ─────────────────────────────────

def dedup_key(sku_id: str, signal_type: str) -> str:
    return f"signal:dedup:{sku_id}:{signal_type}"


def check_and_set_dedup(redis_client: Redis, sku_id: str, signal_type: str) -> bool:
    """
    Return True (dedup hit — skip write) when the signal was already emitted
    within the last hour.  Sets the dedup key on a cache miss so the next call
    within 1hr will be suppressed.
    """
    key = dedup_key(sku_id, signal_type)
    if redis_client.exists(key):
        return True
    redis_client.setex(key, _DEDUP_TTL_SECONDS, "1")
    return False


# ── Main entry points ─────────────────────────────────────────────────────────

async def dispatch_on_snapshot(
    session: AsyncSession,
    redis_client: Redis,
    competitor_url_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    current_in_stock: bool,
) -> None:
    """
    Called by the internal ingest handler after inserting a price_snapshot row.

    Runs OOS detection IMMEDIATELY — an out-of-stock competitor is a
    time-sensitive opportunity that must not wait for the rest of the cycle.

    RAISE/LOWER/HOLD price signals are deliberately NOT generated here anymore.
    They are deferred to `generate_cycle_signals()`, fired once per merchant when
    that merchant's whole scrape cycle has landed (the cycle barrier), so the
    engine evaluates the FULL competitor set for a SKU at once instead of acting
    on partial per-snapshot data.

    Does NOT call session.commit() — the API handler owns the transaction.
    `redis_client` is retained in the signature for ingest-contract stability.
    """
    new_alerts = await oos_detector.detect_and_write(
        session, competitor_url_id, snapshot_id, current_in_stock
    )
    if new_alerts:
        await _notify_oos_alerts(session, new_alerts)


async def generate_cycle_signals(
    session: AsyncSession,
    redis_client: Redis,
    merchant_id: uuid.UUID,
) -> None:
    """
    Generate RAISE/LOWER/HOLD price signals for ONE merchant after its whole
    scrape cycle has landed (the cycle barrier). Fired exactly once per merchant
    per cycle by the cycle coordinator — NOT per snapshot — so the engine sees
    every competitor price for a SKU together rather than reacting to partial
    data mid-cycle.

    OOS detection is handled immediately at ingest (`dispatch_on_snapshot`); this
    function does no OOS work.

    Does NOT call session.commit() — the caller owns the transaction. Preserves
    the original two-phase ordering: all signal DB writes first, then the F7
    auto-reprice PUTs (external side-effects) last.
    """
    merchant = await session.get(Merchant, merchant_id)
    if not merchant:
        return

    # Every enabled tracking for this merchant → the affected own_products.
    trackings_stmt = select(CompetitorTracking).where(
        CompetitorTracking.merchant_id == merchant_id,
        CompetitorTracking.enabled.is_(True),
    )
    trackings = list((await session.execute(trackings_stmt)).scalars().all())
    if not trackings:
        return

    # Distinct affected own_products (dedup, preserve first-seen order).
    own_product_ids: dict[uuid.UUID, None] = {}
    for t in trackings:
        own_product_ids[t.own_product_id] = None

    plan = (merchant.plan or "recon").lower()
    eclipse_interval_s = (merchant.eclipse_interval_ms or 300_000) // 1_000

    skus_and_data: list[tuple[SKU, list[CompetitorDataPoint]]] = []
    for own_product_id in own_product_ids:
        sku = await session.get(SKU, own_product_id)
        if not sku or not sku.active or not sku.current_price or sku.current_price <= 0:
            continue
        data_points = await _build_data_points(session, own_product_id, "unknown")
        if data_points:
            skus_and_data.append((sku, data_points))

    if not skus_and_data:
        logger.debug("Cycle signals for merchant %s: no eligible SKUs", merchant_id)
        return

    if plan in _AI_PLANS:
        # Import here to avoid a circular import at module load.
        from signals import ai_engine
        signals = await ai_engine.process_merchant_batch(
            session, redis_client,
            merchant_id=str(merchant_id),
            plan=plan,
            eclipse_interval_s=eclipse_interval_s,
            skus_and_data=skus_and_data,
        )
        # Phase 2 — external F7 reprice PUTs, after every signal write succeeded.
        await _maybe_reprice(session, merchant, signals, skus_and_data)
    else:
        # RECON: pure rule-based, one SKU at a time. RECON never auto-reprices.
        for sku, data_points in skus_and_data:
            result = compute_signal(sku.current_price, data_points)
            if result:
                await _write_signal(session, redis_client, sku, result,
                                    source="rule", ai_fallback=False)


# ── Data assembly helpers ─────────────────────────────────────────────────────

async def _build_data_points(
    session: AsyncSession,
    own_product_id: uuid.UUID,
    triggering_domain: str,
) -> list[CompetitorDataPoint]:
    """
    Fetch the latest price_snapshot for every enabled tracking of an own_product.
    Enriches CompetitorDataPoint with domain, competitor_url_id, and scraped_at
    so the AI engine can build prompts and compute snapshot hashes.
    """
    all_trackings_stmt = select(CompetitorTracking).where(
        CompetitorTracking.own_product_id == own_product_id,
        CompetitorTracking.enabled.is_(True),
    )
    all_trackings = list((await session.execute(all_trackings_stmt)).scalars().all())

    data_points: list[CompetitorDataPoint] = []
    for tracking in all_trackings:
        snap = await _latest_snapshot(session, tracking.competitor_url_id)
        if snap is None:
            continue

        # Get domain for this tracking's URL
        cu = await session.get(CompetitorURL, tracking.competitor_url_id)
        domain = cu.domain if cu else triggering_domain

        data_points.append(CompetitorDataPoint(
            tracking_id=str(tracking.id),
            price=snap.price,
            in_stock=snap.in_stock,
            currency=snap.currency,
            domain=domain,
            competitor_url_id=str(tracking.competitor_url_id),
            scraped_at=snap.scraped_at,
        ))

    return data_points


async def _latest_snapshot(
    session: AsyncSession,
    competitor_url_id: uuid.UUID,
) -> Optional[PriceSnapshot]:
    stmt = (
        select(PriceSnapshot)
        .where(PriceSnapshot.competitor_url_id == competitor_url_id)
        .order_by(PriceSnapshot.scraped_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def _write_signal(
    session: AsyncSession,
    redis_client: Redis,
    sku: SKU,
    result: SignalResult,
    source: str,
    ai_fallback: bool,
    ai_model: Optional[str] = None,
) -> Optional[Signal]:
    """
    Write a Signal row with Redis-based duplicate suppression.

    Dedup key is set BEFORE the DB add so that a concurrent write for the same
    SKU+type is suppressed even if the session hasn't flushed yet.
    """
    sku_id_str = str(sku.id)
    if check_and_set_dedup(redis_client, sku_id_str, result.signal_type):
        return None

    signal = Signal(
        sku_id=sku.id,
        type=result.signal_type,
        confidence=result.confidence,
        reasoning=result.reasoning,
        price_suggestion=None,
        source=source,
        ai_fallback=ai_fallback,
        ai_model=ai_model,
    )
    session.add(signal)
    return signal


# ── F5 OOS email notification (best-effort) ──────────────────────────────────

async def _notify_oos_alerts(session: AsyncSession, alerts: list[OOSAlert]) -> None:
    """
    Send an OOS alert email for each freshly created alert.

    Fully defensive: any failure (missing data, mail outage) is logged and
    swallowed so the signal/snapshot pipeline is never affected. Skips merchants
    who turned email off or have no recorded recipient.
    """
    for alert in alerts:
        try:
            sku = await session.get(SKU, alert.sku_id)
            if sku is None:
                continue
            merchant = await session.get(Merchant, sku.merchant_id)
            if merchant is None or not merchant.email_notifications_enabled:
                continue
            recipient = merchant.notification_email
            if not recipient:
                logger.info(
                    "OOS alert %s: merchant %s has no notification_email — skipping",
                    alert.id, sku.merchant_id,
                )
                continue

            competitor_name = await _competitor_name(session, alert.competitor_tracking_id)
            sent = await email.send_oos_alert_email(
                to=recipient,
                competitor_name=competitor_name,
                sku_title=sku.title,
            )
            if sent:
                # Stamp for audit + idempotency so this alert is never re-emailed.
                alert.notified_at = datetime.now(tz=timezone.utc)
        except Exception:  # noqa: BLE001 — never let notification break the pipeline
            logger.exception("Failed to send OOS email for alert %s", getattr(alert, "id", "?"))


async def _competitor_name(
    session: AsyncSession,
    competitor_tracking_id: uuid.UUID,
) -> str:
    """Resolve a human-readable competitor name (its domain) for an alert."""
    tracking = await session.get(CompetitorTracking, competitor_tracking_id)
    if tracking is None:
        return "A competitor"
    cu = await session.get(CompetitorURL, tracking.competitor_url_id)
    return (cu.domain if cu and cu.domain else "A competitor")


# ── F7 auto-reprice trigger (best-effort) ────────────────────────────────────

async def _maybe_reprice(
    session: AsyncSession,
    merchant: Merchant,
    signals: list[Signal],
    skus_and_data: list[tuple[SKU, list[CompetitorDataPoint]]],
) -> None:
    """
    Apply auto-repricing for RAISE/LOWER signals when enabled.

    Gated by the global merchant switch and the per-SKU switch. Fully defensive:
    a Shopify failure for one SKU is logged and skipped, never propagating to
    other SKUs, other merchants, or the signal/snapshot transaction.

    Only newly-written signals are passed in (dedup-suppressed repeats are not),
    so a price change fires at most once per signal type per SKU per hour.
    """
    if not merchant.auto_reprice_enabled or not signals:
        return

    # In-stock competitor prices per SKU, used by compute_reprice.
    prices_by_sku: dict[uuid.UUID, list[Decimal]] = {}
    sku_by_id: dict[uuid.UUID, SKU] = {}
    for sku, data_points in skus_and_data:
        sku_by_id[sku.id] = sku
        prices_by_sku[sku.id] = [
            dp.price for dp in data_points if dp.in_stock and dp.price is not None
        ]

    # Flush so server-generated signal IDs are available for price_change linkage.
    try:
        await session.flush()
    except Exception:  # noqa: BLE001
        logger.exception("Flush before auto-reprice failed — skipping repricing this cycle")
        return

    for signal in signals:
        try:
            if signal is None or signal.type not in ("RAISE", "LOWER"):
                continue
            sku = sku_by_id.get(signal.sku_id)
            if sku is None or not sku.auto_reprice_enabled or not sku.active:
                continue
            if sku.current_price is None or sku.current_price <= 0:
                continue

            decision = repricer.compute_reprice(
                signal_type=signal.type,
                current_price=sku.current_price,
                floor_price=sku.floor_price,
                ceiling_price=sku.ceiling_price,
                instock_competitor_prices=prices_by_sku.get(sku.id, []),
            )
            if decision is None:
                continue

            signal_id = str(signal.id) if signal.id is not None else None
            outcome = await repricer.apply_price_change(
                session, merchant, sku, decision, signal_id=signal_id
            )
            if outcome.applied:
                logger.info(
                    "Auto-repriced SKU %s → $%s (%s)",
                    sku.id, decision.new_price, decision.reason,
                )
            elif outcome.needs_reconnect:
                # Token died mid-cycle; merchant.shopify_reconnect_required is set.
                # Stop trying further SKUs for this merchant — they will all 401.
                logger.warning(
                    "Auto-reprice halted for merchant %s — Shopify reconnect required",
                    merchant.id,
                )
                break
            else:
                logger.info("Auto-reprice skipped for SKU %s: %s", sku.id, outcome.reason)
        except Exception:  # noqa: BLE001 — isolate per-SKU failures
            logger.exception(
                "Auto-reprice errored for signal %s", getattr(signal, "id", "?")
            )

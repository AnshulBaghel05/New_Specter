"""Shared-crawl dispatcher — the control-plane loop that turns the scrape engine on.

One CompetitorURL row is scraped ONCE per due time and the single result fans out
to every merchant tracking it (cross-merchant AND cross-plan dedup): the URL's
interval is the fastest plan among its trackers (`interval_for_plans`), widened by
the unchanged-streak (#1 adaptive) and clamped to that plan's cap.

Per tick:
  1. claim_due_urls — `next_run_at <= now AND NOT robots_blocked`, FOR UPDATE SKIP
     LOCKED so multiple dispatcher pods never double-dispatch a URL.
  2. for each URL: gather its enabled trackings, open one cycle slot per distinct
     merchant (the cycle barrier), enqueue ONE scrape job carrying all tracking ids
     + merchant_cycle_ids, then advance next_run_at to the next phase-aligned slot.
  3. close_expired — safety sweep so a banned/never-landing URL can't stall signals.

The schedule math (interval, phase offset, next_run_at) and routing are pure
(`plan_dispatch`); only claim/enqueue/persist touch the world, so the decision
logic is unit-tested without a DB.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from redis import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.competitor_trackings import CompetitorTracking
from models.competitor_urls import CompetitorURL
from models.merchants import Merchant
from queue_client import enqueue_scrape_job
from services.cycle_coordinator import CycleStore, open_cycle
from services.scrape_scheduler import (
    PLAN_INTERVALS_MS,
    effective_interval,
    first_run_at,
    interval_for_plans,
    next_run_after,
    phase_offset_ms,
)

_DEFAULT_INTERVAL = PLAN_INTERVALS_MS["recon"]

# Route a scrape straight to its classified queue when the domain class is known
# (cached by the probe worker, 7-day TTL) — re-probing every cycle would double the
# outbound fetch. Unknown domains go to probe to be classified once.
QUEUE_FOR_CLASS = {"http_ok": "scrape:http", "js_required": "scrape:playwright"}


def queue_for_class(domain_class: str | None) -> str:
    return QUEUE_FOR_CLASS.get(domain_class or "", "scrape:probe")


def fastest_plan(plans: list[str], eclipse_interval_ms: int | None = None) -> str:
    """The plan with the smallest interval among a URL's trackers — used for job
    priority so the most-demanding merchant's freshness sets the queue position."""
    best_plan, best_iv = "recon", _DEFAULT_INTERVAL
    for p in plans:
        key = p.lower()
        iv = eclipse_interval_ms if (key == "eclipse" and eclipse_interval_ms is not None) else PLAN_INTERVALS_MS.get(key, _DEFAULT_INTERVAL)
        if iv < best_iv:
            best_iv, best_plan = iv, key
    return best_plan


def read_streak(redis_client: Redis, domain: str, url_path: str) -> int:
    """Unchanged-streak the workers maintain (scrape:streak:{domain}:{path}). 0 when
    absent or unreadable, so a missing key just means full plan speed."""
    try:
        v = redis_client.get(f"scrape:streak:{domain}:{url_path}")
        return int(v) if v is not None else 0
    except Exception:
        # Best-effort: any Redis/parse issue → 0 = full plan speed (safe default).
        return 0


# ── A tracker row as the dispatcher needs it (id, merchant, plan, eclipse cfg) ──

@dataclass(frozen=True)
class TrackerRow:
    id: uuid.UUID
    merchant_id: uuid.UUID
    plan: str
    eclipse_interval_ms: int | None = None


def _eclipse_ms(rows: list[TrackerRow]) -> int | None:
    vals = [r.eclipse_interval_ms for r in rows if r.plan.lower() == "eclipse" and r.eclipse_interval_ms is not None]
    return min(vals) if vals else None


# ── Pure dispatch decision ─────────────────────────────────────────────────────

@dataclass
class DispatchPlan:
    queue: str
    url: str
    domain: str
    url_path: str
    competitor_tracking_ids: list[str]
    plan: str
    interval_ms: int
    phase_offset_ms: int
    next_run_at: datetime
    # (merchant_id, that merchant's OWN plan interval) — the cycle barrier batches
    # per merchant at the plan interval, decoupled from the URL's adaptive interval.
    merchant_cycles: list[tuple[str, int]] = field(default_factory=list)


def plan_dispatch(
    cu_id: uuid.UUID,
    domain: str,
    url_path: str,
    existing_offset: int | None,
    rows: list[TrackerRow],
    streak: int,
    domain_class: str | None,
    now: datetime,
) -> DispatchPlan | None:
    """Decide everything about ONE due URL's dispatch, purely. Returns None when the
    URL has no enabled trackers (caller pauses it)."""
    if not rows:
        return None
    plans = [r.plan for r in rows]
    eclipse_ms = _eclipse_ms(rows)
    # Scheduling interval = fastest plan widened by the unchanged-streak (adaptive).
    interval = effective_interval(plans, streak, eclipse_ms)
    offset = existing_offset if existing_offset is not None else phase_offset_ms(cu_id, interval)

    # One cycle per distinct merchant, at THAT merchant's plan interval (not the
    # URL's adaptive interval) so signal batching stays coherent per merchant.
    merchant_cycles: list[tuple[str, int]] = []
    seen: set[str] = set()
    for r in rows:
        mid = str(r.merchant_id)
        if mid not in seen:
            seen.add(mid)
            m_interval = interval_for_plans([r.plan], r.eclipse_interval_ms)
            merchant_cycles.append((mid, m_interval))

    return DispatchPlan(
        queue=queue_for_class(domain_class),
        url=f"https://{domain}{url_path}",
        domain=domain,
        url_path=url_path,
        competitor_tracking_ids=[str(r.id) for r in rows],
        plan=fastest_plan(plans, eclipse_ms),
        interval_ms=interval,
        phase_offset_ms=offset,
        next_run_at=next_run_after(now, interval, offset),
        merchant_cycles=merchant_cycles,
    )


# ── DB access (thin, patchable seams) ──────────────────────────────────────────

async def claim_due_urls(session: AsyncSession, now: datetime, limit: int) -> list[CompetitorURL]:
    """Lock and return the URLs due to scrape. SKIP LOCKED lets many dispatcher pods
    share the load without ever double-claiming a row."""
    stmt = (
        select(CompetitorURL)
        .where(
            CompetitorURL.next_run_at.is_not(None),
            CompetitorURL.next_run_at <= now,
            CompetitorURL.robots_blocked.is_(False),
        )
        .order_by(CompetitorURL.next_run_at)
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    return list((await session.execute(stmt)).scalars().all())


async def select_unscheduled_tracked_urls(
    session: AsyncSession, now: datetime, limit: int
) -> list[CompetitorURL]:
    """URLs that SHOULD be scheduled but aren't: next_run_at IS NULL, not robots-
    blocked, yet have at least one enabled tracking. claim_due_urls only ever sees
    rows with next_run_at set, so without this seam a URL that lands in this state —
    legacy/seed rows created before refresh_url_schedule was wired, or any row whose
    schedule was cleared and never recomputed — would stay 'pending' forever and
    never dispatch. The EXISTS guard keeps genuinely-untracked URLs out of the set
    (they're correctly left unscheduled)."""
    stmt = (
        select(CompetitorURL)
        .where(
            CompetitorURL.next_run_at.is_(None),
            CompetitorURL.robots_blocked.is_(False),
            select(CompetitorTracking.id)
            .where(
                CompetitorTracking.competitor_url_id == CompetitorURL.id,
                CompetitorTracking.enabled.is_(True),
            )
            .exists(),
        )
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    return list((await session.execute(stmt)).scalars().all())


async def enabled_trackings_for_url(session: AsyncSession, cu_id: uuid.UUID) -> list[TrackerRow]:
    stmt = (
        select(
            CompetitorTracking.id,
            CompetitorTracking.merchant_id,
            Merchant.plan,
            Merchant.eclipse_interval_ms,
        )
        .join(Merchant, CompetitorTracking.merchant_id == Merchant.id)
        .where(
            CompetitorTracking.competitor_url_id == cu_id,
            CompetitorTracking.enabled.is_(True),
        )
    )
    rows = (await session.execute(stmt)).all()
    return [TrackerRow(id=r[0], merchant_id=r[1], plan=r[2], eclipse_interval_ms=r[3]) for r in rows]


# ── Schedule maintenance (called when a URL's trackings change) ────────────────

async def refresh_url_schedule(
    session: AsyncSession, redis_client: Redis, cu: CompetitorURL, now: datetime
) -> None:
    """(Re)compute a URL's interval/phase/next_run_at from its current enabled
    trackings. Clears next_run_at when the last tracking is removed, so the
    dispatcher immediately stops scraping an untracked URL (no wasted crawls)."""
    rows = await enabled_trackings_for_url(session, cu.id)
    if not rows:
        cu.next_run_at = None
        return
    plans = [r.plan for r in rows]
    eclipse_ms = _eclipse_ms(rows)
    streak = read_streak(redis_client, cu.domain, cu.url_path)
    interval = effective_interval(plans, streak, eclipse_ms)
    offset = cu.phase_offset_ms if cu.phase_offset_ms is not None else phase_offset_ms(cu.id, interval)
    cu.interval_ms = interval
    cu.phase_offset_ms = offset
    cu.next_run_at = first_run_at(now, interval, offset)


async def heal_unscheduled_urls(
    session: AsyncSession, redis_client: Redis, now: datetime, limit: int = 500
) -> int:
    """Recompute the schedule for any tracked URL stuck with next_run_at NULL.

    This is the self-heal that makes prices flow for legacy/seed data and closes any
    future window where a URL's schedule was lost: each tick re-derives interval/
    phase/next_run_at from the URL's current enabled trackings. Idempotent — once
    scheduled the row is no longer NULL so it drops out of the candidate set; the
    rare row whose trackings vanished mid-heal is left paused (next_run_at NULL) and
    not counted as healed. Only commits when something actually changed."""
    candidates = await select_unscheduled_tracked_urls(session, now, limit)
    healed = 0
    for cu in candidates:
        await refresh_url_schedule(session, redis_client, cu, now)
        if cu.next_run_at is not None:
            healed += 1
    if candidates:
        await session.commit()
    return healed


# ── The tick ───────────────────────────────────────────────────────────────────

async def dispatch_due(
    session: AsyncSession,
    redis_client: Redis,
    store: CycleStore,
    now: datetime,
    limit: int = 200,
    grace_ms: int = 60_000,
) -> dict:
    """Claim due URLs and enqueue one shared crawl each. Returns counts for logging."""
    due = await claim_due_urls(session, now, limit)
    dispatched = 0
    for cu in due:
        rows = await enabled_trackings_for_url(session, cu.id)
        plan = plan_dispatch(
            cu.id, cu.domain, cu.url_path, cu.phase_offset_ms, rows,
            read_streak(redis_client, cu.domain, cu.url_path),
            redis_client.get(f"domain:class:{cu.domain}"), now,
        )
        if plan is None:
            cu.next_run_at = None  # no active trackers — pause this URL
            continue

        # Open one cycle slot per distinct merchant, at that merchant's plan interval
        # (the barrier counts this fetch toward the merchant's current cycle).
        merchant_cycle_ids = []
        for mid, m_interval in plan.merchant_cycles:
            cid = open_cycle(store, mid, now, m_interval, url_count=1, grace_ms=grace_ms)
            merchant_cycle_ids.append({"merchant_id": mid, "cycle_id": cid, "ttl_ms": m_interval + grace_ms})

        enqueue_scrape_job(
            redis_client,
            queue=plan.queue,
            url=plan.url,
            domain=plan.domain,
            url_path=plan.url_path,
            competitor_tracking_ids=plan.competitor_tracking_ids,
            plan=plan.plan,
            merchant_cycle_ids=merchant_cycle_ids,
        )

        cu.interval_ms = plan.interval_ms
        cu.phase_offset_ms = plan.phase_offset_ms
        cu.next_run_at = plan.next_run_at
        cu.last_scraped_at = now
        dispatched += 1

    await session.commit()
    return {"claimed": len(due), "dispatched": dispatched}


async def tick(
    session: AsyncSession,
    redis_client: Redis,
    store: CycleStore,
    now: datetime,
    limit: int = 200,
    grace_ms: int = 60_000,
) -> dict:
    """One dispatcher iteration: dispatch every due URL as a shared crawl.

    A cycle completes via its primary path — DONE reaching EXPECTED — because every
    dispatched scrape lands as either a snapshot or a terminal scrape-failed, both
    carrying merchant_cycle_ids (so failures advance the barrier too). The
    close_expired safety sweep is intentionally NOT wired here: with per-merchant
    plan intervals the cycle keys don't yet encode their interval, so a single-
    interval sweep would mis-deadline cross-plan cycles. Self-healing covers the
    rare lost-job case — the next cycle recomputes every signal from the full set.

    Before dispatching we heal any tracked URL stuck with no schedule (next_run_at
    NULL) so legacy/seed rows that claim_due_urls can never see start flowing. Healed
    rows get a FUTURE next_run_at (next phase slot), so they're picked up by a later
    tick's dispatch — same timing as a freshly-added competitor.
    """
    healed = await heal_unscheduled_urls(session, redis_client, now, limit=max(limit, 500))
    result = await dispatch_due(session, redis_client, store, now, limit, grace_ms)
    result["healed"] = healed
    return result

"""Internal ingest router — the scraper's authenticated, idempotent destination.

The BullMQ fetch workers POST results here (HMAC-signed via require_ingest_auth).
Snapshots are inserted ON CONFLICT (job_uuid) DO NOTHING so a retried job never
double-writes or re-fires side-effects. For each NEW snapshot we:
  1. run OOS detection immediately (time-sensitive — dispatch_on_snapshot), then
  2. advance the per-merchant cycle counter (cycle_coordinator.record_scrape over
     the Redis-backed CycleStore); when a cycle completes, fire generate_cycle_signals
     once for that merchant (the cycle barrier — RAISE/LOWER on the full set).

A failed or robots-blocked URL still advances the cycle so a banned competitor
cannot stall a merchant's signals.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from redis import Redis
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from auth.internal_auth import require_ingest_auth
from db import get_db
from models.competitor_urls import CompetitorURL
from models.domain_exclusions import DomainExclusion
from models.price_snapshots import PriceSnapshot
from models.scrape_audit import ScrapeAudit
from redis_client import get_redis
from services import cycle_coordinator
from services.cost_ledger import record_scrape_cost
from services.cycle_store import RedisCycleStore
from signals.dispatcher import dispatch_on_snapshot, generate_cycle_signals

# Default cycle key TTL when the scraper does not pin one (interval + grace). The
# control-plane dispatcher opens cycles with the precise interval; this is only a
# self-expiry backstop so keys never dangle.
DEFAULT_CYCLE_TTL_MS = 6 * 60 * 60 * 1000 + 60_000  # 6h + 1m grace

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(require_ingest_auth)],
)


# ── Request models ────────────────────────────────────────────────────────────

class MerchantCycle(BaseModel):
    merchant_id: uuid.UUID
    cycle_id: int
    ttl_ms: Optional[int] = None


class SnapshotIn(BaseModel):
    domain: str
    url_path: str
    # Data-quality guard: a valid price is strictly positive and fits the
    # Numeric(10,2) column. Parse failures post to /scrape-failed instead, so a
    # price-snapshot should never carry 0/negative — reject (422) if it does.
    price: Decimal = Field(gt=0, le=Decimal("99999999.99"))
    in_stock: bool
    currency: str = "USD"
    title: Optional[str] = None
    needs_review: bool = False
    job_uuid: Optional[uuid.UUID] = None
    competitor_url_id: Optional[uuid.UUID] = None
    merchant_cycle_ids: list[MerchantCycle] = Field(default_factory=list)
    # Audit context (how the scraper fetched this — recorded in scrape_audit).
    robots_decision: Optional[str] = None
    proxy_tier: Optional[str] = None
    # Cost context (Audit #4 — bytes transferred + whether a CAPTCHA was solved).
    resp_bytes: int = 0
    captcha_solved: bool = False


class SnapshotBatchIn(BaseModel):
    items: list[SnapshotIn]


class ScrapeFailedIn(BaseModel):
    domain: str
    url_path: Optional[str] = None
    error: Optional[str] = None
    merchant_cycle_ids: list[MerchantCycle] = Field(default_factory=list)
    robots_decision: Optional[str] = None
    proxy_tier: Optional[str] = None
    # Cost context (Audit #4 — a failed fetch still spent proxy/CAPTCHA budget).
    resp_bytes: int = 0
    captcha_solved: bool = False


class DomainBlockedIn(BaseModel):
    domain: str
    merchant_cycle_ids: list[MerchantCycle] = Field(default_factory=list)


# ── Persistence helpers (module-level so tests can patch them) ─────────────────

async def _excluded_domains(session: AsyncSession) -> set[str]:
    """Operator kill-switch list. Excluded domains are dropped before any insert
    or side-effect (defense in depth — the scraper also checks this pre-fetch)."""
    rows = await session.execute(select(DomainExclusion.domain))
    return {r[0] for r in rows}


async def _write_audit(
    session: AsyncSession,
    domain: str,
    status: str,
    robots_decision: Optional[str] = None,
    proxy_tier: Optional[str] = None,
) -> None:
    """Append one compliance audit row. Never raises into the hot path."""
    session.add(
        ScrapeAudit(
            domain=domain,
            status=status,
            robots_decision=robots_decision,
            proxy_tier=proxy_tier,
        )
    )


async def _resolve_competitor_url_id(session: AsyncSession, domain: str, url_path: str) -> uuid.UUID:
    """Get-or-create the URL-level registry row the snapshot hangs off."""
    stmt = select(CompetitorURL.id).where(
        CompetitorURL.domain == domain, CompetitorURL.url_path == url_path
    )
    row = (await session.execute(stmt)).first()
    if row is not None:
        return row[0]
    cu = CompetitorURL(domain=domain, url_path=url_path)
    session.add(cu)
    await session.flush()
    return cu.id


def _skip_unchanged() -> bool:
    """Skip-write optimization toggle (ON by default).

    When on, a snapshot whose (price, in_stock) equals the last stored value for
    its URL is NOT re-inserted (saves unbounded price_snapshots growth) — but the
    cycle still advances, the fetch cost is still recorded, and an audit row is
    written, so signals, cost accounting, and the audit trail are unaffected. Set
    SNAPSHOT_SKIP_UNCHANGED=false to force every snapshot to be written.

    Safe to default on:
      - An in_stock transition is never "unchanged", so it is always written and
        OOS detection (edge-triggered, see signals/oos_detector.py) always fires.
      - The latest unchanged snapshot already carries the same price/stock the
        signal engine reads, so RAISE/LOWER/HOLD + AI output are identical (the
        AI dedup hash excludes scraped_at).
      - Per-URL freshness is surfaced from competitor_urls.last_scraped_at
        (maintained at dispatch), not the snapshot, so "last checked" stays
        accurate even when the write is skipped."""
    return os.environ.get("SNAPSHOT_SKIP_UNCHANGED", "true").lower() in ("1", "true", "yes")


async def _last_values(
    session: AsyncSession, cu_ids: list[uuid.UUID]
) -> dict[uuid.UUID, tuple[Decimal, bool]]:
    """Latest (price, in_stock) per competitor_url_id. Uses DISTINCT ON over the
    (competitor_url_id, scraped_at DESC) index added in migration 0013."""
    ids = list({c for c in cu_ids})
    if not ids:
        return {}
    stmt = (
        select(PriceSnapshot.competitor_url_id, PriceSnapshot.price, PriceSnapshot.in_stock)
        .where(PriceSnapshot.competitor_url_id.in_(ids))
        .order_by(PriceSnapshot.competitor_url_id, PriceSnapshot.scraped_at.desc())
        .distinct(PriceSnapshot.competitor_url_id)
    )
    rows = (await session.execute(stmt)).all()
    return {r[0]: (r[1], r[2]) for r in rows}


def _snapshot_row(competitor_url_id: uuid.UUID, item: SnapshotIn, now: datetime) -> dict:
    return {
        "competitor_url_id": competitor_url_id,
        "price": item.price,
        "currency": item.currency,
        "in_stock": item.in_stock,
        "scraped_at": now,
        "needs_review": item.needs_review,
        "job_uuid": item.job_uuid,
    }


async def _upsert_snapshot(
    session: AsyncSession, competitor_url_id: uuid.UUID, item: SnapshotIn
) -> Optional[uuid.UUID]:
    """Insert one snapshot. With a job_uuid, ON CONFLICT DO NOTHING makes a retried
    job a no-op (returns None so the caller skips all side-effects). Used for the
    rare UUID-less item; batches with job_uuids take the bulk path below."""
    now = datetime.now(tz=timezone.utc)
    stmt = (
        pg_insert(PriceSnapshot)
        .values(**_snapshot_row(competitor_url_id, item, now))
        .returning(PriceSnapshot.id)
    )
    if item.job_uuid is not None:
        stmt = stmt.on_conflict_do_nothing(index_elements=["job_uuid"])
    row = (await session.execute(stmt)).first()
    return row[0] if row is not None else None


async def _bulk_upsert_snapshots(
    session: AsyncSession, prepared: list[tuple[SnapshotIn, uuid.UUID]]
) -> dict[uuid.UUID, uuid.UUID]:
    """Insert every (job_uuid-bearing) snapshot in ONE multi-row INSERT ... ON
    CONFLICT (job_uuid) DO NOTHING ... RETURNING. Returns {job_uuid: snapshot_id}
    for the rows that were actually inserted, so the caller runs side-effects only
    for new snapshots. Callers must pre-dedupe job_uuids within the batch (a
    multi-row INSERT cannot conflict-resolve a value against itself)."""
    if not prepared:
        return {}
    now = datetime.now(tz=timezone.utc)
    rows = [_snapshot_row(cu_id, item, now) for item, cu_id in prepared]
    stmt = (
        pg_insert(PriceSnapshot)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["job_uuid"])
        .returning(PriceSnapshot.id, PriceSnapshot.job_uuid)
    )
    result = await session.execute(stmt)
    return {r.job_uuid: r.id for r in result}


def _record_cycles(
    store: RedisCycleStore,
    fired_sink: list[str],
    merchant_cycles: list[MerchantCycle],
) -> None:
    """Advance the cycle counter for each merchant; collect merchants whose cycle
    fired so the caller can run signal generation once each."""
    def enqueue(merchant_id: str, _cycle_id: int) -> None:
        fired_sink.append(merchant_id)

    for mc in merchant_cycles:
        ttl = mc.ttl_ms or DEFAULT_CYCLE_TTL_MS
        cycle_coordinator.record_scrape(
            store, enqueue, str(mc.merchant_id), mc.cycle_id, ttl
        )


async def _fire_cycle_signals(
    session: AsyncSession, redis_client: Redis, fired_merchant_ids: list[str]
) -> int:
    """Run generate_cycle_signals once per distinct merchant that completed a cycle."""
    seen: set[str] = set()
    for merchant_id in fired_merchant_ids:
        if merchant_id in seen:
            continue
        seen.add(merchant_id)
        await generate_cycle_signals(session, redis_client, uuid.UUID(merchant_id))
    return len(seen)


# ── Endpoints ─────────────────────────────────────────────────────────────────

async def _ingest(session: AsyncSession, redis_client: Redis, items: list[SnapshotIn]) -> dict:
    store = RedisCycleStore(redis_client)
    fired: list[str] = []

    # Drop excluded domains up front (takedown/opt-out): no insert, no
    # side-effects — just an audit row recording that we honored the exclusion.
    excluded = await _excluded_domains(session)

    # Resolve the URL-registry row each snapshot hangs off (get-or-create).
    prepared: list[tuple[SnapshotIn, uuid.UUID]] = []
    for item in items:
        if item.domain in excluded:
            await _write_audit(session, item.domain, "excluded",
                               item.robots_decision, item.proxy_tier)
            continue
        cu_id = item.competitor_url_id or await _resolve_competitor_url_id(
            session, item.domain, item.url_path
        )
        prepared.append((item, cu_id))

    # Skip-write (opt-in): drop items whose (price, in_stock) is unchanged from the
    # last stored value — no row insert, but they still advance the cycle and incur
    # cost below (the fetch happened). Off by default → `unchanged` stays empty and
    # behavior is identical.
    unchanged: list[tuple[SnapshotIn, uuid.UUID]] = []
    if _skip_unchanged() and prepared:
        last = await _last_values(session, [cu for _, cu in prepared])
        kept: list[tuple[SnapshotIn, uuid.UUID]] = []
        for item, cu_id in prepared:
            prev = last.get(cu_id)
            if prev is not None and prev[0] == item.price and prev[1] == item.in_stock:
                unchanged.append((item, cu_id))
            else:
                kept.append((item, cu_id))
        prepared = kept

    # Split: job_uuid-bearing items take the single bulk INSERT; the rare UUID-less
    # item falls back to a per-row insert (it has no idempotency key to dedupe on).
    with_uuid: list[tuple[SnapshotIn, uuid.UUID]] = []
    seen_uuids: set[uuid.UUID] = set()
    plain: list[tuple[SnapshotIn, uuid.UUID]] = []
    for item, cu_id in prepared:
        if item.job_uuid is None:
            plain.append((item, cu_id))
        elif item.job_uuid not in seen_uuids:   # intra-batch dedup
            seen_uuids.add(item.job_uuid)
            with_uuid.append((item, cu_id))

    # (item, cu_id, snapshot_id) for every NEWLY-inserted snapshot.
    new_snapshots: list[tuple[SnapshotIn, uuid.UUID, uuid.UUID]] = []
    id_by_uuid = await _bulk_upsert_snapshots(session, with_uuid)
    for item, cu_id in with_uuid:
        snap_id = id_by_uuid.get(item.job_uuid)
        if snap_id is not None:                  # absent → existed already (retry)
            new_snapshots.append((item, cu_id, snap_id))
    for item, cu_id in plain:
        snap_id = await _upsert_snapshot(session, cu_id, item)
        if snap_id is not None:
            new_snapshots.append((item, cu_id, snap_id))

    # Side-effects run once per new snapshot only (idempotent against retries).
    for item, cu_id, snap_id in new_snapshots:
        await dispatch_on_snapshot(session, redis_client, cu_id, snap_id, item.in_stock)
        _record_cycles(store, fired, item.merchant_cycle_ids)
        await _write_audit(session, item.domain, "stored",
                           item.robots_decision, item.proxy_tier)
        # One fetch's cost, split across the merchants sharing this crawl (Audit #4).
        await record_scrape_cost(
            session, redis_client,
            [mc.merchant_id for mc in item.merchant_cycle_ids],
            item.proxy_tier, item.resp_bytes, item.captcha_solved,
            domain=item.domain,
        )

    # Unchanged (skip-write) items: no row + no OOS/signal dispatch, but the fetch
    # still happened — advance the cycle and record its cost so signals don't stall
    # and cost accounting stays correct.
    for item, _cu_id in unchanged:
        _record_cycles(store, fired, item.merchant_cycle_ids)
        await _write_audit(session, item.domain, "unchanged",
                           item.robots_decision, item.proxy_tier)
        await record_scrape_cost(
            session, redis_client,
            [mc.merchant_id for mc in item.merchant_cycle_ids],
            item.proxy_tier, item.resp_bytes, item.captcha_solved,
            domain=item.domain,
        )

    cycles_fired = await _fire_cycle_signals(session, redis_client, fired)
    await session.commit()
    return {"inserted": len(new_snapshots), "received": len(items), "cycles_fired": cycles_fired}


@router.post("/price-snapshot")
async def ingest_one(
    item: SnapshotIn,
    session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> dict:
    return await _ingest(session, redis_client, [item])


@router.post("/price-snapshot:batch")
async def ingest_batch(
    body: SnapshotBatchIn,
    session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> dict:
    return await _ingest(session, redis_client, body.items)


@router.post("/scrape-failed")
async def scrape_failed(
    body: ScrapeFailedIn,
    session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> dict:
    # A failed URL still advances the cycle so a banned competitor can't stall signals.
    store = RedisCycleStore(redis_client)
    fired: list[str] = []
    _record_cycles(store, fired, body.merchant_cycle_ids)
    await _write_audit(session, body.domain, "failed", body.robots_decision, body.proxy_tier)
    # A failed fetch still spent proxy/CAPTCHA budget — attribute it (Audit #4).
    await record_scrape_cost(
        session, redis_client,
        [mc.merchant_id for mc in body.merchant_cycle_ids],
        body.proxy_tier, body.resp_bytes, body.captcha_solved,
        domain=body.domain,
    )
    cycles_fired = await _fire_cycle_signals(session, redis_client, fired)
    await session.commit()
    return {"ok": True, "cycles_fired": cycles_fired}


@router.post("/domain-blocked")
async def domain_blocked(
    body: DomainBlockedIn,
    session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> dict:
    await session.execute(
        update(CompetitorURL)
        .where(CompetitorURL.domain == body.domain)
        .values(robots_blocked=True)
    )
    store = RedisCycleStore(redis_client)
    fired: list[str] = []
    _record_cycles(store, fired, body.merchant_cycle_ids)
    await _write_audit(session, body.domain, "blocked")
    cycles_fired = await _fire_cycle_signals(session, redis_client, fired)
    await session.commit()
    return {"ok": True, "cycles_fired": cycles_fired}


@router.get("/exclusions")
async def list_exclusions(session: AsyncSession = Depends(get_db)) -> dict:
    """The domain kill-switch list. The scraper syncs this into a Redis set and
    checks it before any fetch, so takedowns take effect without a redeploy."""
    rows = await session.execute(select(DomainExclusion.domain))
    return {"domains": [r[0] for r in rows]}

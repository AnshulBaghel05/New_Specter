"""Per-customer cost accrual (Audit #4). Hot-path writes are best-effort Redis
counters; a daily flush rolls them into merchant_cost_daily. A shared crawl's
cost is split across the distinct merchants sharing it. Never raises into ingest."""
from __future__ import annotations

import logging
import random as _random
import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.cost_event_sample import CostEventSample
from models.merchant_cost_daily import MerchantCostDaily
from services import cost_model

logger = logging.getLogger("cost_ledger")

SAMPLE_RATE = 0.01
COUNTER_TTL_S = 40 * 24 * 3600   # outlive the flush window


def _day(now: datetime) -> str:
    return now.strftime("%Y-%m-%d")


def _key(m: str, day: str, ctype: str) -> str:
    return f"cost:daily:{m}:{day}:{ctype}"


def _accrue(redis, session, m: str, day: str, ctype: str, cost: float,
            units: float, proxy_tier, domain, rng) -> None:
    k = _key(m, day, ctype)
    redis.incrbyfloat(k, cost)
    redis.expire(k, COUNTER_TTL_S)
    redis.incrbyfloat(f"{k}:units", units)
    redis.expire(f"{k}:units", COUNTER_TTL_S)
    if rng.random() < SAMPLE_RATE:
        session.add(CostEventSample(
            merchant_id=uuid.UUID(m), cost_type=ctype, proxy_tier=proxy_tier,
            units=units, cost_usd=cost, domain=domain))


async def record_scrape_cost(session: AsyncSession, redis, merchant_ids, proxy_tier,
                             resp_bytes, captcha_solved, *, domain=None,
                             now=None, rng=_random) -> None:
    try:
        now = now or datetime.now(timezone.utc)
        distinct = list(dict.fromkeys(str(m) for m in merchant_ids))
        if not distinct:
            return
        costs = cost_model.scrape_cost_usd(proxy_tier, resp_bytes, captcha_solved)
        day = _day(now)
        n = len(distinct)
        for m in distinct:
            for ctype in ("proxy", "captcha"):
                c = cost_model.split(costs[ctype], n)
                if c <= 0:
                    continue
                _accrue(redis, session, m, day, ctype, c, 1.0, proxy_tier, domain, rng)
    except Exception:
        logger.exception("record_scrape_cost failed (best-effort, ignored)")


async def record_ai_cost(session: AsyncSession, redis, merchant_id, model,
                         input_tokens, output_tokens, *, now=None, rng=_random) -> None:
    try:
        now = now or datetime.now(timezone.utc)
        cost = cost_model.ai_cost_usd(model, input_tokens, output_tokens)
        if cost <= 0:
            return
        _accrue(redis, session, str(merchant_id), _day(now), "ai", cost,
                float(int(input_tokens or 0) + int(output_tokens or 0)), None, None, rng)
    except Exception:
        logger.exception("record_ai_cost failed (best-effort, ignored)")


async def _upsert_daily(session: AsyncSession, m: str, day: str, ctype: str,
                        cost: float, units: float) -> None:
    stmt = pg_insert(MerchantCostDaily).values(
        merchant_id=uuid.UUID(m), date=day, cost_type=ctype,
        cost_usd=cost, units=units, sample_count=0,
    ).on_conflict_do_update(
        constraint="uq_merchant_cost_daily",
        set_={"cost_usd": cost, "units": units, "updated_at": datetime.now(timezone.utc)},
    )
    await session.execute(stmt)


async def flush_daily(session: AsyncSession, redis, day: str) -> int:
    """Roll the day's Redis counters into merchant_cost_daily (idempotent upsert)."""
    written = 0
    for raw in redis.scan_iter(match=f"cost:daily:*:{day}:*", count=500):
        k = raw.decode() if isinstance(raw, (bytes, bytearray)) else raw
        parts = k.split(":")
        if parts[-1] == "units":      # skip the parallel units counter
            continue
        # cost:daily:{m}:{day}:{ctype}
        m, _day_, ctype = parts[2], parts[3], parts[4]
        cost = float(redis.get(k) or 0)
        units = float(redis.get(f"{k}:units") or 0)
        await _upsert_daily(session, m, _day_, ctype, cost, units)
        written += 1
    await session.commit()
    return written

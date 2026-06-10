"""
AI signal response cache.

Redis key:  ai:signal:{sku_id}:{snapshot_hash}
TTL:        plan-dependent (matches scrape interval so cache expires exactly
            when the next scrape cycle is due)
Hash:       SHA-256 of competitor data sorted by domain alphabetically,
            excluding scraped_at — identical competitor states always produce
            the same hash regardless of when they were scraped.
"""
from __future__ import annotations

import hashlib
import json
from typing import Optional, TypedDict

from redis import Redis


# TTL in seconds per plan (matches PLAN_INTERVALS in scraper/scheduler.ts)
PLAN_CACHE_TTL: dict[str, int] = {
    "cipher":   10_800,  # 3 hr
    "phantom":   7_200,  # 2 hr
    "predator":  3_600,  # 1 hr
    "eclipse":     300,  # default 5 min; override with merchant's eclipse_interval_ms
}


class CachedSignal(TypedDict):
    signal: str
    confidence: float
    price_suggestion: Optional[float]
    reasoning: str


# ── Hash computation ──────────────────────────────────────────────────────────

def compute_snapshot_hash(competitors: list[dict]) -> str:
    """
    Canonical SHA-256 hash of competitor pricing data.

    Input list items must have at minimum: 'domain', 'price', 'in_stock'.
    'scraped_at' is excluded so the hash depends only on pricing state, not timing.
    Sorted by domain alphabetically to ensure determinism regardless of query order.
    """
    normalized = [
        {k: v for k, v in c.items() if k != "scraped_at"}
        for c in competitors
    ]
    normalized.sort(key=lambda c: str(c.get("domain", "")))
    canonical = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


# ── Redis cache operations ─────────────────────────────────────────────────────

def cache_key(sku_id: str, snapshot_hash: str) -> str:
    return f"ai:signal:{sku_id}:{snapshot_hash}"


def get_cached(
    redis_client: Redis,
    sku_id: str,
    snapshot_hash: str,
) -> Optional[CachedSignal]:
    """Return cached signal data or None on cache miss / corrupt entry."""
    raw = redis_client.get(cache_key(sku_id, snapshot_hash))
    if raw is None:
        return None
    try:
        return json.loads(raw)  # type: ignore[return-value]
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


def set_cached(
    redis_client: Redis,
    sku_id: str,
    snapshot_hash: str,
    signal_data: CachedSignal,
    plan: str,
    eclipse_interval_s: int = 300,
) -> None:
    """Write signal data to cache with plan-appropriate TTL."""
    ttl = eclipse_interval_s if plan == "eclipse" else PLAN_CACHE_TTL.get(plan, PLAN_CACHE_TTL["cipher"])
    redis_client.setex(
        cache_key(sku_id, snapshot_hash),
        ttl,
        json.dumps(signal_data),
    )

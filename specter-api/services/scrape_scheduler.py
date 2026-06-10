# specter-api/services/scrape_scheduler.py
"""Pure scheduling math: when each competitor URL is scraped.

Even-spread design (anti-ban): every URL gets a STABLE phase offset =
hash(competitor_url_id) % interval. Across all URLs sharing an interval the
offsets are uniform over [0, interval), so the dispatcher emits a steady
trickle instead of a boundary burst. next_run_at always lands on the same
phase, one interval at a time, so the spread is stable cycle-over-cycle."""
from __future__ import annotations
import hashlib, uuid
from datetime import datetime, timezone

PLAN_INTERVALS_MS: dict[str, int] = {
    "recon": 21_600_000, "cipher": 10_800_000, "phantom": 7_200_000,
    "predator": 3_600_000, "eclipse": 300_000,
}
# Per-plan staleness ceiling (matches scraper/plans.ts PLAN_MAX_INTERVALS). Adaptive
# backoff (below) lets a stable URL widen toward this cap but never past it.
PLAN_MAX_INTERVALS_MS: dict[str, int] = {
    "recon": 86_400_000, "cipher": 43_200_000, "phantom": 28_800_000,
    "predator": 14_400_000, "eclipse": 3_600_000,
}
_DEFAULT = PLAN_INTERVALS_MS["recon"]
_DEFAULT_CAP = PLAN_MAX_INTERVALS_MS["recon"]


def interval_for_plans(plans: list[str], eclipse_interval_ms: int | None = None) -> int:
    """Most-frequent (smallest) interval among the merchants tracking a URL."""
    best = _DEFAULT
    for p in plans:
        key = p.lower()
        iv = eclipse_interval_ms if (key == "eclipse" and eclipse_interval_ms is not None) else PLAN_INTERVALS_MS.get(key, _DEFAULT)
        best = min(best, iv)
    return best


# ── Adaptive change-detection scheduling (#1, in the live Python layer) ─────────
# Mirrors scraper/plans.ts: a URL whose price + stock stop changing (high
# unchanged-streak, tracked in Redis by the workers) is scraped progressively less
# often — but always within [plan floor, plan cap]. Balanced curve.

def adaptive_multiplier(streak: int) -> float:
    """streak <3 → 1× (full plan speed)   3–5 → 2×   6–8 → 4×   ≥9 → cap (inf)."""
    if streak >= 9:
        return float("inf")
    if streak >= 6:
        return 4.0
    if streak >= 3:
        return 2.0
    return 1.0


def cap_for_plans(plans: list[str], eclipse_interval_ms: int | None = None) -> int:
    """Staleness ceiling for a URL = the cap of its FASTEST plan, so the freshest
    merchant bounds how stale the shared crawl is allowed to get."""
    best_floor = _DEFAULT
    best_cap = _DEFAULT_CAP
    for p in plans:
        key = p.lower()
        if key == "eclipse" and eclipse_interval_ms is not None:
            floor = eclipse_interval_ms
            cap = max(PLAN_MAX_INTERVALS_MS["eclipse"], eclipse_interval_ms)
        else:
            floor = PLAN_INTERVALS_MS.get(key, _DEFAULT)
            cap = PLAN_MAX_INTERVALS_MS.get(key, _DEFAULT_CAP)
        if floor < best_floor:
            best_floor, best_cap = floor, cap
    return best_cap


def effective_interval(plans: list[str], streak: int = 0, eclipse_interval_ms: int | None = None) -> int:
    """The URL's actual scrape interval (ms): the cross-plan floor widened by the
    unchanged-streak, clamped to [floor, fastest-plan cap]. Never faster than the
    plan, never staler than the cap; a price/stock change resets streak → floor."""
    floor = interval_for_plans(plans, eclipse_interval_ms)
    cap = max(cap_for_plans(plans, eclipse_interval_ms), floor)
    return int(min(floor * adaptive_multiplier(streak), cap))


def phase_offset_ms(competitor_url_id: uuid.UUID, interval_ms: int) -> int:
    h = hashlib.sha256(str(competitor_url_id).encode()).digest()
    return int.from_bytes(h[:8], "big") % interval_ms


def next_run_after(now: datetime, interval_ms: int, phase_offset_ms: int) -> datetime:
    now_ms = int(now.timestamp() * 1000)
    base = now_ms - (now_ms % interval_ms) + phase_offset_ms
    while base <= now_ms:
        base += interval_ms
    return datetime.fromtimestamp(base / 1000, tz=timezone.utc)


def first_run_at(now: datetime, interval_ms: int, offset: int) -> datetime:
    return next_run_after(now, interval_ms, offset)

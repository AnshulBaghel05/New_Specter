"""Residential proxy-spend guardrail (margin protection).

Datacenter proxy is the workhorse (~$0.30/GB); residential is the expensive
failover (~$8.40/GB — 28×). The fetch hierarchy keeps residential rare, but a
bot-wall wave that flips many domains to JS-required, or a datacenter-pool
failover storm, can silently shift spend onto residential. This guard reads the
day's global per-tier proxy spend (counters written by cost_ledger) and, when
residential SHARE or absolute residential SPEND breaches a configurable cap,
alerts ops once per day — turning a silent margin leak into a same-hour signal.

Split so the policy is unit-testable without I/O:
  evaluate_residential_budget(...)  — pure decision
  run_proxy_guard(redis, now)       — read counters + alert ops on breach (once/day)

Schedule run_proxy_guard hourly (run_proxy_guard.py); see CRON.md. Thresholds:
  RESIDENTIAL_MAX_SHARE        (default 0.20 — the 80/20 rule)
  RESIDENTIAL_MAX_USD_PER_DAY  (default 50.0 — absolute daily residential ceiling)
  OPS_ALERT_EMAIL              (recipient; unset → alert is a logged no-op)
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from services import email
from services.cost_ledger import read_proxy_tier_spend

logger = logging.getLogger("proxy_guard")

DEFAULT_MAX_SHARE = 0.20    # residential should stay ≤20% of proxy spend (80/20)
DEFAULT_MAX_USD = 50.0      # absolute daily residential ceiling, USD
# Don't alert on a tiny early-day base where one residential fetch is 100% of a
# few cents of total spend.
MIN_TOTAL_USD_FOR_SHARE = 1.0
_ALERT_TTL_S = 26 * 3600   # once-per-day dedup flag (a little over 24h)


def _env_float(key: str, default: float) -> float:
    v = os.environ.get(key)
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def max_share() -> float:
    return _env_float("RESIDENTIAL_MAX_SHARE", DEFAULT_MAX_SHARE)


def max_usd() -> float:
    return _env_float("RESIDENTIAL_MAX_USD_PER_DAY", DEFAULT_MAX_USD)


def _day(now: datetime) -> str:
    return now.strftime("%Y-%m-%d")


@dataclass(frozen=True)
class BudgetStatus:
    residential_usd: float
    datacenter_usd: float
    total_usd: float
    residential_share: float
    breached: bool
    reasons: tuple[str, ...]
    max_share: float
    max_usd: float


def evaluate_residential_budget(
    residential_usd: float,
    datacenter_usd: float,
    *,
    max_share: float,
    max_usd: float,
    min_total_usd: float = MIN_TOTAL_USD_FOR_SHARE,
) -> BudgetStatus:
    """Pure budget decision. Breaches on residential SHARE (only once total spend
    clears `min_total_usd`, so a noisy early day doesn't false-alarm) OR on
    absolute residential USD."""
    total = residential_usd + datacenter_usd
    share = (residential_usd / total) if total > 0 else 0.0
    reasons: list[str] = []
    if total >= min_total_usd and share > max_share:
        reasons.append("share")
    if residential_usd > max_usd:
        reasons.append("usd")
    return BudgetStatus(
        residential_usd=residential_usd,
        datacenter_usd=datacenter_usd,
        total_usd=total,
        residential_share=share,
        breached=bool(reasons),
        reasons=tuple(reasons),
        max_share=max_share,
        max_usd=max_usd,
    )


def _claim_alert_flag(redis, day: str) -> bool:
    """Set a once-per-day flag; True when WE won (first breach today → send),
    False when it already existed (already alerted → stay quiet)."""
    won = redis.set(f"proxyguard:alerted:{day}", "1", nx=True, ex=_ALERT_TTL_S)
    return bool(won)


async def run_proxy_guard(redis, now: Optional[datetime] = None) -> dict:
    """Read today's per-tier proxy spend, evaluate the residential budget, and on a
    breach alert ops at most once for the day. Best-effort: never raises."""
    now = now or datetime.now(timezone.utc)
    day = _day(now)
    try:
        spend = await asyncio.to_thread(read_proxy_tier_spend, redis, day)
    except Exception:
        logger.exception("proxy_guard: failed to read tier spend (ignored)")
        return {"day": day, "error": "read_failed"}

    status = evaluate_residential_budget(
        spend["residential"], spend["datacenter"], max_share=max_share(), max_usd=max_usd()
    )
    result = {
        "day": day,
        "residential_usd": round(status.residential_usd, 4),
        "datacenter_usd": round(status.datacenter_usd, 4),
        "residential_share": round(status.residential_share, 4),
        "breached": status.breached,
        "reasons": list(status.reasons),
        "alerted": False,
    }

    if status.breached:
        logger.warning(
            "proxy_guard breach day=%s residential=$%.2f (%.0f%% of $%.2f) reasons=%s",
            day, status.residential_usd, status.residential_share * 100,
            status.total_usd, ",".join(status.reasons),
        )
        first_today = await asyncio.to_thread(_claim_alert_flag, redis, day)
        if first_today:
            result["alerted"] = await _alert_ops(status, day)
    return result


async def _alert_ops(status: BudgetStatus, day: str) -> bool:
    to = os.environ.get("OPS_ALERT_EMAIL", "")
    if not to:
        logger.warning("proxy_guard: OPS_ALERT_EMAIL not set — breach alert skipped")
        return False
    return await email.send_residential_budget_alert(
        to,
        day=day,
        residential_usd=status.residential_usd,
        total_usd=status.total_usd,
        share=status.residential_share,
        max_share=status.max_share,
        max_usd=status.max_usd,
        reasons=status.reasons,
    )

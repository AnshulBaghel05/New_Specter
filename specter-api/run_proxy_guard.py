"""Residential proxy-spend guardrail run (margin protection).

Reads today's global per-tier proxy spend (counters written by cost_ledger) and,
when residential spend or share breaches its budget, alerts ops once for the day.

Usage:
  python run_proxy_guard.py            # check TODAY (UTC)
  python run_proxy_guard.py 2026-06-16 # check a specific YYYY-MM-DD

Intended to run hourly from cron/Railway scheduler — far more often than the
daily cost flush, so a residential storm is caught in the hour it starts, not the
next day. Best-effort: never raises. See CRON.md.
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # the app reads os.environ directly; load .env before importing

import asyncio
import sys
from datetime import datetime, timezone

from redis_client import redis as redis_client
from services.proxy_guard import run_proxy_guard


def _target_now(argv: list[str]) -> datetime:
    if len(argv) > 1:
        # Validate the date up front so a typo fails loudly, not silently.
        d = datetime.strptime(argv[1], "%Y-%m-%d")
        return d.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


async def _run(now: datetime) -> dict:
    result = await run_proxy_guard(redis_client, now)
    print(f"[proxy-guard] {result}", flush=True)
    return result


def main() -> None:
    asyncio.run(_run(_target_now(sys.argv)))


if __name__ == "__main__":
    main()

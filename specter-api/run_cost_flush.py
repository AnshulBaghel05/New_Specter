"""Daily cost-ledger flush (Audit #4).

Rolls a day's best-effort Redis cost counters into the merchant_cost_daily
table via an idempotent upsert, so the durable rollup is the billing source of
truth. Safe to re-run — flush_daily upserts, never double-adds.

Usage:
  python run_cost_flush.py            # flush YESTERDAY (UTC) — the cron default
  python run_cost_flush.py 2026-06-09 # flush a specific YYYY-MM-DD

Intended to run once per day from cron/Railway scheduler. The flush *scheduler*
is deliberately out of scope here; this is the runnable flush *job* it calls.
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # the app reads os.environ directly; load .env before importing db

import asyncio
import sys
from datetime import datetime, timedelta, timezone

from db import AsyncSessionLocal
from redis_client import redis as redis_client
from services.cost_ledger import flush_daily


def _target_day(argv: list[str]) -> str:
    if len(argv) > 1:
        # Validate the format up front so a typo fails loudly, not silently.
        datetime.strptime(argv[1], "%Y-%m-%d")
        return argv[1]
    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    return yesterday.strftime("%Y-%m-%d")


async def _run(day: str) -> int:
    async with AsyncSessionLocal() as session:
        written = await flush_daily(session, redis_client, day)
    print(f"[cost-flush] day={day} rows_upserted={written}", flush=True)
    return written


def main() -> None:
    day = _target_day(sys.argv)
    asyncio.run(_run(day))


if __name__ == "__main__":
    main()

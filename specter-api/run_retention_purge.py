"""Daily price-snapshot retention purge (F9 AC#3 — storage cost control).

Deletes price_snapshots past their effective plan retention plus any rows whose
downgrade-grace `delete_at` has elapsed. Wraps services.retention.
purge_expired_snapshots (which commits). Idempotent — safe to re-run.

Usage:
  python run_retention_purge.py        # purge as of now (UTC)

Intended to run once per day from cron / the Railway scheduler, alongside
run_cost_flush.py. Without this job the retention LOGIC never executes and old
snapshots accumulate indefinitely (storage cost leak).
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # the app reads os.environ directly; load .env before importing db

import asyncio
from datetime import datetime, timezone

from db import AsyncSessionLocal
from services.retention import purge_expired_snapshots


async def _run() -> int:
    async with AsyncSessionLocal() as session:
        deleted = await purge_expired_snapshots(session, datetime.now(timezone.utc))
    print(f"[retention-purge] rows_deleted={deleted}", flush=True)
    return deleted


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()

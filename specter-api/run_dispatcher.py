"""Standalone control-plane dispatcher process.

Ticks every DISPATCH_TICK_SECONDS: claims competitor URLs whose next_run_at is due
and enqueues ONE shared crawl each (cross-merchant + cross-plan dedup, adaptive
interval). Run alongside the BullMQ workers:  python run_dispatcher.py
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # the app reads os.environ directly; load .env before importing db

import asyncio
import os
import signal
from datetime import datetime, timezone

from db import AsyncSessionLocal
from redis_client import redis as redis_client
from services.cycle_store import RedisCycleStore
from services.dispatcher import tick

TICK_SECONDS = int(os.environ.get("DISPATCH_TICK_SECONDS", "10"))
BATCH_LIMIT = int(os.environ.get("DISPATCH_BATCH_LIMIT", "200"))

_stop = asyncio.Event()


async def _run() -> None:
    store = RedisCycleStore(redis_client)
    print(f"[dispatcher] started — tick={TICK_SECONDS}s batch={BATCH_LIMIT}", flush=True)
    while not _stop.is_set():
        now = datetime.now(timezone.utc)
        try:
            async with AsyncSessionLocal() as session:
                result = await tick(session, redis_client, store, now, limit=BATCH_LIMIT)
            if result.get("dispatched"):
                print(f"[dispatcher] {result}", flush=True)
        except Exception as e:  # never let one bad tick kill the loop
            print(f"[dispatcher] tick error: {e}", flush=True)
        try:
            await asyncio.wait_for(_stop.wait(), timeout=TICK_SECONDS)
        except asyncio.TimeoutError:
            pass
    print("[dispatcher] stopped", flush=True)


def main() -> None:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _stop.set)
        except NotImplementedError:
            pass  # Windows: SIGTERM signal handlers unsupported on the event loop
    try:
        loop.run_until_complete(_run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

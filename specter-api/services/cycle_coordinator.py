"""Cycle coordinator — defer signal generation until a merchant's whole scrape
cycle has landed.

When the dispatcher enqueues a merchant's URLs for an interval it calls
`open_cycle`, recording how many scrapes are EXPECTED. Each landed scrape —
success OR failure — calls `record_scrape`, advancing the DONE counter; the
moment DONE first reaches EXPECTED the cycle fires signal generation exactly
once (a one-shot `fired` flag wins the race). `close_expired` is the safety
sweep: a cycle whose deadline (end-of-interval + grace) passes with scrapes
still missing — a banned or permanently-failing competitor — fires anyway, so a
merchant's signals never stall on a URL that will never land.

Key lifecycle: every key (expected, done, fired) carries the SAME ttl_ms =
interval + grace, so they co-expire and a Redis adapter never leaves a dangling
counter. Because a key created anywhere inside the cycle lives at least until
the deadline, the sweep — which runs every dispatcher tick — always finds an
expired cycle before its keys vanish.

Delivery is at-least-once and self-healing rather than transactional: `enqueue`
is expected to target a durable broker (BullMQ) that owns its own retry. If a
fire is ever lost, no divergence accrues — `generate_cycle_signals` recomputes
every signal from the merchant's FULL current competitor set on the next cycle,
so a missed cycle is recovered one interval later, not permanently.

The logic is pure coordination over a small key/value store (`CycleStore`). The
production store is Redis-backed (atomic INCRBY + SETNX + SCAN + DEL with TTL);
tests run the identical logic over an in-memory fake. `enqueue` is injected so
the queue dependency stays out of the decision logic — this is the 'divide the
work across the whole cycle before the new signal generation' barrier."""
from __future__ import annotations

from datetime import datetime
from typing import Callable, Protocol


def _to_ms(now: datetime) -> int:
    return int(now.timestamp() * 1000)


class CycleStore(Protocol):
    """The minimal atomic key/value operations the coordinator needs. A Redis
    implementation maps these to INCRBY / GET / SETNX / SCAN / DEL, each
    write-op stamping the shared ttl_ms so every key for a cycle co-expires; the
    in-memory fake mirrors the same semantics for unit tests."""

    def incr_expected(self, merchant_id: str, cycle_id: int, n: int, ttl_ms: int) -> int: ...
    def incr_done(self, merchant_id: str, cycle_id: int, ttl_ms: int) -> int: ...
    def get_counts(self, merchant_id: str, cycle_id: int) -> tuple[int, int]: ...
    def try_set_fired(self, merchant_id: str, cycle_id: int, ttl_ms: int) -> bool: ...
    def all_cycles(self) -> list[tuple[str, int]]: ...
    def cleanup(self, merchant_id: str, cycle_id: int) -> None: ...


Enqueue = Callable[[str, int], None]


def cycle_id_for(now: datetime, interval_ms: int) -> int:
    """The interval bucket index — the stable id shared by every scrape in a
    merchant's cycle for this interval."""
    return _to_ms(now) // interval_ms


def open_cycle(
    store: CycleStore, merchant_id: str, now: datetime,
    interval_ms: int, url_count: int, grace_ms: int = 0,
) -> int:
    """Open (or extend) this interval's cycle, adding url_count to EXPECTED.
    Returns the cycle id. TTL = interval + grace so keys self-expire after the
    safety window."""
    cid = cycle_id_for(now, interval_ms)
    store.incr_expected(merchant_id, cid, url_count, interval_ms + grace_ms)
    return cid


def record_scrape(
    store: CycleStore, enqueue: Enqueue, merchant_id: str, cycle_id: int, ttl_ms: int,
) -> bool:
    """Count one landed scrape (success OR failure both advance DONE). When DONE
    first reaches EXPECTED, fire signal generation exactly once. ttl_ms keeps the
    DONE key co-expiring with EXPECTED. Returns True iff this call fired."""
    done = store.incr_done(merchant_id, cycle_id, ttl_ms)
    expected, _ = store.get_counts(merchant_id, cycle_id)
    if expected > 0 and done >= expected and store.try_set_fired(merchant_id, cycle_id, ttl_ms):
        enqueue(merchant_id, cycle_id)
        return True
    return False


def close_expired(
    store: CycleStore, enqueue: Enqueue, now: datetime,
    interval_ms: int, grace_ms: int,
) -> list[tuple[str, int]]:
    """Safety sweep: any cycle whose deadline (end-of-interval + grace) has passed
    is closed. If it never completed (DONE < EXPECTED) and has not already fired,
    fire it once so missing/banned URLs cannot stall a merchant's signals. Every
    swept cycle is cleaned up. Returns the cycles that fired in this sweep."""
    now_ms = _to_ms(now)
    ttl_ms = interval_ms + grace_ms
    fired: list[tuple[str, int]] = []
    for merchant_id, cid in store.all_cycles():
        deadline = (cid + 1) * interval_ms + grace_ms
        if now_ms <= deadline:
            continue  # still within the cycle's window
        expected, done = store.get_counts(merchant_id, cid)
        if done < expected and store.try_set_fired(merchant_id, cid, ttl_ms):
            enqueue(merchant_id, cid)
            fired.append((merchant_id, cid))
        store.cleanup(merchant_id, cid)
    return fired

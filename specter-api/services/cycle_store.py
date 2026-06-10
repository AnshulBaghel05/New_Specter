"""Redis-backed CycleStore — the production adapter for the pure cycle
coordinator (services/cycle_coordinator.py).

The coordinator is pure logic over the CycleStore protocol; this maps each
protocol op to atomic Redis commands. Every write stamps the shared ttl_ms via
PEXPIRE so a cycle's three keys (expected, done, fired) co-expire and no dangling
counter is ever left behind. Unit tests run the same coordinator over an
in-memory fake; this adapter is exercised against live Redis in integration.

Keys:
  cycle:{merchant_id}:{cycle_id}:expected   INCRBY counter
  cycle:{merchant_id}:{cycle_id}:done        INCR counter
  cycle:{merchant_id}:{cycle_id}:fired       SET NX one-shot flag
"""
from __future__ import annotations

from redis import Redis

_PREFIX = "cycle"


def _key(merchant_id: str, cycle_id: int, field: str) -> str:
    return f"{_PREFIX}:{merchant_id}:{cycle_id}:{field}"


class RedisCycleStore:
    """Implements the CycleStore protocol over a sync Redis client."""

    def __init__(self, redis_client: Redis) -> None:
        self._r = redis_client

    def incr_expected(self, merchant_id: str, cycle_id: int, n: int, ttl_ms: int) -> int:
        key = _key(merchant_id, cycle_id, "expected")
        val = self._r.incrby(key, n)
        self._r.pexpire(key, ttl_ms)
        return int(val)

    def incr_done(self, merchant_id: str, cycle_id: int, ttl_ms: int) -> int:
        key = _key(merchant_id, cycle_id, "done")
        val = self._r.incr(key)
        self._r.pexpire(key, ttl_ms)
        return int(val)

    def get_counts(self, merchant_id: str, cycle_id: int) -> tuple[int, int]:
        expected = self._r.get(_key(merchant_id, cycle_id, "expected"))
        done = self._r.get(_key(merchant_id, cycle_id, "done"))
        return (int(expected or 0), int(done or 0))

    def try_set_fired(self, merchant_id: str, cycle_id: int, ttl_ms: int) -> bool:
        key = _key(merchant_id, cycle_id, "fired")
        # SET key 1 NX PX ttl_ms — wins the race exactly once.
        return bool(self._r.set(key, "1", nx=True, px=ttl_ms))

    def all_cycles(self) -> list[tuple[str, int]]:
        out: list[tuple[str, int]] = []
        for raw in self._r.scan_iter(match=f"{_PREFIX}:*:expected", count=200):
            key = raw.decode() if isinstance(raw, bytes) else raw
            parts = key.split(":")
            # cycle:{merchant_id}:{cycle_id}:expected
            if len(parts) == 4:
                try:
                    out.append((parts[1], int(parts[2])))
                except ValueError:
                    continue
        return out

    def cleanup(self, merchant_id: str, cycle_id: int) -> None:
        self._r.delete(
            _key(merchant_id, cycle_id, "expected"),
            _key(merchant_id, cycle_id, "done"),
            _key(merchant_id, cycle_id, "fired"),
        )

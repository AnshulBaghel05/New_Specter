"""Cycle-completion logic tests, run over an in-memory CycleStore.

The same open_cycle / record_scrape / close_expired logic that runs against
Redis in production is exercised here against FakeStore, which mirrors the
atomic INCRBY / SETNX / SCAN / DEL semantics the coordinator relies on."""
from datetime import datetime, timezone
from services.cycle_coordinator import (
    open_cycle, record_scrape, close_expired, cycle_id_for)

INTERVAL = 3_600_000  # 1h in ms
GRACE = 300_000       # 5m in ms
TTL = INTERVAL + GRACE


class FakeStore:
    """In-memory stand-in for the Redis-backed CycleStore. Models EXPECTED/DONE
    counters and a one-shot `fired` flag with the same semantics as the atomic
    Redis ops (INCRBY / SETNX). Each write stamps ttl_ms. The `fired` flag
    deliberately survives cleanup, mirroring the Redis key's own TTL, so a late
    duplicate scrape after cleanup cannot re-fire a cycle."""
    def __init__(self):
        self.expected: dict = {}
        self.done: dict = {}
        self.fired: set = set()
        self.ttls: dict = {}

    def incr_expected(self, merchant_id, cycle_id, n, ttl_ms):
        k = (merchant_id, cycle_id)
        self.expected[k] = self.expected.get(k, 0) + n
        self.ttls[k] = ttl_ms
        return self.expected[k]

    def incr_done(self, merchant_id, cycle_id, ttl_ms):
        k = (merchant_id, cycle_id)
        self.done[k] = self.done.get(k, 0) + 1
        self.ttls[k] = ttl_ms
        return self.done[k]

    def get_counts(self, merchant_id, cycle_id):
        k = (merchant_id, cycle_id)
        return self.expected.get(k, 0), self.done.get(k, 0)

    def try_set_fired(self, merchant_id, cycle_id, ttl_ms):
        k = (merchant_id, cycle_id)
        if k in self.fired:
            return False
        self.fired.add(k)
        return True

    def all_cycles(self):
        return list(set(self.expected) | set(self.done))

    def cleanup(self, merchant_id, cycle_id):
        k = (merchant_id, cycle_id)
        self.expected.pop(k, None)
        self.done.pop(k, None)
        self.ttls.pop(k, None)
        # `fired` is intentionally NOT cleared (mirrors Redis TTL expiry).


def _enq_collector():
    calls = []
    def enqueue(merchant_id, cycle_id):
        calls.append((merchant_id, cycle_id))
    return calls, enqueue


def _at(y=2026, mo=6, d=6, h=12, mi=0, s=5):
    return datetime(y, mo, d, h, mi, s, tzinfo=timezone.utc)


def _after_deadline(cycle_id):
    # one second past (end-of-interval + grace)
    return datetime.fromtimestamp(((cycle_id + 1) * INTERVAL + GRACE) / 1000 + 1, tz=timezone.utc)


def test_open_cycle_sets_expected_and_returns_id():
    store = FakeStore()
    now = _at()
    cid = open_cycle(store, "m1", now, INTERVAL, url_count=3, grace_ms=GRACE)
    assert cid == cycle_id_for(now, INTERVAL)
    expected, done = store.get_counts("m1", cid)
    assert expected == 3 and done == 0
    assert store.ttls[("m1", cid)] == TTL  # keys carry interval+grace TTL


def test_record_scrape_increments_done():
    store = FakeStore()
    cid = open_cycle(store, "m1", _at(), INTERVAL, 3, GRACE)
    calls, enqueue = _enq_collector()
    fired = record_scrape(store, enqueue, "m1", cid, TTL)
    _, done = store.get_counts("m1", cid)
    assert done == 1
    assert fired is False
    assert calls == []  # not complete yet


def test_cycle_fires_signal_when_done_reaches_expected():
    store = FakeStore()
    cid = open_cycle(store, "m1", _at(), INTERVAL, 3, GRACE)
    calls, enqueue = _enq_collector()
    results = [record_scrape(store, enqueue, "m1", cid, TTL) for _ in range(3)]
    assert results == [False, False, True]
    assert calls == [("m1", cid)]  # exactly once at completion


def test_failed_scrape_also_advances_cycle():
    # A banned URL reporting via /scrape-failed calls record_scrape exactly like
    # a success — both advance DONE so a failure can never stall completion.
    store = FakeStore()
    cid = open_cycle(store, "m1", _at(), INTERVAL, 2, GRACE)
    calls, enqueue = _enq_collector()
    record_scrape(store, enqueue, "m1", cid, TTL)              # a success
    did_fire = record_scrape(store, enqueue, "m1", cid, TTL)   # a failure still counts
    assert did_fire is True
    assert calls == [("m1", cid)]


def test_stale_cycle_closes_on_sweep_after_timeout():
    store = FakeStore()
    cid = open_cycle(store, "m1", _at(), INTERVAL, 3, GRACE)
    calls, enqueue = _enq_collector()
    record_scrape(store, enqueue, "m1", cid, TTL)  # only 1 of 3 ever lands
    assert calls == []
    fired = close_expired(store, enqueue, _after_deadline(cid), INTERVAL, GRACE)
    assert fired == [("m1", cid)]
    assert calls == [("m1", cid)]                 # stale cycle fired exactly once
    assert store.get_counts("m1", cid) == (0, 0)  # keys cleaned


def test_total_stall_done_zero_closes_on_sweep():
    # Worst case: every URL banned / worker crash — zero scrapes ever land.
    store = FakeStore()
    cid = open_cycle(store, "m1", _at(), INTERVAL, 5, GRACE)
    calls, enqueue = _enq_collector()
    fired = close_expired(store, enqueue, _after_deadline(cid), INTERVAL, GRACE)
    assert fired == [("m1", cid)]   # done=0 < expected=5 → still fires
    assert calls == [("m1", cid)]


def test_completion_is_idempotent():
    store = FakeStore()
    cid = open_cycle(store, "m1", _at(), INTERVAL, 2, GRACE)
    calls, enqueue = _enq_collector()
    record_scrape(store, enqueue, "m1", cid, TTL)
    record_scrape(store, enqueue, "m1", cid, TTL)  # completes → fires
    record_scrape(store, enqueue, "m1", cid, TTL)  # late duplicate must NOT re-fire
    assert calls == [("m1", cid)]


def test_sweep_does_not_refire_completed_cycle():
    store = FakeStore()
    cid = open_cycle(store, "m1", _at(), INTERVAL, 1, GRACE)
    calls, enqueue = _enq_collector()
    record_scrape(store, enqueue, "m1", cid, TTL)  # completes + fires
    fired = close_expired(store, enqueue, _after_deadline(cid), INTERVAL, GRACE)
    assert fired == []                            # nothing new fired
    assert calls == [("m1", cid)]                 # still exactly one fire total
    assert store.get_counts("m1", cid) == (0, 0)  # completed cycle still cleaned


def test_sweep_ignores_cycle_still_within_window():
    store = FakeStore()
    now = _at()
    cid = open_cycle(store, "m1", now, INTERVAL, 3, GRACE)
    calls, enqueue = _enq_collector()
    record_scrape(store, enqueue, "m1", cid, TTL)  # incomplete, but still in-window
    fired = close_expired(store, enqueue, now, INTERVAL, GRACE)  # swept at open time
    assert fired == []
    assert calls == []
    assert store.get_counts("m1", cid) == (3, 1)  # untouched

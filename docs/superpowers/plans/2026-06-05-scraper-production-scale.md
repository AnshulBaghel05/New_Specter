# SPECTER Scraper — Production-Scale + Anti-Ban Cycle Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the prototype BullMQ scraper into a production-grade, ban-resistant system that (a) **spreads every domain's scrapes evenly across the full plan interval** instead of bursting them at the cycle boundary, (b) **only generates the new RAISE/LOWER signal once a merchant's whole scrape cycle has landed** (consistent competitor snapshot), and (c) closes the currently-missing, unauthenticated, non-idempotent write path.

**Architecture:** Three planes. **Control plane** = a Python dispatcher in `specter-api` that reads per-URL `next_run_at` from Postgres (`FOR UPDATE SKIP LOCKED`) and enqueues jobs with a stable per-URL phase offset so load is uniform across the interval. **Data plane** = the existing stateless BullMQ fetch workers (probe/http/playwright), hardened with an atomic Lua rate limiter, a real proxy-rotation manager, and per-domain concurrency caps so we never burst a single target. **Ingest plane** = a new authenticated, idempotent `/internal` router that persists snapshots, advances a per-merchant **cycle counter**, and triggers signal generation only when the cycle completes (or its window closes). OOS detection stays near-real-time; RAISE/LOWER moves to cycle-complete.

**Tech Stack:** FastAPI + SQLAlchemy async (dispatcher, ingest, cycle coordinator), BullMQ + ioredis (queues), dedicated self-managed Redis for the broker, separate Redis (TTL+LRU) for state/rate-limit/cycle, Postgres (`SKIP LOCKED` scheduling + partitioned snapshots), Lua scripts for atomic limiter/cycle ops, `got`/undici + Playwright/CDP fetch, Prometheus/OTel/Bull Board observability, Kubernetes + KEDA autoscale.

---

## File Structure

**specter-api (control + ingest + cycle):**
- `models/competitor_urls.py` — add `next_run_at`, `interval_ms`, `phase_offset_ms` (Modify)
- `alembic/versions/0009_scrape_schedule.py` + `supabase/migrations/0011_scrape_schedule.sql` (Create)
- `services/scrape_scheduler.py` — pure offset/interval math (Create)
- `services/scrape_dispatcher.py` — SKIP-LOCKED poll → enqueue (Create)
- `services/cycle_coordinator.py` — cycle counters + completion → signal trigger (Create)
- `routers/internal.py` — HMAC-authed ingest (price-snapshot[:batch], scrape-failed, domain-blocked) (Create)
- `auth/internal_auth.py` — HMAC verify dependency (Create)
- `queue_client.py` — add `enqueue_scrape_job`, `enqueue_signal_cycle` (Modify)
- `signals/dispatcher.py` — split OOS-now from cycle-deferred signal generation (Modify)
- `main.py` — register `internal.router` (Modify)
- `workers/scrape_dispatcher_main.py` — long-running dispatcher entrypoint (Create)

**scraper (data plane hardening):**
- `workers/rate-limiter.ts` — atomic Lua token bucket + per-domain concurrency lease (Modify)
- `proxy/manager.ts` — rotation/health/failover pool (Create)
- `proxy/manager.test.ts` (Create)
- `workers/http.ts`, `workers/probe.ts`, `workers/playwright.ts` — use ProxyManager + signed ingest + concurrency lease (Modify)
- `scheduler.ts` — remove `scheduleRepeatJobs` repeatables; keep priority/interval constants + `SET NX` batch lock (Modify)
- `lib/ingest-client.ts` — HMAC-signed POST helper + batch buffer (Create)
- `workers/captcha-solver.ts` — async 2captcha pool (Create)

---

## Phase 0 — Close & secure the write path (BLOCKER)

*Nothing in the pipeline persists today: workers POST to `/internal/*` which does not exist. Build it first, authenticated and idempotent, so every later phase has a real destination.*

### Task 0.1: HMAC auth dependency

**Files:**
- Create: `specter-api/auth/internal_auth.py`
- Create: `specter-api/auth/test_internal_auth.py`

- [ ] **Step 1: Write the failing test**

```python
# specter-api/auth/test_internal_auth.py
import os, time, hmac, hashlib, json
os.environ.setdefault("SCRAPER_INGEST_SECRET", "test-ingest-secret")
from auth.internal_auth import verify_ingest_signature

def _sig(body: bytes, ts: str, secret="test-ingest-secret") -> str:
    return hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()

def test_valid_signature_passes():
    body = json.dumps({"a": 1}).encode()
    ts = str(int(time.time()))
    assert verify_ingest_signature(body, ts, _sig(body, ts)) is True

def test_tampered_body_fails():
    ts = str(int(time.time()))
    assert verify_ingest_signature(b'{"a":2}', ts, _sig(b'{"a":1}', ts)) is False

def test_stale_timestamp_fails():
    body = b"{}"
    ts = str(int(time.time()) - 600)  # 10 min old
    assert verify_ingest_signature(body, ts, _sig(body, ts)) is False

def test_missing_signature_fails():
    assert verify_ingest_signature(b"{}", str(int(time.time())), "") is False
```

- [ ] **Step 2: Run test, verify it fails** — `.venv/Scripts/python.exe -m pytest auth/test_internal_auth.py -v` → ImportError.

- [ ] **Step 3: Implement**

```python
# specter-api/auth/internal_auth.py
"""HMAC auth for scraper→API internal ingest. The scraper signs
`{timestamp}.{raw_body}` with SCRAPER_INGEST_SECRET; we recompute and
constant-time compare, rejecting anything older than MAX_SKEW_SECONDS."""
from __future__ import annotations
import hashlib, hmac, os, time

from fastapi import Header, HTTPException, Request

MAX_SKEW_SECONDS = 300


def verify_ingest_signature(body: bytes, timestamp: str, signature: str, secret: str | None = None) -> bool:
    secret = secret if secret is not None else os.environ.get("SCRAPER_INGEST_SECRET", "")
    if not secret or not signature or not timestamp:
        return False
    try:
        if abs(int(time.time()) - int(timestamp)) > MAX_SKEW_SECONDS:
            return False
    except (ValueError, TypeError):
        return False
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def require_ingest_auth(
    request: Request,
    x_specter_timestamp: str = Header(""),
    x_specter_signature: str = Header(""),
) -> None:
    raw = await request.body()
    if not verify_ingest_signature(raw, x_specter_timestamp, x_specter_signature):
        raise HTTPException(status_code=401, detail={"error": "invalid_ingest_signature"})
```

- [ ] **Step 4: Run test, verify pass.**
- [ ] **Step 5: Commit** — `git add auth/internal_auth.py auth/test_internal_auth.py && git commit -m "feat(api): HMAC auth for internal scraper ingest"`

### Task 0.2: Idempotent snapshot ingest + cycle counter (single + batch)

**Files:**
- Create: `specter-api/routers/internal.py`
- Modify: `specter-api/main.py` (register router)
- Create: `specter-api/routers/test_internal.py`
- Reference: `models/price_snapshots.py` (add `job_uuid` unique col via migration in Task 0.3)

- [ ] **Step 1: Write the failing test** (TestClient + dependency_overrides like `routers/test_signals.py`).

```python
# specter-api/routers/test_internal.py  (env preamble identical to routers/test_signals.py)
# ...env setdefaults + SUPABASE_JWT_SECRET + SCRAPER_INGEST_SECRET...
import hmac, hashlib, time, json, uuid
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from auth.internal_auth import require_ingest_auth
from db import get_db
from main import app

def _signed(client, path, payload):
    body = json.dumps(payload).encode(); ts = str(int(time.time()))
    sig = hmac.new(b"test-ingest-secret", ts.encode()+b"."+body, hashlib.sha256).hexdigest()
    return client.post(path, content=body, headers={
        "Content-Type":"application/json","X-Specter-Timestamp":ts,"X-Specter-Signature":sig})

def test_unsigned_request_rejected():
    with TestClient(app) as c:
        r = c.post("/internal/price-snapshot", json={"domain":"x"})
    assert r.status_code == 401

def test_batch_insert_dedupes_on_job_uuid(monkeypatch):
    # session.execute → upsert returns rowcount; second identical job_uuid is a no-op.
    # cycle counter increment returns (done, expected) so completion can be asserted.
    ...
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** the router. Endpoints:
  - `POST /internal/price-snapshot` and `POST /internal/price-snapshot:batch` — body items carry `job_uuid`, `competitor_url_id` (resolved by domain+url_path), `price/currency/in_stock/title/needs_review`, `merchant_cycle_ids: [{merchant_id, cycle_id}]`. Insert with `ON CONFLICT (job_uuid) DO NOTHING` (idempotent). For each inserted snapshot: run **OOS detection now** (urgency) via `oos_detector`, then call `cycle_coordinator.record_scrape(...)` (Task 1.5) which may enqueue signal generation when the cycle completes. Owns the transaction (commit once).
  - `POST /internal/scrape-failed` — mark tracking failure; **still advances the cycle counter** (a banned/failed URL must not stall cycle completion).
  - `POST /internal/domain-blocked` — set `robots_blocked` + notify (reuses existing email path), and advance the cycle counter.

```python
# specter-api/routers/internal.py  (key shape)
router = APIRouter(prefix="/internal", tags=["internal"], dependencies=[Depends(require_ingest_auth)])

@router.post("/price-snapshot:batch")
async def ingest_batch(body: SnapshotBatchIn, session: AsyncSession = Depends(get_db),
                       redis_client: Redis = Depends(get_redis)) -> dict:
    inserted = 0
    for item in body.items:
        snap_id = await _upsert_snapshot(session, item)   # ON CONFLICT(job_uuid) DO NOTHING
        if snap_id is None:
            continue  # duplicate retry — skip side-effects entirely
        inserted += 1
        await oos_detector.detect_and_write(session, item.competitor_url_id, snap_id, item.in_stock)
        for mc in item.merchant_cycle_ids:
            await cycle_coordinator.record_scrape(session, redis_client, mc.merchant_id, mc.cycle_id,
                                                  competitor_url_id=item.competitor_url_id)
    await session.commit()
    return {"inserted": inserted, "received": len(body.items)}
```

- [ ] **Step 4: Register** in `main.py`: `from routers import internal` + `app.include_router(internal.router)`.
- [ ] **Step 5: Run tests, verify pass. Commit.**

### Task 0.3: Migration — `job_uuid` + scrape-schedule columns

**Files:**
- Create: `specter-api/alembic/versions/0009_scrape_schedule.py`
- Create: `specter-api/supabase/migrations/0011_scrape_schedule.sql`
- Modify: `models/price_snapshots.py` (`job_uuid: Mapped[Optional[uuid.UUID]]`, unique), `models/competitor_urls.py`

- [ ] Add `price_snapshots.job_uuid UUID UNIQUE NULL` (idempotency key).
- [ ] Add to `competitor_urls`: `interval_ms BIGINT`, `phase_offset_ms BIGINT`, `next_run_at TIMESTAMPTZ NULL`, plus index `CREATE INDEX ix_curls_next_run ON competitor_urls (next_run_at) WHERE next_run_at IS NOT NULL`.
- [ ] Update `tests/test_models.py` column-set assertions. Run `pytest tests/test_models.py`. Commit.

---

## Phase 1 — Anti-ban cycle dispatch + cycle-barrier signals (THE PRIORITY)

*Replace burst-at-boundary repeatables with even spreading across the interval; make per-domain limits atomic and proxy IPs rotate; defer signal generation until a merchant's cycle is complete.*

### Task 1.1: Pure scheduling math (offset + next-run)

**Files:**
- Create: `specter-api/services/scrape_scheduler.py`
- Create: `specter-api/services/test_scrape_scheduler.py`

- [ ] **Step 1: Write the failing test**

```python
# specter-api/services/test_scrape_scheduler.py
import uuid
from datetime import datetime, timezone, timedelta
from services.scrape_scheduler import (
    PLAN_INTERVALS_MS, interval_for_plans, phase_offset_ms, next_run_after, first_run_at)

def test_interval_is_the_most_frequent_plan():
    # A URL tracked by RECON(6h) and PREDATOR(1h) scrapes at the PREDATOR rate.
    assert interval_for_plans(["recon", "predator"]) == PLAN_INTERVALS_MS["predator"]

def test_phase_offset_is_stable_and_within_interval():
    cu = uuid.UUID("11111111-1111-1111-1111-111111111111")
    off = phase_offset_ms(cu, 3_600_000)
    assert 0 <= off < 3_600_000
    assert phase_offset_ms(cu, 3_600_000) == off  # deterministic

def test_offsets_spread_across_window():
    # 1000 distinct URLs should populate many distinct buckets (even spread, not clustered).
    offs = {phase_offset_ms(uuid.uuid4(), 3_600_000) // 60_000 for _ in range(1000)}
    assert len(offs) > 30  # >30 of 60 one-minute buckets hit

def test_next_run_preserves_phase_and_advances_past_now():
    now = datetime(2026, 6, 5, 12, 0, 30, tzinfo=timezone.utc)
    interval = 3_600_000; offset = 90_000  # phase = 00:01:30 each hour
    nxt = next_run_after(now, interval_ms=interval, phase_offset_ms=offset)
    assert nxt > now
    # phase preserved: ms-of-interval since epoch == offset
    epoch_ms = int(nxt.timestamp() * 1000)
    assert epoch_ms % interval == offset
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement**

```python
# specter-api/services/scrape_scheduler.py
"""Pure scheduling math: when each competitor URL is scraped.

Even-spread design (anti-ban): every URL gets a STABLE phase offset =
hash(competitor_url_id) % interval. Across all URLs sharing an interval the
offsets are uniform over [0, interval), so the dispatcher emits a steady
trickle instead of a boundary burst. next_run_at always lands on the same
phase, one interval at a time, so the spread is stable cycle-over-cycle."""
from __future__ import annotations
import hashlib, uuid
from datetime import datetime, timedelta, timezone

PLAN_INTERVALS_MS: dict[str, int] = {
    "recon": 21_600_000, "cipher": 10_800_000, "phantom": 7_200_000,
    "predator": 3_600_000, "eclipse": 300_000,
}
_DEFAULT = PLAN_INTERVALS_MS["recon"]


def interval_for_plans(plans: list[str], eclipse_interval_ms: int | None = None) -> int:
    """Most-frequent (smallest) interval among the merchants tracking a URL."""
    best = _DEFAULT
    for p in plans:
        key = p.lower()
        iv = eclipse_interval_ms if (key == "eclipse" and eclipse_interval_ms) else PLAN_INTERVALS_MS.get(key, _DEFAULT)
        best = min(best, iv)
    return best


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
```

- [ ] **Step 4: Run, verify pass. Step 5: Commit.**

### Task 1.2: SKIP-LOCKED dispatcher service

**Files:**
- Create: `specter-api/services/scrape_dispatcher.py`
- Create: `specter-api/services/test_scrape_dispatcher.py`
- Modify: `specter-api/queue_client.py` (add `enqueue_scrape_job`)

- [ ] **Step 1: Test (mocked session + redis):** assert one `tick()` selects due URLs, enqueues one job per URL via `queue_client`, opens a cycle (`cycle_coordinator.open_cycle`), and advances `next_run_at` with preserved phase. Assert URLs with `next_run_at > now` are not selected.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** `tick(session, redis, now, batch=500)`:

```python
# core of services/scrape_dispatcher.py
async def tick(session, redis, now=None, batch=500):
    now = now or datetime.now(tz=timezone.utc)
    rows = (await session.execute(
        select(CompetitorURL)
        .where(CompetitorURL.next_run_at.is_not(None), CompetitorURL.next_run_at <= now)
        .order_by(CompetitorURL.next_run_at)
        .limit(batch).with_for_update(skip_locked=True)
    )).scalars().all()

    for cu in rows:
        trackings = await _enabled_trackings(session, cu.id)          # (merchant_id, plan)
        if not trackings:
            cu.next_run_at = None; continue                            # nobody tracks it
        # Open one cycle per merchant tracking this URL; record expected counts.
        cycle_ids = {}
        for merchant_id in {t.merchant_id for t in trackings}:
            cycle_ids[merchant_id] = await cycle_coordinator.open_cycle(redis, merchant_id, now)
        enqueue_scrape_job(redis, {
            "url": cu.url, "domain": cu.domain, "urlPath": cu.url_path,
            "competitorTrackingIds": [str(t.id) for t in trackings],
            "merchantCycleIds": [{"merchant_id": str(m), "cycle_id": c} for m, c in cycle_ids.items()],
            "plan": _highest_plan(trackings),
        })
        cu.next_run_at = next_run_after(now, cu.interval_ms, cu.phase_offset_ms)
    await session.commit()
    return len(rows)
```

`enqueue_scrape_job` routes by `domain:class:{domain}` (probe if unknown) exactly like the current scheduler, using `queue_client._enqueue`.

- [ ] **Step 4: Run, verify pass. Commit.**

### Task 1.3: Dispatcher entrypoint (long-running)

**Files:** Create `specter-api/workers/scrape_dispatcher_main.py`

- [ ] Loop every `DISPATCH_POLL_SECONDS` (default 5): open a session, call `scrape_dispatcher.tick`, sleep. **Backpressure:** before selecting, read broker queue depth; if `waiting > MAX_BACKLOG`, skip this tick (protects targets + Postgres). Graceful SIGTERM/SIGINT. Multiple replicas are safe (SKIP LOCKED). Document `python -m workers.scrape_dispatcher_main`. No new unit test (thin loop); covered by 1.2. Commit.

### Task 1.4: Atomic per-domain rate limit + concurrency lease (scraper)

**Files:**
- Modify: `scraper/workers/rate-limiter.ts`
- Modify: `scraper/__tests__/rate-limiter.test.ts` (create if absent)

- [ ] **Step 1: Test** — fire 50 concurrent `checkRateLimit` for the same domain (limit 6) via a real/`ioredis-mock`; assert **exactly 6** allowed (no overshoot — proves atomicity), the rest `allowed:false` with `retryAfterMs>0`. Add a concurrency-lease test: `acquireSlot` succeeds up to `maxConcurrent`, the next returns false until `releaseSlot`.

- [ ] **Step 2: Run, verify fail** (current GET-then-INCR overshoots).

- [ ] **Step 3: Implement** a single Lua script evaluated atomically — token-bucket per `ratelimit:{domain}` (refill = limit/60s), returning `{allowed, retryAfterMs}`; plus `acquireSlot`/`releaseSlot` using `INCR`/`DECR` on `concurrency:{domain}` guarded by the same script (cap = per-domain max in-flight). This removes the documented race in `rate-limiter.ts:67` and adds a hard ceiling on *simultaneous* hits to one target — the core ban defense alongside spreading.

```lua
-- KEYS[1]=ratelimit key  ARGV[1]=limit ARGV[2]=window_ms ARGV[3]=now_ms
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1]) ; local ts = tonumber(data[2])
local limit = tonumber(ARGV[1]) ; local win = tonumber(ARGV[2]) ; local now = tonumber(ARGV[3])
if tokens == nil then tokens = limit ; ts = now end
local refill = (now - ts) * limit / win
tokens = math.min(limit, tokens + refill)
if tokens < 1 then
  redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now) ; redis.call('PEXPIRE', KEYS[1], win)
  return {0, math.ceil((1 - tokens) * win / limit)}
end
tokens = tokens - 1
redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now) ; redis.call('PEXPIRE', KEYS[1], win)
return {1, 0}
```

- [ ] **Step 4: Run, verify pass. Commit.**

### Task 1.5: Cycle coordinator — defer signals to cycle completion

**Files:**
- Create: `specter-api/services/cycle_coordinator.py`
- Create: `specter-api/services/test_cycle_coordinator.py`
- Modify: `specter-api/queue_client.py` (`enqueue_signal_cycle`)
- Modify: `specter-api/signals/dispatcher.py` (extract a `generate_cycle_signals(merchant_id)` callable; keep OOS immediate)

- [ ] **Step 1: Test the completion logic (pure-ish over a fake redis):**

```python
# specter-api/services/test_cycle_coordinator.py (key cases)
def test_open_cycle_sets_expected_and_returns_id(): ...
def test_record_scrape_increments_done(): ...
def test_cycle_fires_signal_when_done_reaches_expected():
    # open_cycle(expected=3); 3× record_scrape → enqueue_signal_cycle called exactly once.
def test_failed_scrape_also_advances_cycle():
    # a banned URL calling record_scrape (via /scrape-failed) still counts toward completion.
def test_stale_cycle_closes_on_sweep_after_timeout():
    # close_expired() fires signal generation for cycles past interval+grace with done<expected.
def test_completion_is_idempotent():
    # extra record_scrape after completion does NOT enqueue a second signal cycle.
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement.** Keys in the **state Redis** (TTL = interval + grace):
  - `open_cycle(redis, merchant_id, now) -> cycle_id` (cycle_id = interval bucket index). Increments `cycle:expected:{merchant}:{cycle}` by the number of URLs enqueued for that merchant this tick; sets TTL.
  - `record_scrape(...)` increments `cycle:done:{merchant}:{cycle}` and runs an **atomic Lua compare**: if `done >= expected` AND a `cycle:fired:{merchant}:{cycle}` flag is unset → set the flag and `enqueue_signal_cycle(merchant, cycle)`. The flag makes firing exactly-once.
  - `close_expired(redis, session, now)` — sweep cycles past `interval+grace` with `done < expected`, fire once (so missing/banned URLs never stall signals), and clean keys. Runs from the dispatcher loop or a cron tick.
  - A small `signal:cycle` BullMQ queue consumed by a worker that calls `signals.dispatcher.generate_cycle_signals(merchant_id)` — which now runs RAISE/LOWER over the **full, freshly-landed** competitor set for every affected SKU of that merchant (one AI batch per merchant, exactly as `dispatch_on_snapshot` does today, but once per cycle instead of per snapshot).

- [ ] **Step 4: Refactor `signals/dispatcher.py`:** split the per-merchant signal/reprice body out of `dispatch_on_snapshot` into `generate_cycle_signals(session, redis, merchant_id)`. The ingest endpoint (Task 0.2) keeps calling **OOS detection per snapshot** (time-sensitive) but no longer generates RAISE/LOWER inline. Update `signals/test_dispatcher.py`. Run full backend `pytest`. Commit.

> **Result of Phase 1:** scrapes for each domain are emitted uniformly across the whole interval (no burst → far lower ban risk), per-domain rate + concurrency are atomically capped, and the new RAISE/LOWER signal is computed once per merchant **after the cycle's competitor data has all landed** — exactly "divide these into the whole cycle before the new signal generation."

### Task 1.6: Proxy rotation manager (scraper)

**Files:**
- Create: `scraper/proxy/manager.ts`, `scraper/proxy/manager.test.ts`
- Modify: `scraper/workers/{http,probe,playwright}.ts` to source proxies from the manager

- [ ] **Step 1: Test** `ProxyManager`: round-robins across a pool; `reportFailure(ip, 403)` ejects + cools down (not handed out until cooldown elapses); `reportSuccess` restores score; when all DC proxies are cooling, `next('datacenter')` fails over to the next provider; sticky `next(domain)` returns the same IP within a session window.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement.** Pool from `PROXY_DATACENTER_URLS` / `PROXY_RESIDENTIAL_URLS` (comma-lists or a provider gateway). Per-IP health scored in the **state Redis** (`proxy:health:{ip}`) so all worker pods share ban knowledge. `next(tier, domain?)` returns a healthy IP (sticky by domain when requested); `reportResult(ip, status)` updates score and triggers cooldown on 403/429/CAPTCHA. Reuse one `ProxyAgent` per IP (fixes the per-job `new ProxyAgent` in `http.ts:53`).

- [ ] **Step 4: Wire** workers to call `ProxyManager.next(...)` and `reportResult(...)` around each fetch; on repeated bans for a domain, **lower that domain's concurrency lease** (Task 1.4) dynamically. Run scraper tests (`npx vitest run`). Commit.

### Task 1.7: Remove repeatables; signed batch ingest client

**Files:**
- Modify: `scraper/scheduler.ts` (delete `scheduleRepeatJobs`; keep `PLAN_PRIORITY`, dispatch helper, switch batch lock to `SET NX PX`)
- Create: `scraper/lib/ingest-client.ts`
- Modify: `scraper/workers/{http,playwright,probe}.ts` to POST via the signed client (buffer ~50 results / 1s → `/internal/price-snapshot:batch`)

- [ ] Replace the three ad-hoc `fetch(.../internal/...)` calls with `ingestClient.snapshot(...)`, `ingestClient.scrapeFailed(...)`, `ingestClient.domainBlocked(...)` — each adds `X-Specter-Timestamp` + HMAC `X-Specter-Signature` over `{ts}.{body}` using `SCRAPER_INGEST_SECRET`, and forwards `merchantCycleIds` from the job so the cycle counter advances. Buffer snapshots and flush in batches (peak smoothing).
- [ ] Fix the batch lock in `dispatchScrapeJob`: `SET lockKey jobId NX PX interval` and only create a job when the `NX` set succeeds (removes the `scheduler.ts:71-89` race). Run scraper tests. Commit.

---

## Phase 2 — Queue & state infrastructure hardening

### Task 2.1: Dedicated broker Redis + isolated state Redis
- [ ] Provision a self-managed Redis 7 for BullMQ (broker) and a **separate** Redis (state: rate-limit, locks, `last-price`, `domain:class`, cycle counters, proxy health) with `maxmemory-policy allkeys-lru`. Add `BROKER_REDIS_URL` + `STATE_REDIS_URL`; split `scraper/redis.ts` into `brokerConnection` (BullMQ) and `stateRedis` (ioredis). Update `.env.example` files. Verify `npm run dev` + workers connect. Commit.

### Task 2.2: State TTLs + stalled-job recovery
- [ ] `last-price:*` → `SET ... EX (2×interval)`; `domain:class:*` → `EX 7d` (self-healing reclassification). Configure BullMQ worker options: `lockDuration`, `stalledInterval`, `maxStalledCount: 2` on all three workers so a crashed pod's jobs are reclaimed, not lost. Add a test asserting `last-price` writes include a TTL. Commit.

---

## Phase 3 — Fetch-tier scaling

### Task 3.1: Shared browser farm over CDP
- [ ] Replace the per-process `chromium.launch` (`playwright.ts:91`) with `chromium.connectOverCDP(BROWSER_WS_ENDPOINT)` against a Browserless/own pool; keep stealth context + relaunch-every-N as context recycling. Browser capacity now scales independently of job workers. Update playwright worker tests (mock the CDP connect). Commit.

### Task 3.2: Async CAPTCHA offload
- [ ] Create `scraper/workers/captcha-solver.ts` consuming a `captcha:solve` queue: detect→submit 2captcha→poll→re-enqueue the original `scrape:playwright` job with the token in job data. The Playwright worker, on CAPTCHA detection, enqueues a solve job and **returns the slot** instead of blocking up to 60s (`playwright.ts:269`). Commit.

### Task 3.3: Kubernetes + KEDA autoscale
- [ ] Add `deploy/` manifests: Deployments for probe/http/playwright/dispatcher/captcha + a `ScaledObject` per fetch pool scaling on BullMQ `waiting` depth (probe/http: fast scale; playwright: pre-warmed, capped). Resource limits per pod. Document `kubectl apply -k deploy/`. (Infra task — no unit test; validate with a dry-run.) Commit.

---

## Phase 4 — Pipeline decoupling & storage

### Task 4.1: Bulk snapshot insert
- [ ] `/internal/price-snapshot:batch` uses a single multi-row `INSERT ... ON CONFLICT(job_uuid) DO NOTHING` (or `COPY`) instead of per-row inserts. Benchmark 500-row batch. Commit.

### Task 4.2: Snapshot partitioning + cold tiering
- [ ] Partition `price_snapshots` by day (or TimescaleDB hypertable); a retention job (extend existing `services/retention.py`) tiers >Nd partitions to S3/Parquet. Migration + test that a write lands in the right partition. Commit.

---

## Phase 5 — Observability & deploy

### Task 5.1: Metrics + tracing + Bull Board
- [ ] Instrument workers + dispatcher with Prometheus counters/histograms (jobs by status, per-tier latency, per-domain ban rate, queue depth, cycle completion lag) and OpenTelemetry spans across scrape→ingest→signal. Mount **Bull Board** for the dead-letter/validation/ai-error queues (the `queue.ts:48` comment becomes real). Add `/metrics`. Commit.

### Task 5.2: Alerting + SLOs
- [ ] Grafana dashboards + Alertmanager rules: ingest success rate, p95 scrape latency per tier, dead-letter growth, **per-domain ban-rate spike**, cycle-completion lag breaching `interval+grace`. Commit.

---

## Phase 6 — Compliance

### Task 6.1: Single crawl identity + crawl-delay
- [ ] Resolve the identity contradiction: choose `Specterbot` UA on requests to match the robots evaluation in `robots.ts`, OR explicitly document browser-emulation as policy. **Honor `Crawl-delay`** from robots.txt (already parsed) by feeding it into the Task 1.4 limiter as a per-domain minimum spacing. Add a test that a robots `Crawl-delay: 10` yields ≥10s spacing. Commit.

### Task 6.2: Audit log + exclusion list
- [ ] Append-only audit row per fetch (`domain, ts, robots_decision, proxy_tier, status`); a `domain_exclusions` table the probe checks first (honor opt-outs/takedowns immediately). Test the exclusion short-circuits dispatch. Commit.

---

## Self-Review notes
- **Anti-ban is defense-in-depth, not one switch:** even spreading (1.1–1.3) lowers *burst rate*; atomic per-domain rate+concurrency (1.4) caps *simultaneous* pressure; proxy rotation+health (1.6) survives the bans that still happen; crawl-delay (6.1) respects target policy. All four ship in Phases 1/6.
- **Cycle barrier correctness:** completion fires exactly-once via the `cycle:fired` flag; failed/blocked URLs advance the counter (0.2/1.5) so a banned competitor never stalls a merchant's signals; `close_expired` guarantees signals fire even if scrapes are permanently missing.
- **OOS stays immediate** (urgency) while RAISE/LOWER defers to cycle-complete — verify this split in `signals/dispatcher.py` tests.
- **Idempotency end-to-end:** `job_uuid` (0.3) + `ON CONFLICT DO NOTHING` (0.2/4.1) make snapshot retries safe; cycle counters only advance on first insert.
- **Type/name consistency:** `merchantCycleIds` (scraper job) ↔ `merchant_cycle_ids` (ingest body) ↔ `open_cycle/record_scrape` (coordinator) — keep these aligned across 0.2, 1.2, 1.5, 1.7.

## Execution sequencing
Phase 0 → Phase 1 are the must-ship core (close the loop + the user's anti-ban/cycle requirement) and are independently deployable. Phases 2–6 harden and scale and can land incrementally without taking the pipeline down.

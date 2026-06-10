# Per-Customer Cost Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure real cost-to-serve per customer (proxy bandwidth, AI tokens, CAPTCHA), splitting each shared crawl's cost across the N merchants sharing it, stored as daily rollups + a 1% raw sample, surfaced via an internal margin endpoint.

**Architecture:** Pure `cost_model` (rates + math) → `cost_ledger` (Redis counter accrual + 1% sampling + daily flush) → rollup/sample tables → `cost_margin` read service → `ADMIN_API_KEY`-guarded `/admin/cost/margin`. Ingest (`internal.py`), the AI engine, and the scraper workers are instrumented to feed it. Hot-path accrual is best-effort and never fails an ingest.

**Tech Stack:** FastAPI, async SQLAlchemy, sync redis-py (`get_redis`), Alembic, pytest; scraper TypeScript/vitest.

**Conventions:** backend tests `.venv/Scripts/python.exe -m pytest <path>`; scraper from `scraper/` `node node_modules/vitest/vitest.mjs run` + `node node_modules/typescript/bin/tsc --noEmit`. Branch `freemium-backend-foundation`. **Stage by explicit path only** (never `git add .`). Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Cost-type vocabulary:** `cost_type ∈ {proxy, ai, captcha}`. Redis keys: `cost:daily:{merchant_id}:{YYYY-MM-DD}:{cost_type}` (USD, INCRBYFLOAT) and `…:{cost_type}:units`.

---

### Task 1: Pure cost model — `services/cost_model.py`

**Files:**
- Create: `services/cost_model.py`
- Test: `services/test_cost_model.py`

- [ ] **Step 1: Write the failing test**

```python
# services/test_cost_model.py
import os
import services.cost_model as cm


def test_scrape_cost_residential_bytes_to_usd():
    # 1 GB residential @ $8.40/GB
    costs = cm.scrape_cost_usd("residential", 1_000_000_000, captcha_solved=False)
    assert round(costs["proxy"], 4) == 8.40
    assert costs["captcha"] == 0.0


def test_scrape_cost_datacenter_cheaper_than_residential():
    dc = cm.scrape_cost_usd("datacenter", 1_000_000_000, False)["proxy"]
    res = cm.scrape_cost_usd("residential", 1_000_000_000, False)["proxy"]
    assert 0 < dc < res


def test_no_proxy_tier_is_zero_proxy_cost():
    assert cm.scrape_cost_usd(None, 1_000_000, False)["proxy"] == 0.0
    assert cm.scrape_cost_usd("none", 1_000_000, False)["proxy"] == 0.0


def test_captcha_adds_solve_cost_when_solved():
    c = cm.scrape_cost_usd("datacenter", 0, captcha_solved=True)
    assert c["captcha"] == 0.002


def test_ai_cost_pro_vs_flash():
    pro   = cm.ai_cost_usd("gemini-1.5-pro", 1_000_000, 1_000_000)
    flash = cm.ai_cost_usd("gemini-1.5-flash", 1_000_000, 1_000_000)
    assert round(pro, 4) == round(1.25 + 5.00, 4)      # $/1M in + out
    assert round(flash, 4) == round(0.075 + 0.30, 4)
    assert flash < pro


def test_split_divides_across_merchants_guarding_zero():
    assert cm.split(10.0, 5) == 2.0
    assert cm.split(10.0, 0) == 10.0   # guard: never divide by zero


def test_monthly_revenue_map():
    assert cm.monthly_revenue_usd("recon") == 79.0
    assert cm.monthly_revenue_usd("free") == 0.0
    assert cm.monthly_revenue_usd("eclipse") == 0.0   # custom → 0 (flagged elsewhere)


def test_rates_are_env_overridable(monkeypatch):
    monkeypatch.setenv("COST_RATE_RESIDENTIAL_USD_PER_GB", "10.0")
    assert cm.scrape_cost_usd("residential", 1_000_000_000, False)["proxy"] == 10.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest services/test_cost_model.py -q`
Expected: FAIL — `ModuleNotFoundError: services.cost_model`.

- [ ] **Step 3: Write minimal implementation**

```python
# services/cost_model.py
"""Pure cost-rate model (Audit #4). Unit rates default to the COST_ANALYSIS.md
appendix and are env-overridable so margins recompute when vendor prices move.
No I/O — every function is a deterministic calculation."""
from __future__ import annotations

import os

_GB = 1_000_000_000  # bytes per "GB" for the bandwidth model (decimal GB, matches vendor billing)


def _env_float(key: str, default: float) -> float:
    v = os.environ.get(key)
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _proxy_rate_per_gb(tier: str | None) -> float:
    t = (tier or "none").lower()
    if t == "residential":
        return _env_float("COST_RATE_RESIDENTIAL_USD_PER_GB", 8.40)
    if t == "datacenter":
        return _env_float("COST_RATE_DATACENTER_USD_PER_GB", 0.30)
    return 0.0   # 'none'/None/direct → no proxy bandwidth cost


def _captcha_rate() -> float:
    return _env_float("COST_RATE_CAPTCHA_USD_PER_SOLVE", 0.002)


def _ai_rates(model: str) -> tuple[float, float]:
    """(input_$/1M, output_$/1M) for the model family."""
    if "flash" in (model or "").lower():
        return (_env_float("COST_RATE_AI_FLASH_IN_PER_1M", 0.075),
                _env_float("COST_RATE_AI_FLASH_OUT_PER_1M", 0.30))
    return (_env_float("COST_RATE_AI_PRO_IN_PER_1M", 1.25),
            _env_float("COST_RATE_AI_PRO_OUT_PER_1M", 5.00))


# Plan → modeled monthly revenue (PRICING.md). ECLIPSE is bespoke → 0 (flagged custom).
_PLAN_REVENUE = {"free": 0.0, "recon": 79.0, "cipher": 249.0, "phantom": 699.0,
                 "predator": 1799.0, "eclipse": 0.0}


def scrape_cost_usd(proxy_tier: str | None, resp_bytes: int, captcha_solved: bool) -> dict:
    """Marginal cost of ONE fetch, before the cross-merchant split."""
    proxy = max(0, int(resp_bytes or 0)) / _GB * _proxy_rate_per_gb(proxy_tier)
    captcha = _captcha_rate() if captcha_solved else 0.0
    return {"proxy": proxy, "captcha": captcha}


def ai_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = _ai_rates(model)
    return (max(0, int(input_tokens or 0)) / 1_000_000) * in_rate \
         + (max(0, int(output_tokens or 0)) / 1_000_000) * out_rate


def split(cost: float, n_merchants: int) -> float:
    """Divide a shared crawl's cost across the merchants sharing it (guard /0)."""
    return cost / max(int(n_merchants), 1)


def monthly_revenue_usd(plan: str) -> float:
    return _PLAN_REVENUE.get((plan or "").lower(), 0.0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest services/test_cost_model.py -q`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add services/cost_model.py services/test_cost_model.py
git commit -m "feat(cost): pure cost-rate model (proxy/ai/captcha + revenue, env-overridable)"
```

---

### Task 2: Models + migration — rollup + sample tables

**Files:**
- Create: `models/merchant_cost_daily.py`
- Create: `models/cost_event_sample.py`
- Create: `alembic/versions/0011_cost_ledger.py` (head is 0010_audit_exclusions)
- Create: `supabase/migrations/0011_cost_ledger.sql` (0010 SQL name already taken by billing)
- Test: `models/test_cost_models_import.py`

- [ ] **Step 1: Write the failing test**

```python
# models/test_cost_models_import.py
from models.merchant_cost_daily import MerchantCostDaily
from models.cost_event_sample import CostEventSample


def test_merchant_cost_daily_columns():
    cols = set(MerchantCostDaily.__table__.columns.keys())
    assert {"merchant_id", "date", "cost_type", "cost_usd", "units", "sample_count"} <= cols


def test_cost_event_sample_columns():
    cols = set(CostEventSample.__table__.columns.keys())
    assert {"merchant_id", "cost_type", "proxy_tier", "units", "cost_usd", "domain"} <= cols
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest models/test_cost_models_import.py -q`
Expected: FAIL — `ModuleNotFoundError: models.merchant_cost_daily`.

- [ ] **Step 3: Write the models**

```python
# models/merchant_cost_daily.py
from __future__ import annotations
import uuid
from datetime import date as date_t, datetime
from sqlalchemy import Date, DateTime, Numeric, String, Integer, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class MerchantCostDaily(Base):
    """Daily per-merchant cost rollup (source of truth for margins). One row per
    (merchant_id, date, cost_type). Flushed from Redis counters by flush_daily."""
    __tablename__ = "merchant_cost_daily"

    merchant_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    date: Mapped[date_t] = mapped_column(Date, nullable=False)
    cost_type: Mapped[str] = mapped_column(String, nullable=False)   # proxy | ai | captcha
    cost_usd: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False, server_default=text("0"))
    units: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, server_default=text("0"))
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False)

    __table_args__ = (
        UniqueConstraint("merchant_id", "date", "cost_type", name="uq_merchant_cost_daily"),
    )
```

```python
# models/cost_event_sample.py
from __future__ import annotations
import uuid
from typing import Optional
from sqlalchemy import Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class CostEventSample(Base):
    """1% sampled raw cost events — calibrates the byte/cost estimates against the
    daily rollups and spot-checks attribution. id + created_at from Base."""
    __tablename__ = "cost_event_sample"

    merchant_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    cost_type: Mapped[str] = mapped_column(String, nullable=False)
    proxy_tier: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    units: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    cost_usd: Mapped[float] = mapped_column(Numeric(14, 8), nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
```

- [ ] **Step 4: Write the Alembic migration**

```python
# alembic/versions/0011_cost_ledger.py
"""cost ledger: merchant_cost_daily rollup + cost_event_sample

Revision ID: 0011
Revises: 0010
"""
from __future__ import annotations
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchant_cost_daily",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("merchant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("cost_type", sa.String(), nullable=False),
        sa.Column("cost_usd", sa.Numeric(14, 6), server_default=sa.text("0"), nullable=False),
        sa.Column("units", sa.Numeric(18, 4), server_default=sa.text("0"), nullable=False),
        sa.Column("sample_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("merchant_id", "date", "cost_type", name="uq_merchant_cost_daily"),
    )
    op.create_index("ix_merchant_cost_daily_date", "merchant_cost_daily", ["date"])
    op.create_table(
        "cost_event_sample",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("merchant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cost_type", sa.String(), nullable=False),
        sa.Column("proxy_tier", sa.String(), nullable=True),
        sa.Column("units", sa.Numeric(18, 4), nullable=False),
        sa.Column("cost_usd", sa.Numeric(14, 8), nullable=False),
        sa.Column("domain", sa.String(), nullable=True),
    )
    op.create_index("ix_cost_event_sample_created", "cost_event_sample", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_cost_event_sample_created", table_name="cost_event_sample")
    op.drop_table("cost_event_sample")
    op.drop_index("ix_merchant_cost_daily_date", table_name="merchant_cost_daily")
    op.drop_table("merchant_cost_daily")
```

- [ ] **Step 5: Write the Supabase SQL mirror**

```sql
-- supabase/migrations/0011_cost_ledger.sql
create table if not exists merchant_cost_daily (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  merchant_id uuid not null,
  date date not null,
  cost_type text not null,
  cost_usd numeric(14,6) not null default 0,
  units numeric(18,4) not null default 0,
  sample_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint uq_merchant_cost_daily unique (merchant_id, date, cost_type)
);
create index if not exists ix_merchant_cost_daily_date on merchant_cost_daily(date);

create table if not exists cost_event_sample (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  merchant_id uuid not null,
  cost_type text not null,
  proxy_tier text,
  units numeric(18,4) not null,
  cost_usd numeric(14,8) not null,
  domain text
);
create index if not exists ix_cost_event_sample_created on cost_event_sample(created_at);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest models/test_cost_models_import.py -q`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add models/merchant_cost_daily.py models/cost_event_sample.py models/test_cost_models_import.py alembic/versions/0011_cost_ledger.py supabase/migrations/0011_cost_ledger.sql
git commit -m "feat(cost): merchant_cost_daily rollup + cost_event_sample tables (migration 0011)"
```

---

### Task 3: Ledger service — accrual + flush

**Files:**
- Create: `services/cost_ledger.py`
- Test: `services/test_cost_ledger.py`

- [ ] **Step 1: Write the failing test**

```python
# services/test_cost_ledger.py
import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import services.cost_ledger as cl

NOW = datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc)
M1 = uuid.uuid4()
M2 = uuid.uuid4()


class FakeRedis:
    """Minimal sync redis: incrbyfloat/expire/get/scan_iter over a dict."""
    def __init__(self): self.kv = {}
    def incrbyfloat(self, k, amt): self.kv[k] = float(self.kv.get(k, 0)) + float(amt); return self.kv[k]
    def expire(self, k, ttl): return True
    def get(self, k):
        v = self.kv.get(k)
        return None if v is None else str(v)
    def scan_iter(self, match=None, count=None):
        import fnmatch
        return [k for k in list(self.kv) if match is None or fnmatch.fnmatch(k, match)]


def test_record_scrape_cost_splits_across_distinct_merchants():
    redis = FakeRedis()
    session = MagicMock(add=MagicMock())
    # residential 1 GB shared by 2 merchants → each pays half of $8.40 = $4.20 proxy
    asyncio.run(cl.record_scrape_cost(
        session, redis, [M1, M2, M1], "residential", 1_000_000_000, False,
        domain="shop.com", now=NOW, rng=MagicMock(random=lambda: 0.99)))
    k1 = f"cost:daily:{M1}:2026-06-09:proxy"
    k2 = f"cost:daily:{M2}:2026-06-09:proxy"
    assert round(float(redis.get(k1)), 4) == 4.20
    assert round(float(redis.get(k2)), 4) == 4.20


def test_record_scrape_cost_skips_zero_captcha():
    redis = FakeRedis()
    session = MagicMock(add=MagicMock())
    asyncio.run(cl.record_scrape_cost(
        session, redis, [M1], "datacenter", 1_000, False,
        domain="d.com", now=NOW, rng=MagicMock(random=lambda: 0.99)))
    assert redis.get(f"cost:daily:{M1}:2026-06-09:captcha") is None  # no captcha key written


def test_record_scrape_cost_samples_when_rng_below_rate():
    redis = FakeRedis()
    session = MagicMock(add=MagicMock())
    asyncio.run(cl.record_scrape_cost(
        session, redis, [M1], "residential", 1_000_000_000, True,
        domain="d.com", now=NOW, rng=MagicMock(random=lambda: 0.0)))   # always sample
    assert session.add.called   # a CostEventSample row was added


def test_record_scrape_cost_swallows_errors():
    boom = MagicMock()
    boom.incrbyfloat.side_effect = RuntimeError("redis down")
    session = MagicMock(add=MagicMock())
    # must not raise
    asyncio.run(cl.record_scrape_cost(
        session, boom, [M1], "residential", 1_000_000_000, False, domain="d.com", now=NOW))


def test_record_ai_cost_accrues_to_one_merchant():
    redis = FakeRedis()
    session = MagicMock(add=MagicMock())
    asyncio.run(cl.record_ai_cost(
        session, redis, M1, "gemini-1.5-pro", 1_000_000, 1_000_000,
        now=NOW, rng=MagicMock(random=lambda: 0.99)))
    assert round(float(redis.get(f"cost:daily:{M1}:2026-06-09:ai")), 4) == round(1.25 + 5.00, 4)


def test_flush_daily_upserts_rollup_rows():
    redis = FakeRedis()
    redis.kv[f"cost:daily:{M1}:2026-06-09:proxy"] = 4.2
    redis.kv[f"cost:daily:{M1}:2026-06-09:proxy:units"] = 3
    session = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    written = asyncio.run(cl.flush_daily(session, redis, "2026-06-09"))
    assert written == 1
    session.execute.assert_awaited()      # an upsert statement was executed
    session.commit.assert_awaited_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest services/test_cost_ledger.py -q`
Expected: FAIL — `ModuleNotFoundError: services.cost_ledger`.

- [ ] **Step 3: Write the implementation**

```python
# services/cost_ledger.py
"""Per-customer cost accrual (Audit #4). Hot-path writes are best-effort Redis
counters; a daily flush rolls them into merchant_cost_daily. A shared crawl's
cost is split across the distinct merchants sharing it. Never raises into ingest."""
from __future__ import annotations

import logging
import random as _random
import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.cost_event_sample import CostEventSample
from models.merchant_cost_daily import MerchantCostDaily
from services import cost_model

logger = logging.getLogger("cost_ledger")

SAMPLE_RATE = 0.01
COUNTER_TTL_S = 40 * 24 * 3600   # outlive the flush window


def _day(now: datetime) -> str:
    return now.strftime("%Y-%m-%d")


def _key(m: str, day: str, ctype: str) -> str:
    return f"cost:daily:{m}:{day}:{ctype}"


def _accrue(redis, session, m: str, day: str, ctype: str, cost: float,
            units: float, proxy_tier, domain, rng) -> None:
    k = _key(m, day, ctype)
    redis.incrbyfloat(k, cost)
    redis.expire(k, COUNTER_TTL_S)
    redis.incrbyfloat(f"{k}:units", units)
    redis.expire(f"{k}:units", COUNTER_TTL_S)
    if rng.random() < SAMPLE_RATE:
        session.add(CostEventSample(
            merchant_id=uuid.UUID(m), cost_type=ctype, proxy_tier=proxy_tier,
            units=units, cost_usd=cost, domain=domain))


async def record_scrape_cost(session: AsyncSession, redis, merchant_ids, proxy_tier,
                             resp_bytes, captcha_solved, *, domain=None,
                             now=None, rng=_random) -> None:
    try:
        now = now or datetime.now(timezone.utc)
        distinct = list(dict.fromkeys(str(m) for m in merchant_ids))
        if not distinct:
            return
        costs = cost_model.scrape_cost_usd(proxy_tier, resp_bytes, captcha_solved)
        day = _day(now)
        n = len(distinct)
        for m in distinct:
            for ctype in ("proxy", "captcha"):
                c = cost_model.split(costs[ctype], n)
                if c <= 0:
                    continue
                _accrue(redis, session, m, day, ctype, c, 1.0, proxy_tier, domain, rng)
    except Exception:
        logger.exception("record_scrape_cost failed (best-effort, ignored)")


async def record_ai_cost(session: AsyncSession, redis, merchant_id, model,
                         input_tokens, output_tokens, *, now=None, rng=_random) -> None:
    try:
        now = now or datetime.now(timezone.utc)
        cost = cost_model.ai_cost_usd(model, input_tokens, output_tokens)
        if cost <= 0:
            return
        _accrue(redis, session, str(merchant_id), _day(now), "ai", cost,
                float(int(input_tokens or 0) + int(output_tokens or 0)), None, None, rng)
    except Exception:
        logger.exception("record_ai_cost failed (best-effort, ignored)")


async def _upsert_daily(session: AsyncSession, m: str, day: str, ctype: str,
                        cost: float, units: float) -> None:
    stmt = pg_insert(MerchantCostDaily).values(
        merchant_id=uuid.UUID(m), date=day, cost_type=ctype,
        cost_usd=cost, units=units, sample_count=0,
    ).on_conflict_do_update(
        constraint="uq_merchant_cost_daily",
        set_={"cost_usd": cost, "units": units, "updated_at": datetime.now(timezone.utc)},
    )
    await session.execute(stmt)


async def flush_daily(session: AsyncSession, redis, day: str) -> int:
    """Roll the day's Redis counters into merchant_cost_daily (idempotent upsert)."""
    written = 0
    for raw in redis.scan_iter(match=f"cost:daily:*:{day}:*", count=500):
        k = raw.decode() if isinstance(raw, (bytes, bytearray)) else raw
        parts = k.split(":")
        if parts[-1] == "units":      # skip the parallel units counter
            continue
        # cost:daily:{m}:{day}:{ctype}
        m, _day_, ctype = parts[2], parts[3], parts[4]
        cost = float(redis.get(k) or 0)
        units = float(redis.get(f"{k}:units") or 0)
        await _upsert_daily(session, m, _day_, ctype, cost, units)
        written += 1
    await session.commit()
    return written
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest services/test_cost_ledger.py -q`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add services/cost_ledger.py services/test_cost_ledger.py
git commit -m "feat(cost): cost ledger — split accrual to redis counters, 1% sampling, daily flush"
```

---

### Task 4: Margin read service — `services/cost_margin.py`

**Files:**
- Create: `services/cost_margin.py`
- Test: `services/test_cost_margin.py`

- [ ] **Step 1: Write the failing test**

```python
# services/test_cost_margin.py
from services.cost_margin import compute_margin


def test_compute_margin_profitable():
    row = compute_margin("recon", {"proxy": 5.0, "ai": 0.0, "captcha": 1.0})
    assert row["revenue"] == 79.0
    assert row["cost_to_serve"] == 6.0
    assert round(row["gross_margin"], 4) == round((79.0 - 6.0) / 79.0, 4)
    assert row["margin_negative"] is False


def test_compute_margin_negative_flag():
    row = compute_margin("cipher", {"proxy": 300.0, "ai": 50.0, "captcha": 0.0})
    assert row["cost_to_serve"] == 350.0
    assert row["margin_negative"] is True


def test_compute_margin_zero_revenue_custom_plan():
    row = compute_margin("eclipse", {"proxy": 10.0})
    assert row["revenue"] == 0.0
    assert row["gross_margin"] is None         # undefined when revenue is 0
    assert row["margin_negative"] is True      # any cost with 0 modeled revenue
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest services/test_cost_margin.py -q`
Expected: FAIL — `ModuleNotFoundError: services.cost_margin`.

- [ ] **Step 3: Write the implementation**

```python
# services/cost_margin.py
"""Per-customer margin from the cost rollup (Audit #4). compute_margin is pure;
merchant_margins aggregates merchant_cost_daily over a window and joins the plan."""
from __future__ import annotations

import uuid
from datetime import date as date_t

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.merchant_cost_daily import MerchantCostDaily
from models.merchants import Merchant
from services import cost_model


def compute_margin(plan: str, costs: dict) -> dict:
    """Pure: given a plan and summed costs by type, return the margin record."""
    cost_to_serve = round(sum(float(v) for v in costs.values()), 6)
    revenue = cost_model.monthly_revenue_usd(plan)
    if revenue > 0:
        gross_margin = (revenue - cost_to_serve) / revenue
        margin_negative = cost_to_serve > revenue
    else:
        gross_margin = None                       # undefined with no modeled revenue
        margin_negative = cost_to_serve > 0       # any spend on a $0 plan is a loss
    return {
        "plan": plan,
        "revenue": revenue,
        "cost_to_serve": cost_to_serve,
        "by_type": {k: float(v) for k, v in costs.items()},
        "gross_margin": gross_margin,
        "margin_negative": margin_negative,
    }


async def merchant_margins(session: AsyncSession, date_from: date_t, date_to: date_t) -> list[dict]:
    """Aggregate cost by (merchant, cost_type) over [date_from, date_to], join the
    merchant's plan, and compute each margin record. Sorted worst-margin first."""
    stmt = (
        select(MerchantCostDaily.merchant_id, MerchantCostDaily.cost_type,
               func.sum(MerchantCostDaily.cost_usd))
        .where(MerchantCostDaily.date >= date_from, MerchantCostDaily.date <= date_to)
        .group_by(MerchantCostDaily.merchant_id, MerchantCostDaily.cost_type)
    )
    rows = (await session.execute(stmt)).all()

    by_merchant: dict[uuid.UUID, dict] = {}
    for merchant_id, cost_type, total in rows:
        by_merchant.setdefault(merchant_id, {})[cost_type] = float(total or 0)

    if not by_merchant:
        return []

    plans = dict((await session.execute(
        select(Merchant.id, Merchant.plan).where(Merchant.id.in_(list(by_merchant.keys())))
    )).all())

    out = []
    for merchant_id, costs in by_merchant.items():
        rec = compute_margin(plans.get(merchant_id, ""), costs)
        rec["merchant_id"] = str(merchant_id)
        out.append(rec)
    # Worst first: margin-negative on top, then ascending gross margin (None treated as -inf).
    out.sort(key=lambda r: (not r["margin_negative"],
                            r["gross_margin"] if r["gross_margin"] is not None else float("-inf")))
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest services/test_cost_margin.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/cost_margin.py services/test_cost_margin.py
git commit -m "feat(cost): per-customer margin service (cost rollup vs plan revenue)"
```

---

### Task 5: Admin auth + margin endpoint

**Files:**
- Create: `auth/admin_auth.py`
- Create: `routers/cost.py`
- Modify: `main.py` (register router)
- Test: `routers/test_cost.py`

- [ ] **Step 1: Write the failing test**

```python
# routers/test_cost.py
import os
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient

from main import app
from db import get_db
from routers.cost import _margins_dep   # the patchable seam


def _override_db():
    async def _gen():
        yield AsyncMock()
    return _gen


@pytest.fixture(autouse=True)
def _admin_key(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret-admin-key")
    yield
    app.dependency_overrides.clear()


def test_margin_requires_admin_key():
    with TestClient(app) as c:
        resp = c.get("/admin/cost/margin?from=2026-06-01&to=2026-06-09")
        assert resp.status_code == 401


def test_margin_rejects_wrong_key():
    with TestClient(app) as c:
        resp = c.get("/admin/cost/margin?from=2026-06-01&to=2026-06-09",
                     headers={"X-Admin-Key": "wrong"})
        assert resp.status_code == 401


def test_margin_returns_rows_with_valid_key():
    app.dependency_overrides[get_db] = _override_db()
    app.dependency_overrides[_margins_dep] = lambda: AsyncMock(
        return_value=[{"merchant_id": "m1", "plan": "recon", "revenue": 79.0,
                       "cost_to_serve": 6.0, "by_type": {"proxy": 6.0},
                       "gross_margin": 0.924, "margin_negative": False}])
    with TestClient(app) as c:
        resp = c.get("/admin/cost/margin?from=2026-06-01&to=2026-06-09",
                     headers={"X-Admin-Key": "secret-admin-key"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["merchants"][0]["plan"] == "recon"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest routers/test_cost.py -q`
Expected: FAIL — `ModuleNotFoundError: routers.cost`.

- [ ] **Step 3: Write admin auth**

```python
# auth/admin_auth.py
"""Shared-secret guard for internal ops endpoints (Audit #4 margin view).
Separate from the scraper HMAC ingest auth. Set ADMIN_API_KEY; clients send it
in the X-Admin-Key header. Constant-time compare; 500 if the key is unset."""
from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException


async def require_admin(x_admin_key: str = Header("")) -> None:
    expected = os.environ.get("ADMIN_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=500, detail={"error": "admin_key_not_configured"})
    if not x_admin_key or not hmac.compare_digest(x_admin_key, expected):
        raise HTTPException(status_code=401, detail={"error": "invalid_admin_key"})
```

- [ ] **Step 4: Write the router**

```python
# routers/cost.py
"""Internal ops: per-customer cost-to-serve vs plan revenue (Audit #4).
Guarded by ADMIN_API_KEY (auth.admin_auth) — not customer-facing."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from auth.admin_auth import require_admin
from db import get_db
from services.cost_margin import merchant_margins

router = APIRouter(prefix="/admin/cost", tags=["admin-cost"],
                   dependencies=[Depends(require_admin)])


def _margins_dep():
    """Patchable seam so tests can stub the aggregation without a DB."""
    return merchant_margins


@router.get("/margin")
async def margin(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    session: AsyncSession = Depends(get_db),
    margins=Depends(_margins_dep),
) -> dict:
    rows = await margins(session, date_from, date_to)
    totals = {
        "cost_to_serve": round(sum(r["cost_to_serve"] for r in rows), 4),
        "revenue": round(sum(r["revenue"] for r in rows), 4),
        "margin_negative_count": sum(1 for r in rows if r["margin_negative"]),
    }
    return {"from": str(date_from), "to": str(date_to),
            "count": len(rows), "totals": totals, "merchants": rows}
```

- [ ] **Step 5: Register the router in `main.py`**

After `app.include_router(internal.router)` add:

```python
from routers import cost          # add to the existing routers import block
app.include_router(cost.router)
```

(Match the existing import style in `main.py` — the file imports each router module then calls `include_router`.)

- [ ] **Step 6: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest routers/test_cost.py -q`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add auth/admin_auth.py routers/cost.py routers/test_cost.py main.py
git commit -m "feat(cost): ADMIN_API_KEY-guarded /admin/cost/margin endpoint"
```

---

### Task 6: Instrument ingest — `routers/internal.py`

**Files:**
- Modify: `routers/internal.py` (SnapshotIn/ScrapeFailedIn fields; `_ingest` + `scrape_failed` call `record_scrape_cost`)
- Test: `routers/test_internal_cost.py`

- [ ] **Step 1: Write the failing test**

```python
# routers/test_internal_cost.py
import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import routers.internal as internal
from routers.internal import SnapshotIn, ScrapeFailedIn, MerchantCycle


def test_snapshot_carries_cost_fields():
    s = SnapshotIn(domain="d.com", url_path="/p", price=10, in_stock=True,
                   resp_bytes=12345, captcha_solved=True)
    assert s.resp_bytes == 12345 and s.captcha_solved is True


def test_scrape_failed_records_cost_with_split_merchants():
    m1, m2 = uuid.uuid4(), uuid.uuid4()
    body = ScrapeFailedIn(domain="d.com", url_path="/p", proxy_tier="residential",
                          resp_bytes=1000, merchant_cycle_ids=[
                              MerchantCycle(merchant_id=m1, cycle_id=1),
                              MerchantCycle(merchant_id=m2, cycle_id=1)])
    session = MagicMock(); session.commit = AsyncMock(); session.add = MagicMock()
    redis = MagicMock()
    with patch.object(internal, "record_scrape_cost", new=AsyncMock()) as rec, \
         patch.object(internal, "_write_audit", new=AsyncMock()), \
         patch.object(internal, "_record_cycles"), \
         patch.object(internal, "_fire_cycle_signals", new=AsyncMock(return_value=0)):
        asyncio.run(internal.scrape_failed(body, session, redis))
    rec.assert_awaited_once()
    # called with the two split merchant ids + residential tier
    args, kwargs = rec.await_args
    assert args[2] == [m1, m2]            # merchant_ids
    assert args[3] == "residential"       # proxy_tier
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest routers/test_internal_cost.py -q`
Expected: FAIL — `SnapshotIn` has no `resp_bytes` (validation error / attribute error).

- [ ] **Step 3: Add the fields + import**

In `routers/internal.py`, add the import near the other service imports:

```python
from services.cost_ledger import record_scrape_cost
```

Add to `SnapshotIn` (after `proxy_tier`):

```python
    resp_bytes: Optional[int] = None
    captcha_solved: bool = False
```

Add to `ScrapeFailedIn` (after `proxy_tier`):

```python
    resp_bytes: Optional[int] = None
    captcha_solved: bool = False
```

- [ ] **Step 4: Record cost in the snapshot path**

In `_ingest`, inside the `for item, cu_id, snap_id in new_snapshots:` loop, after `_write_audit(...)` add:

```python
        await record_scrape_cost(
            session, redis_client,
            [mc.merchant_id for mc in item.merchant_cycle_ids],
            item.proxy_tier, item.resp_bytes, item.captcha_solved, domain=item.domain)
```

- [ ] **Step 5: Record cost in the failed path**

In `scrape_failed`, after `_write_audit(...)` and before `_fire_cycle_signals`, add:

```python
    await record_scrape_cost(
        session, redis_client,
        [mc.merchant_id for mc in body.merchant_cycle_ids],
        body.proxy_tier, body.resp_bytes, body.captcha_solved, domain=body.domain)
```

- [ ] **Step 6: Run the test + the existing internal suite**

Run: `.venv/Scripts/python.exe -m pytest routers/test_internal_cost.py routers/test_internal.py -q`
Expected: PASS (new 3 + existing internal tests still green).

- [ ] **Step 7: Commit**

```bash
git add routers/internal.py routers/test_internal_cost.py
git commit -m "feat(cost): attribute scrape cost in ingest (snapshot + scrape-failed), split across merchants"
```

---

### Task 7: Instrument the AI engine — `signals/ai_engine.py`

**Files:**
- Modify: `signals/ai_engine.py` (`_call_gemini_batch` records token cost on success)
- Test: `signals/test_ai_cost.py`

- [ ] **Step 1: Write the failing test**

```python
# signals/test_ai_cost.py
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import signals.ai_engine as ai


def test_gemini_success_records_ai_cost(monkeypatch):
    # Fake Gemini response with usage metadata + parseable text.
    usage = SimpleNamespace(prompt_token_count=20000, candidates_token_count=4000)
    resp = SimpleNamespace(text="[]", usage_metadata=usage)

    monkeypatch.setattr(ai, "_get_model", lambda: SimpleNamespace(
        generate_content=lambda *a, **k: resp))
    monkeypatch.setattr(ai, "_validate_response", lambda text, sd: [])

    with patch.object(ai, "record_ai_cost", new=AsyncMock()) as rec:
        out = asyncio.run(ai._call_gemini_batch(MagicMock(), MagicMock(), "merchant-1", []))
    assert out == []
    rec.assert_awaited_once()
    args, kwargs = rec.await_args
    assert args[2] == "merchant-1"          # merchant id
    assert args[4] == 20000 and args[5] == 4000   # input/output tokens
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest signals/test_ai_cost.py -q`
Expected: FAIL — `record_ai_cost` not imported in `signals.ai_engine`.

- [ ] **Step 3: Import + record on success**

In `signals/ai_engine.py`, add the import near the top service imports:

```python
from services.cost_ledger import record_ai_cost
```

In `_call_gemini_batch`, replace the success line `return _validate_response(response.text, skus_and_data)` with:

```python
            usage = getattr(response, "usage_metadata", None)
            in_tok  = int(getattr(usage, "prompt_token_count", 0) or 0)
            out_tok = int(getattr(usage, "candidates_token_count", 0) or 0)
            # Best-effort cost accrual; never let accounting break signal generation.
            try:
                await record_ai_cost(session, redis_client, merchant_id, MODEL_NAME, in_tok, out_tok)
            except Exception:
                pass
            return _validate_response(response.text, skus_and_data)
```

- [ ] **Step 4: Run the test + existing AI engine suite**

Run: `.venv/Scripts/python.exe -m pytest signals/test_ai_cost.py signals/test_ai_engine.py -q`
Expected: PASS (new 1 + existing AI tests green).

- [ ] **Step 5: Commit**

```bash
git add signals/ai_engine.py signals/test_ai_cost.py
git commit -m "feat(cost): record per-merchant AI token cost after each Gemini batch"
```

---

### Task 8: Scraper — emit resp_bytes + captcha_solved

**Files:**
- Modify: `scraper/lib/ingest-client.ts` (`buildSnapshotBody` params + body; `postScrapeFailed` payload type)
- Modify: `scraper/workers/http.ts` (pass `resp_bytes` from response body length)
- Modify: `scraper/workers/playwright.ts` (pass `resp_bytes` from content length; `captcha_solved`)
- Modify: `scraper/__tests__/ingest-client.test.ts` (assert new fields present)

- [ ] **Step 1: Extend the test**

Add to `scraper/__tests__/ingest-client.test.ts` (inside the existing `buildSnapshotBody` describe; if none exists, add one):

```ts
import { buildSnapshotBody } from '../lib/ingest-client'

it('buildSnapshotBody carries resp_bytes and captcha_solved', () => {
  const body = buildSnapshotBody({
    url: 'https://x.com/p', domain: 'x.com', urlPath: '/p',
    competitorTrackingIds: ['t1'], price: 10, currency: 'USD', inStock: true,
    title: null, needsReview: false, jobId: 'j1',
    respBytes: 4242, captchaSolved: true,
  })
  expect(body.resp_bytes).toBe(4242)
  expect(body.captcha_solved).toBe(true)
})

it('buildSnapshotBody defaults the cost fields when omitted', () => {
  const body = buildSnapshotBody({
    url: 'https://x.com/p', domain: 'x.com', urlPath: '/p',
    competitorTrackingIds: ['t1'], price: 10, currency: 'USD', inStock: true,
    title: null, needsReview: false, jobId: 'j1',
  })
  expect(body.resp_bytes).toBe(null)
  expect(body.captcha_solved).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `scraper/`): `node node_modules/vitest/vitest.mjs run __tests__/ingest-client.test.ts`
Expected: FAIL — `resp_bytes`/`captcha_solved` undefined on the body.

- [ ] **Step 3: Extend `buildSnapshotBody`**

In `scraper/lib/ingest-client.ts`, add the two optional params and body fields:

```ts
export function buildSnapshotBody(params: {
  url: string; domain: string; urlPath: string; competitorTrackingIds: string[]
  price: number; currency: string; inStock: boolean; title: string | null
  needsReview: boolean; jobId: string; merchantCycleIds?: unknown[]
  respBytes?: number | null; captchaSolved?: boolean
}): Record<string, unknown> {
  return {
    url: params.url, domain: params.domain, url_path: params.urlPath,
    competitor_tracking_ids: params.competitorTrackingIds, price: params.price,
    currency: params.currency, in_stock: params.inStock, title: params.title,
    needs_review: params.needsReview, job_uuid: deterministicUuid(params.jobId),
    merchant_cycle_ids: params.merchantCycleIds ?? [],
    resp_bytes: params.respBytes ?? null,
    captcha_solved: params.captchaSolved ?? false,
  }
}
```

Also extend `postScrapeFailed`'s payload type to accept the two optional fields (add `resp_bytes?: number | null` and `captcha_solved?: boolean` to its param object type, and pass them through — they are part of the JSON body already since it forwards the whole object).

- [ ] **Step 4: Pass the fields from the workers**

`http.ts` — in the snapshot build (step 5 region) add `respBytes: html.length` and `captchaSolved: false`; in the dead-letter `postScrapeFailed` add `resp_bytes: 0` and `proxy_tier` if available (leave `proxy_tier` as-is if not tracked).

```ts
    const body = buildSnapshotBody({
      url, domain, urlPath, competitorTrackingIds,
      price: parsed.price, currency: normCurrency, inStock: parsed.inStock,
      title: parsed.title, needsReview: validation.needsReview, jobId: String(job.id),
      merchantCycleIds: (job.data as { merchantCycleIds?: unknown[] }).merchantCycleIds,
      respBytes: html.length, captchaSolved: false,
    })
```

`playwright.ts` — capture the page content length before parse and pass it; set `captchaSolved` from whether a CAPTCHA was cleared this job. After `const parsed = await parser.parse(page)` the body build (step 6 region) becomes:

```ts
      const pageHtml = await page.content().catch(() => '')
      const body = buildSnapshotBody({
        url, domain, urlPath, competitorTrackingIds,
        price: parsed.price, currency: normCurrency, inStock: parsed.inStock,
        title: parsed.title, needsReview: validation.needsReview, jobId: String(job.id),
        merchantCycleIds: (job.data as { merchantCycleIds?: unknown[] }).merchantCycleIds,
        respBytes: pageHtml.length,
        captchaSolved: captcha.kind === 'clear' ? false : false,  // a solved-inline token cleared earlier; conservative false
      })
```

> Note: `captchaSolved` stays `false` on the success path for v1 (a CAPTCHA that was solved caused a delayed retry, so the *successful* run didn't itself solve one). CAPTCHA cost is instead attributed when the solver runs; that wiring is part of the captcha-solver worker and is out of this task's scope — the field exists so it can be set true there later. Keep the literal `false`.

- [ ] **Step 5: Typecheck + full scraper suite**

Run (from `scraper/`): `node node_modules/typescript/bin/tsc --noEmit`
Expected: clean.
Run: `node node_modules/vitest/vitest.mjs run`
Expected: all pass (existing + the 2 new ingest-client assertions).

- [ ] **Step 6: Commit**

```bash
git add scraper/lib/ingest-client.ts scraper/workers/http.ts scraper/workers/playwright.ts scraper/__tests__/ingest-client.test.ts
git commit -m "feat(scraper): emit resp_bytes + captcha_solved on snapshot/failed payloads for cost attribution"
```

---

### Task 9: Flush script + env docs + verification sweep

**Files:**
- Create: `run_cost_flush.py`
- Modify: `.env.example`

- [ ] **Step 1: Write the flush script**

```python
# run_cost_flush.py
"""Standalone daily cost-flush: roll yesterday's (and today's) Redis cost
counters into merchant_cost_daily. Run from cron once a day after midnight UTC:
    python run_cost_flush.py
Scheduler/cron wiring is deferred to the infra wave; the flush logic is tested."""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

import asyncio
from datetime import datetime, timedelta, timezone

from db import AsyncSessionLocal
from redis_client import redis as redis_client
from services.cost_ledger import flush_daily


async def _run() -> None:
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    async with AsyncSessionLocal() as session:
        for day in (yesterday, today):
            n = await flush_daily(session, redis_client, day.strftime("%Y-%m-%d"))
            print(f"[cost-flush] {day}: {n} rollup rows", flush=True)


if __name__ == "__main__":
    asyncio.run(_run())
```

- [ ] **Step 2: Document the env keys**

Append to `.env.example`:

```dotenv
# ── Cost ledger (Audit #4) ────────────────────────────────────────────────────
# Internal margin endpoint guard (X-Admin-Key header). REQUIRED for /admin/cost/*.
ADMIN_API_KEY=
# Optional cost-rate overrides (defaults from COST_ANALYSIS.md appendix):
# COST_RATE_RESIDENTIAL_USD_PER_GB=8.40
# COST_RATE_DATACENTER_USD_PER_GB=0.30
# COST_RATE_CAPTCHA_USD_PER_SOLVE=0.002
# COST_RATE_AI_PRO_IN_PER_1M=1.25
# COST_RATE_AI_PRO_OUT_PER_1M=5.00
# COST_RATE_AI_FLASH_IN_PER_1M=0.075
# COST_RATE_AI_FLASH_OUT_PER_1M=0.30
```

- [ ] **Step 3: Full backend + scraper verification sweep**

Run (from `specter-api/`): `.venv/Scripts/python.exe -m pytest -q`
Expected: all pass (310 prior + the new cost tests).
Run (from `scraper/`): `node node_modules/typescript/bin/tsc --noEmit` (clean) and `node node_modules/vitest/vitest.mjs run` (all pass).

- [ ] **Step 4: Commit**

```bash
git add run_cost_flush.py .env.example
git commit -m "feat(cost): daily flush script + document ADMIN_API_KEY and cost-rate env keys"
```

---

## Self-Review notes

- **Spec coverage:** cost_model→T1; tables/migration→T2; ledger accrual+split+sampling+flush→T3; margin service→T4; admin auth + endpoint→T5; ingest instrumentation (snapshot+failed, split across merchant_cycle_ids)→T6; AI token cost→T7; worker resp_bytes/captcha_solved→T8; flush script + env docs + deferred scheduler→T9. All spec sections covered.
- **Type consistency:** `cost_type` literals `proxy|ai|captcha` consistent across model, ledger keys, margin, tests. `record_scrape_cost(session, redis, merchant_ids, proxy_tier, resp_bytes, captcha_solved, *, domain, now, rng)` signature identical in cost_ledger.py, its tests, and both internal.py call sites. `record_ai_cost(session, redis, merchant_id, model, input_tokens, output_tokens, *, now, rng)` identical in cost_ledger.py, its test, and ai_engine.py. `buildSnapshotBody` param names `respBytes`/`captchaSolved` and body keys `resp_bytes`/`captcha_solved` consistent across ingest-client.ts, workers, and the scraper test. `merchant_margins(session, date_from, date_to)` matches router usage. Migration `revision="0011"`, `down_revision="0010"` matches the current head (0010_audit_exclusions); supabase mirror named `0011_cost_ledger.sql` (0010 SQL name already used by billing).
- **Best-effort guarantee:** every hot-path accrual (`record_scrape_cost`, `record_ai_cost`, and the ai_engine call site) is wrapped so cost accounting can never fail an ingest or a signal write.
- **Deferred (documented):** the flush *scheduler* (cron) and CAPTCHA-cost-at-solve attribution — fields/logic exist; wiring is later, consistent with #1/#2.

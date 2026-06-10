# Signals + Alerts Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side sort + confidence-threshold filtering, per-type counts, price-delta, confidence tiers, provenance, day-grouping, and alert sort/duration/urgency to the SPECTER Signals and Alerts dashboard pages.

**Architecture:** Backend-first across two repos. `specter-api` extends `GET /signals` with `sort`/`min_confidence` params, `current_price`, and per-type `counts`, plus a composite-index migration. `specter-web` adds four TDD'd pure modules and three URL parsers, two presentational components, and rewires the Signals and Alerts pages using sub-project B's `useQueryParams` URL-state convention.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (async) + Alembic + pytest (specter-api); Next.js 14 App Router + TypeScript strict + Vitest (specter-web).

**Spec:** `docs/superpowers/specs/2026-06-02-signals-alerts-enrichment-design.md`

---

## Repos & branches

- **specter-api** — `C:\Users\manoj\New Specter\specter-api` (its own git repo; **source mostly untracked** — stage by explicit path, **never** `git add .`/`-A`). Tasks 1–3. Create branch `signals-alerts-enrichment` before Task 1.
- **specter-web** — `C:\Users\manoj\New Specter\specter-web` (its own git repo, branch `main`). Tasks 4–13. Create branch `signals-alerts-enrichment` before Task 4.

All commits end with the trailer:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## File Structure

**specter-api**
- Create: `alembic/versions/0006_signal_indexes.py` — two `sku_id`-leading composite indexes on `signals`.
- Modify: `routers/signals.py` — schemas (`current_price`, `SignalTypeCounts`, `counts`), params (`sort`, `min_confidence`), query logic, pure `_signal_counts` helper.
- Create: `routers/test_signals.py` — pytest for the helper + route serialization + 422 validation.

**specter-web**
- Create: `lib/dashboard/confidence.ts` (+ `confidence.test.ts`) — confidence tier classifier.
- Create: `lib/dashboard/price-delta.ts` (+ `price-delta.test.ts`) — percentage delta + formatter.
- Create: `lib/dashboard/group-signals.ts` (+ `group-signals.test.ts`) — Today/Yesterday/Earlier bucketing.
- Create: `lib/dashboard/alert-helpers.ts` (+ `alert-helpers.test.ts`) — OOS duration, sort, urgency, counts.
- Modify: `lib/dashboard/url-params.ts` (+ `url-params.test.ts`) — three new parsers.
- Modify: `lib/api.ts` — `Signal.current_price`, `SignalTypeCounts`, `SignalList.counts`, `useSignals` opts.
- Modify: `lib/preview-data.ts` — add `current_price` + `counts` to preview fixtures.
- Create: `components/dashboard/confidence-meter.tsx`, `components/dashboard/signal-provenance.tsx`.
- Modify: `app/(dashboard)/signals/page.tsx`, `app/(dashboard)/alerts/page.tsx`.

---

# specter-api (Tasks 1–3)

> Before Task 1: `cd specter-api && git checkout -b signals-alerts-enrichment`

### Task 1: Migration `0006_signal_indexes`

**Files:**
- Create: `specter-api/alembic/versions/0006_signal_indexes.py`

The `signals` table has only the `id` PK. Every signals query joins `skus` on `sku_id`, filters/order by `created_at`, and (new) optionally orders by `confidence`. Add two `sku_id`-leading composites.

- [ ] **Step 1: Create the migration file**

`specter-api/alembic/versions/0006_signal_indexes.py`:
```python
"""signal indexes for sku-scoped sort/window queries

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-02

GET /signals always joins skus on sku_id and orders by created_at (default) or
confidence (sort=confidence). The signals table had only its id PK, so these
sku_id-leading composites back the join + window filter + both sort orders.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_signals_sku_id_created_at",
        "signals",
        ["sku_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_signals_sku_id_confidence",
        "signals",
        ["sku_id", sa.text("confidence DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_signals_sku_id_confidence", table_name="signals")
    op.drop_index("ix_signals_sku_id_created_at", table_name="signals")
```

- [ ] **Step 2: Verify the module imports and chains cleanly**

Run: `cd specter-api && python -c "import importlib.util,sys; s=importlib.util.spec_from_file_location('m','alembic/versions/0006_signal_indexes.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.revision, m.down_revision)"`
Expected: prints `0006 0005`

(If a live test Postgres is configured via `DATABASE_URL`, also run `alembic upgrade head` then `alembic downgrade -1` and confirm both succeed. If no DB is available, the import check above is the verification gate — matches how 0001–0005 are handled in this repo.)

- [ ] **Step 3: Commit**

```bash
cd specter-api
git add alembic/versions/0006_signal_indexes.py
git commit -m "feat(db): add sku_id-leading composite indexes on signals (0006)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Signal schemas + `_signal_counts` helper (TDD)

**Files:**
- Modify: `specter-api/routers/signals.py` (schemas + helper)
- Create: `specter-api/routers/test_signals.py`

The route groups counts via `GROUP BY Signal.type`, yielding rows like `[("RAISE", 4), ("LOWER", 2)]`. Extract the mapping to a pure helper so it is unit-testable, and add the new schema fields. `raise` is a Python keyword, so the field is `raise_` serialized as `"raise"`.

- [ ] **Step 1: Write the failing test**

`specter-api/routers/test_signals.py`:
```python
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import json

from routers.signals import SignalTypeCounts, _signal_counts


def test_signal_counts_maps_all_three_types():
    counts = _signal_counts([("RAISE", 4), ("LOWER", 2), ("HOLD", 7)])
    assert counts.raise_ == 4
    assert counts.lower == 2
    assert counts.hold == 7


def test_signal_counts_defaults_missing_types_to_zero():
    counts = _signal_counts([("RAISE", 3)])
    assert counts.raise_ == 3
    assert counts.lower == 0
    assert counts.hold == 0


def test_signal_counts_serializes_raise_key_as_raise():
    counts = _signal_counts([("RAISE", 1)])
    body = json.loads(counts.model_dump_json())
    assert body["raise"] == 1          # not "raise_"
    assert body["lower"] == 0
    assert body["hold"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-api && python -m pytest routers/test_signals.py -v`
Expected: FAIL — `ImportError: cannot import name 'SignalTypeCounts'` (or `_signal_counts`)

- [ ] **Step 3: Add the schema fields and helper**

In `specter-api/routers/signals.py`, update the import line and schemas. Change:
```python
from pydantic import BaseModel
```
to:
```python
from pydantic import BaseModel, ConfigDict, Field
```

Add `current_price` to `SignalOut` (after `price_suggestion`):
```python
class SignalOut(BaseModel):
    id: str
    sku_id: str
    sku_title: str
    type: str            # RAISE | LOWER | HOLD
    confidence: float
    reasoning: str | None
    price_suggestion: float | None
    current_price: float | None   # from the SKU join
    source: str          # ai | rule
    ai_fallback: bool
    created_at: str
```

Add the counts schema immediately before `SignalListOut` and the new `counts` field on it:
```python
class SignalTypeCounts(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    raise_: int = Field(0, serialization_alias="raise")
    lower: int = 0
    hold: int = 0


class SignalListOut(BaseModel):
    items: list[SignalOut]
    total: int
    limit: int
    offset: int
    counts: SignalTypeCounts
```

Add the pure helper after the schemas (before `router = APIRouter(...)`):
```python
def _signal_counts(rows: list[tuple[str, int]]) -> SignalTypeCounts:
    """Map GROUP BY Signal.type rows -> per-type counts (missing types -> 0)."""
    by_type = {str(t): int(n) for t, n in rows}
    return SignalTypeCounts(
        raise_=by_type.get("RAISE", 0),
        lower=by_type.get("LOWER", 0),
        hold=by_type.get("HOLD", 0),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-api && python -m pytest routers/test_signals.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
cd specter-api
git add routers/signals.py routers/test_signals.py
git commit -m "feat(signals): add current_price + counts schemas and counts helper" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `GET /signals` route — sort, min_confidence, current_price, counts

**Files:**
- Modify: `specter-api/routers/signals.py:75-123` (the `list_signals` handler)
- Modify: `specter-api/routers/test_signals.py` (add route tests)

- [ ] **Step 1: Write the failing tests**

Append to `specter-api/routers/test_signals.py`:
```python
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from auth.supabase import get_current_merchant
from db import get_db
from main import app
from models.merchants import Merchant


def _merchant(plan="recon"):
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = plan
    return m


def _sig(**kw):
    base = dict(
        id=uuid.uuid4(), sku_id=uuid.uuid4(), type="RAISE", confidence=0.82,
        reasoning="why", price_suggestion=99.0, source="ai", ai_fallback=False,
        created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
    )
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _wire(session, merchant):
    async def _ovr_merchant():
        return merchant

    async def _ovr_db():
        yield session

    app.dependency_overrides[get_current_merchant] = _ovr_merchant
    app.dependency_overrides[get_db] = _ovr_db


def test_list_signals_serializes_current_price_and_counts(client):
    m = _merchant()
    sig = _sig()
    # execute() is called 3x: total count, page rows, counts rows.
    total_res = MagicMock(scalar_one=MagicMock(return_value=1))
    page_res = MagicMock(all=MagicMock(return_value=[(sig, "My SKU", 120.0)]))
    counts_res = MagicMock(all=MagicMock(return_value=[("RAISE", 1)]))
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[total_res, page_res, counts_res])
    _wire(session, m)

    resp = client.get("/signals")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["current_price"] == 120.0
    assert item["sku_title"] == "My SKU"
    assert body["counts"]["raise"] == 1
    assert body["counts"]["lower"] == 0


def test_invalid_sort_returns_422(client):
    _wire(AsyncMock(), _merchant())
    resp = client.get("/signals?sort=banana")
    assert resp.status_code == 422


def test_min_confidence_out_of_range_returns_422(client):
    _wire(AsyncMock(), _merchant())
    resp = client.get("/signals?min_confidence=1.5")
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd specter-api && python -m pytest routers/test_signals.py -v`
Expected: FAIL — `test_invalid_sort_returns_422` returns 200 (param not yet validated); serialization test fails on missing `current_price`/`counts`.

- [ ] **Step 3: Update the handler**

Replace the `list_signals` function body in `specter-api/routers/signals.py`. First add the `Literal` import near the top:
```python
from typing import Literal
```
Then replace the handler (`@router.get("", ...)` through its `return`) with:
```python
@router.get("", response_model=SignalListOut)
async def list_signals(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: str | None = Query(None, description="Filter by RAISE | LOWER | HOLD"),
    sort: Literal["recent", "confidence"] = Query("recent"),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SignalListOut:
    window_start = datetime.now(tz=timezone.utc) - timedelta(
        days=_history_window_days(merchant.plan)
    )

    # Shared base: merchant-scoped + history window + confidence threshold.
    base = (
        select(Signal, SKU.title, SKU.current_price)
        .join(SKU, Signal.sku_id == SKU.id)
        .where(
            SKU.merchant_id == merchant.id,
            Signal.created_at >= window_start,
            Signal.confidence >= min_confidence,
        )
    )

    typed = base.where(Signal.type == type.upper()) if type else base

    # Total count (for pagination UI), respecting the active type filter.
    count_stmt = select(func.count()).select_from(typed.subquery())
    total = (await session.execute(count_stmt)).scalar_one()

    if sort == "confidence":
        order = (Signal.confidence.desc(), Signal.created_at.desc())
    else:
        order = (Signal.created_at.desc(),)
    page_stmt = typed.order_by(*order).limit(limit).offset(offset)
    rows = (await session.execute(page_stmt)).all()

    items = [
        SignalOut(
            id=str(sig.id),
            sku_id=str(sig.sku_id),
            sku_title=title,
            type=sig.type,
            confidence=float(sig.confidence),
            reasoning=sig.reasoning,
            price_suggestion=float(sig.price_suggestion) if sig.price_suggestion is not None else None,
            current_price=float(current_price) if current_price is not None else None,
            source=sig.source,
            ai_fallback=sig.ai_fallback,
            created_at=sig.created_at.isoformat(),
        )
        for sig, title, current_price in rows
    ]

    # Per-type counts over the same window + threshold, ignoring the type filter
    # so every tab can show its true total.
    counts_stmt = (
        select(Signal.type, func.count())
        .join(SKU, Signal.sku_id == SKU.id)
        .where(
            SKU.merchant_id == merchant.id,
            Signal.created_at >= window_start,
            Signal.confidence >= min_confidence,
        )
        .group_by(Signal.type)
    )
    counts = _signal_counts((await session.execute(counts_stmt)).all())

    return SignalListOut(
        items=items, total=total, limit=limit, offset=offset, counts=counts
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd specter-api && python -m pytest routers/test_signals.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
cd specter-api
git add routers/signals.py routers/test_signals.py
git commit -m "feat(signals): sort, min_confidence, current_price, per-type counts on GET /signals" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# specter-web (Tasks 4–13)

> Before Task 4: `cd specter-web && git checkout -b signals-alerts-enrichment`
> All web unit tests run with: `npm test -- --run` (Vitest). Type check: `npx tsc --noEmit`.

### Task 4: `confidence.ts` — confidence tier classifier (TDD)

**Files:**
- Create: `specter-web/lib/dashboard/confidence.ts`
- Create: `specter-web/lib/dashboard/confidence.test.ts`

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/confidence.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { confidenceTier } from './confidence'

describe('confidenceTier', () => {
  it('classifies high at and above 0.80', () => {
    expect(confidenceTier(0.8)).toBe('high')
    expect(confidenceTier(0.95)).toBe('high')
    expect(confidenceTier(1)).toBe('high')
  })

  it('classifies medium from 0.50 up to but not including 0.80', () => {
    expect(confidenceTier(0.5)).toBe('medium')
    expect(confidenceTier(0.79)).toBe('medium')
  })

  it('classifies low below 0.50', () => {
    expect(confidenceTier(0.49)).toBe('low')
    expect(confidenceTier(0)).toBe('low')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/confidence.test.ts`
Expected: FAIL — cannot find module `./confidence`

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/confidence.ts`:
```ts
// Confidence tier classifier for signal confidence (0–1).
// high >= 0.80, medium 0.50–0.79, low < 0.50.

export type ConfidenceTier = 'high' | 'medium' | 'low'

export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/confidence.test.ts`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/confidence.ts lib/dashboard/confidence.test.ts
git commit -m "feat(dashboard): add confidenceTier classifier" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `price-delta.ts` — percentage delta + formatter (TDD)

**Files:**
- Create: `specter-web/lib/dashboard/price-delta.ts`
- Create: `specter-web/lib/dashboard/price-delta.test.ts`

Note: the formatter uses the Unicode minus sign `−` (`−`) for negatives and a plain `+` for positives, matching the design's `+4.1%` / `−3.0%`.

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/price-delta.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { priceDeltaPct, formatPriceDelta } from './price-delta'

describe('priceDeltaPct', () => {
  it('computes a positive delta', () => {
    expect(priceDeltaPct(100, 104.1)).toBeCloseTo(4.1, 5)
  })

  it('computes a negative delta', () => {
    expect(priceDeltaPct(100, 97)).toBeCloseTo(-3, 5)
  })

  it('returns null when current or suggestion is null', () => {
    expect(priceDeltaPct(null, 100)).toBeNull()
    expect(priceDeltaPct(100, null)).toBeNull()
  })

  it('returns null when current is zero or negative', () => {
    expect(priceDeltaPct(0, 100)).toBeNull()
    expect(priceDeltaPct(-5, 100)).toBeNull()
  })
})

describe('formatPriceDelta', () => {
  it('formats a positive delta with a plus and one decimal', () => {
    expect(formatPriceDelta(100, 104.1)).toBe('+4.1%')
  })

  it('formats a negative delta with a unicode minus', () => {
    expect(formatPriceDelta(100, 97)).toBe('−3.0%')
  })

  it('returns null when not computable', () => {
    expect(formatPriceDelta(0, 100)).toBeNull()
    expect(formatPriceDelta(100, null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/price-delta.test.ts`
Expected: FAIL — cannot find module `./price-delta`

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/price-delta.ts`:
```ts
// Percentage delta between a signal's suggested price and the SKU's current price.

export function priceDeltaPct(
  current: number | null,
  suggestion: number | null,
): number | null {
  if (current === null || suggestion === null || current <= 0) return null
  return ((suggestion - current) / current) * 100
}

// "+4.1%" / "−3.0%" (unicode minus), or null when priceDeltaPct is null.
export function formatPriceDelta(
  current: number | null,
  suggestion: number | null,
): string | null {
  const pct = priceDeltaPct(current, suggestion)
  if (pct === null) return null
  const sign = pct < 0 ? '−' : '+'
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/price-delta.test.ts`
Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/price-delta.ts lib/dashboard/price-delta.test.ts
git commit -m "feat(dashboard): add priceDeltaPct + formatPriceDelta" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `group-signals.ts` — Today/Yesterday/Earlier bucketing (TDD)

**Files:**
- Create: `specter-web/lib/dashboard/group-signals.ts`
- Create: `specter-web/lib/dashboard/group-signals.test.ts`

Buckets by **local calendar day** of `created_at` relative to `now`. Preserves input order within each group; returns only non-empty groups, ordered Today → Yesterday → Earlier.

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/group-signals.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { groupSignalsByDay } from './group-signals'
import type { Signal } from '@/lib/api'

function sig(id: string, created_at: string): Signal {
  return {
    id,
    sku_id: 's',
    sku_title: 't',
    type: 'HOLD',
    confidence: 0.6,
    reasoning: null,
    price_suggestion: null,
    current_price: null,
    source: 'rule',
    ai_fallback: false,
    created_at,
  }
}

describe('groupSignalsByDay', () => {
  const now = new Date('2026-06-02T12:00:00')

  it('buckets into Today, Yesterday, Earlier and drops empty groups', () => {
    const groups = groupSignalsByDay(
      [
        sig('a', '2026-06-02T09:00:00'),
        sig('b', '2026-06-01T23:00:00'),
        sig('c', '2026-05-20T10:00:00'),
      ],
      now,
    )
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Earlier'])
    expect(groups[0].items.map((s) => s.id)).toEqual(['a'])
    expect(groups[1].items.map((s) => s.id)).toEqual(['b'])
    expect(groups[2].items.map((s) => s.id)).toEqual(['c'])
  })

  it('omits groups that have no items', () => {
    const groups = groupSignalsByDay([sig('a', '2026-06-02T01:00:00')], now)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Today')
  })

  it('preserves input order within a group', () => {
    const groups = groupSignalsByDay(
      [sig('a', '2026-06-02T08:00:00'), sig('b', '2026-06-02T11:00:00')],
      now,
    )
    expect(groups[0].items.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('returns an empty array for no signals', () => {
    expect(groupSignalsByDay([], now)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/group-signals.test.ts`
Expected: FAIL — cannot find module `./group-signals`

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/group-signals.ts`:
```ts
import type { Signal } from '@/lib/api'

export interface SignalDayGroup {
  label: 'Today' | 'Yesterday' | 'Earlier'
  items: Signal[]
}

// Whole-day difference between two dates using local calendar days.
function dayDiff(now: Date, then: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()
  return Math.round((a - b) / 86_400_000)
}

export function groupSignalsByDay(signals: Signal[], now: Date = new Date()): SignalDayGroup[] {
  const today: Signal[] = []
  const yesterday: Signal[] = []
  const earlier: Signal[] = []

  for (const s of signals) {
    const diff = dayDiff(now, new Date(s.created_at))
    if (diff <= 0) today.push(s)
    else if (diff === 1) yesterday.push(s)
    else earlier.push(s)
  }

  const groups: SignalDayGroup[] = [
    { label: 'Today', items: today },
    { label: 'Yesterday', items: yesterday },
    { label: 'Earlier', items: earlier },
  ]
  return groups.filter((g) => g.items.length > 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/group-signals.test.ts`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/group-signals.ts lib/dashboard/group-signals.test.ts
git commit -m "feat(dashboard): add groupSignalsByDay bucketing" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `alert-helpers.ts` — OOS duration, sort, urgency, counts (TDD)

**Files:**
- Create: `specter-web/lib/dashboard/alert-helpers.ts`
- Create: `specter-web/lib/dashboard/alert-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/alert-helpers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  OOS_URGENT_HOURS,
  oosDurationMs,
  formatOosDuration,
  isUrgentOOS,
  sortAlerts,
  alertCounts,
} from './alert-helpers'
import type { OOSAlert } from '@/lib/api'

function alert(p: Partial<OOSAlert>): OOSAlert {
  return {
    id: 'a',
    competitor_tracking_id: 'ct',
    sku_id: 's',
    sku_title: 't',
    competitor_domain: 'b.com',
    competitor_url: 'https://b.com/p',
    detected_at: '2026-06-01T00:00:00Z',
    resolved_at: null,
    notified_at: null,
    silenced: false,
    status: 'active',
    ...p,
  }
}

const now = new Date('2026-06-01T05:00:00Z')

describe('oosDurationMs', () => {
  it('active: now minus detected', () => {
    expect(oosDurationMs(alert({}), now)).toBe(5 * 3_600_000)
  })
  it('resolved: resolved minus detected', () => {
    const a = alert({ status: 'resolved', resolved_at: '2026-06-01T02:00:00Z' })
    expect(oosDurationMs(a, now)).toBe(2 * 3_600_000)
  })
})

describe('formatOosDuration', () => {
  it('formats days, hours, minutes with the largest unit', () => {
    expect(formatOosDuration(3 * 86_400_000)).toBe('3d')
    expect(formatOosDuration(5 * 3_600_000)).toBe('5h')
    expect(formatOosDuration(12 * 60_000)).toBe('12m')
  })
  it('clamps sub-minute durations to 1m', () => {
    expect(formatOosDuration(10_000)).toBe('1m')
  })
})

describe('isUrgentOOS', () => {
  it('is true for active alerts older than 24h', () => {
    const a = alert({ detected_at: '2026-05-30T00:00:00Z' })
    expect(isUrgentOOS(a, now)).toBe(true)
  })
  it('is false for active alerts within 24h', () => {
    expect(isUrgentOOS(alert({}), now)).toBe(false)
  })
  it('is false for resolved alerts regardless of duration', () => {
    const a = alert({ status: 'resolved', detected_at: '2026-05-20T00:00:00Z', resolved_at: '2026-05-31T00:00:00Z' })
    expect(isUrgentOOS(a, now)).toBe(false)
  })
  it('exposes the 24h threshold constant', () => {
    expect(OOS_URGENT_HOURS).toBe(24)
  })
})

describe('sortAlerts', () => {
  const a1 = alert({ id: 'a1', detected_at: '2026-06-01T03:00:00Z', competitor_domain: 'zeta.com' })
  const a2 = alert({ id: 'a2', detected_at: '2026-06-01T01:00:00Z', competitor_domain: 'alpha.com' })

  it('recent: newest detected first', () => {
    expect(sortAlerts([a2, a1], 'recent').map((a) => a.id)).toEqual(['a1', 'a2'])
  })
  it('oldest: oldest detected first', () => {
    expect(sortAlerts([a1, a2], 'oldest').map((a) => a.id)).toEqual(['a2', 'a1'])
  })
  it('domain: alphabetical by competitor_domain', () => {
    expect(sortAlerts([a1, a2], 'domain').map((a) => a.id)).toEqual(['a2', 'a1'])
  })
  it('does not mutate the input array', () => {
    const input = [a2, a1]
    sortAlerts(input, 'recent')
    expect(input.map((a) => a.id)).toEqual(['a2', 'a1'])
  })
})

describe('alertCounts', () => {
  it('counts active and resolved', () => {
    const counts = alertCounts([
      alert({ status: 'active' }),
      alert({ status: 'active' }),
      alert({ status: 'resolved', resolved_at: '2026-06-01T02:00:00Z' }),
    ])
    expect(counts).toEqual({ active: 2, resolved: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/alert-helpers.test.ts`
Expected: FAIL — cannot find module `./alert-helpers`

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/alert-helpers.ts`:
```ts
import type { OOSAlert } from '@/lib/api'

export type AlertSort = 'recent' | 'oldest' | 'domain'
export const OOS_URGENT_HOURS = 24

// Active: now − detected. Resolved: resolved − detected (0 if resolved_at missing).
export function oosDurationMs(a: OOSAlert, now: Date = new Date()): number {
  const detected = new Date(a.detected_at).getTime()
  const end =
    a.status === 'resolved' && a.resolved_at
      ? new Date(a.resolved_at).getTime()
      : now.getTime()
  return Math.max(0, end - detected)
}

// Largest whole unit, minimum "1m".
export function formatOosDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h`
  return `${Math.max(1, minutes)}m`
}

export function isUrgentOOS(a: OOSAlert, now: Date = new Date()): boolean {
  if (a.status !== 'active') return false
  return oosDurationMs(a, now) > OOS_URGENT_HOURS * 3_600_000
}

export function sortAlerts(alerts: OOSAlert[], sort: AlertSort): OOSAlert[] {
  const out = [...alerts]
  out.sort((a, b) => {
    if (sort === 'domain') return a.competitor_domain.localeCompare(b.competitor_domain)
    const ta = new Date(a.detected_at).getTime()
    const tb = new Date(b.detected_at).getTime()
    return sort === 'oldest' ? ta - tb : tb - ta
  })
  return out
}

export function alertCounts(alerts: OOSAlert[]): { active: number; resolved: number } {
  let active = 0
  let resolved = 0
  for (const a of alerts) {
    if (a.status === 'active') active++
    else resolved++
  }
  return { active, resolved }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/alert-helpers.test.ts`
Expected: PASS (15 passed)

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/alert-helpers.ts lib/dashboard/alert-helpers.test.ts
git commit -m "feat(dashboard): add alert duration/sort/urgency/count helpers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: URL parsers — `parseSignalSort`, `parseMinConfidence`, `parseAlertSort` (TDD)

**Files:**
- Modify: `specter-web/lib/dashboard/url-params.ts`
- Modify: `specter-web/lib/dashboard/url-params.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `specter-web/lib/dashboard/url-params.test.ts`:
```ts
import { parseSignalSort, parseMinConfidence, parseAlertSort } from './url-params'

describe('parseSignalSort', () => {
  it('accepts confidence', () => {
    expect(parseSignalSort('confidence')).toBe('confidence')
  })
  it('defaults to recent for anything else', () => {
    expect(parseSignalSort('recent')).toBe('recent')
    expect(parseSignalSort(null)).toBe('recent')
    expect(parseSignalSort('xyz')).toBe('recent')
  })
})

describe('parseMinConfidence', () => {
  it('accepts the discrete threshold values', () => {
    expect(parseMinConfidence('0.5')).toBe(0.5)
    expect(parseMinConfidence('0.7')).toBe(0.7)
    expect(parseMinConfidence('0.9')).toBe(0.9)
  })
  it('defaults to 0 for anything else', () => {
    expect(parseMinConfidence(null)).toBe(0)
    expect(parseMinConfidence('0')).toBe(0)
    expect(parseMinConfidence('0.8')).toBe(0)
    expect(parseMinConfidence('abc')).toBe(0)
  })
})

describe('parseAlertSort', () => {
  it('accepts oldest and domain', () => {
    expect(parseAlertSort('oldest')).toBe('oldest')
    expect(parseAlertSort('domain')).toBe('domain')
  })
  it('defaults to recent for anything else', () => {
    expect(parseAlertSort('recent')).toBe('recent')
    expect(parseAlertSort(null)).toBe('recent')
    expect(parseAlertSort('nope')).toBe('recent')
  })
})
```

(If `url-params.test.ts` does not already `import { describe, it, expect } from 'vitest'`, the existing top-of-file imports cover it — append only the new `import` for the parsers and the new `describe` blocks.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/url-params.test.ts`
Expected: FAIL — `parseSignalSort` is not exported

- [ ] **Step 3: Write the implementation**

Append to `specter-web/lib/dashboard/url-params.ts`. First add the import for `AlertSort` at the top (with the other type imports):
```ts
import type { AlertSort } from '@/lib/dashboard/alert-helpers'
```
Then append the parsers at the end of the file:
```ts
export function parseSignalSort(v: string | null): 'recent' | 'confidence' {
  return v === 'confidence' ? 'confidence' : 'recent'
}

export function parseMinConfidence(v: string | null): number {
  return v === '0.5' || v === '0.7' || v === '0.9' ? Number(v) : 0
}

export function parseAlertSort(v: string | null): AlertSort {
  return v === 'oldest' || v === 'domain' ? v : 'recent'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/url-params.test.ts`
Expected: PASS (all parser cases green)

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/url-params.ts lib/dashboard/url-params.test.ts
git commit -m "feat(dashboard): add signal sort / min-confidence / alert sort URL parsers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: `lib/api.ts` types + `useSignals` opts + preview fixtures

**Files:**
- Modify: `specter-web/lib/api.ts:85-103` (Signal + SignalList), `:215-216` (queryKeys.signals), `:454-469` (useSignals)
- Modify: `specter-web/lib/preview-data.ts` (signals fixtures + previewSignalList.counts)

No unit tests (types/hook). Verified by `tsc` here and by the page builds later.

- [ ] **Step 1: Add `current_price` to `Signal` and `counts` to `SignalList`**

In `specter-web/lib/api.ts`, update the `Signal` interface to add `current_price` after `price_suggestion`:
```ts
export interface Signal {
  id: string
  sku_id: string
  sku_title: string
  type: SignalType
  confidence: number
  reasoning: string | null
  price_suggestion: number | null
  current_price: number | null
  source: 'ai' | 'rule'
  ai_fallback: boolean
  created_at: string
}

export interface SignalTypeCounts {
  raise: number
  lower: number
  hold: number
}

export interface SignalList {
  items: Signal[]
  total: number
  limit: number
  offset: number
  counts: SignalTypeCounts
}
```

- [ ] **Step 2: Widen `queryKeys.signals` and the `useSignals` opts**

Replace the `signals` query key (line ~215) with one that keys off the new opts:
```ts
  signals: (opts?: {
    limit?: number
    offset?: number
    type?: string
    sort?: string
    minConfidence?: number
  }) => ['signals', opts ?? {}] as const,
```

Replace the `useSignals` function:
```ts
export function useSignals(opts?: {
  limit?: number
  offset?: number
  type?: SignalType
  sort?: 'recent' | 'confidence'
  minConfidence?: number
}): UseQueryResult<SignalList, ApiError> {
  const params = new URLSearchParams()
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset))
  if (opts?.type) params.set('type', opts.type)
  if (opts?.sort === 'confidence') params.set('sort', 'confidence')
  if (opts?.minConfidence && opts.minConfidence > 0)
    params.set('min_confidence', String(opts.minConfidence))
  const qs = params.toString()

  return useQuery({
    queryKey: queryKeys.signals(opts),
    queryFn: previewFn(previewSignalList, () => apiFetch<SignalList>(`/signals${qs ? `?${qs}` : ''}`)),
  })
}
```

- [ ] **Step 3: Add the new fields to preview fixtures**

In `specter-web/lib/preview-data.ts`, add a `current_price` to each of the three objects in `previewSignals` (use a realistic value above/below the suggestion):
- `sig_001` (Aurora, LOWER, suggestion 119.99): add `current_price: 129.0,`
- `sig_002` (Nimbus, RAISE, suggestion 209.0): add `current_price: 199.0,`
- `sig_003` (Lumen, HOLD, suggestion null): add `current_price: 39.0,`

Then add a `counts` object to `previewSignalList`:
```ts
export const previewSignalList: SignalList = {
  items: previewSignals,
  total: previewSignals.length,
  limit: 50,
  offset: 0,
  counts: { raise: 1, lower: 1, hold: 1 },
}
```

- [ ] **Step 4: Type-check**

Run: `cd specter-web && npx tsc --noEmit`
Expected: exit 0 (no errors)

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/api.ts lib/preview-data.ts
git commit -m "feat(api): add signal current_price + counts and useSignals sort/min-confidence opts" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: `confidence-meter.tsx` + `signal-provenance.tsx` components

**Files:**
- Create: `specter-web/components/dashboard/confidence-meter.tsx`
- Create: `specter-web/components/dashboard/signal-provenance.tsx`

Presentational only; verified by `tsc`.

- [ ] **Step 1: Create `confidence-meter.tsx`**

`specter-web/components/dashboard/confidence-meter.tsx`:
```tsx
import { confidenceTier, type ConfidenceTier } from '@/lib/dashboard/confidence'
import { cn } from '@/lib/utils'

const BAR: Record<ConfidenceTier, string> = {
  high: 'bg-primary',
  medium: 'bg-amber-400',
  low: 'bg-muted',
}

const TEXT: Record<ConfidenceTier, string> = {
  high: 'text-primary',
  medium: 'text-amber-400',
  low: 'text-muted',
}

const LABEL: Record<ConfidenceTier, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
}

export default function ConfidenceMeter({ confidence }: { confidence: number }) {
  const tier = confidenceTier(confidence)
  const pct = Math.round(confidence * 100)
  return (
    <div className="flex flex-col items-end gap-1 w-20">
      <span className={cn('font-mono text-xs tabular-nums', TEXT[tier])}>
        {pct}% · {LABEL[tier]}
      </span>
      <div className="h-1 w-full rounded-full bg-border overflow-hidden">
        <div className={cn('h-full rounded-full', BAR[tier])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `signal-provenance.tsx`**

`specter-web/components/dashboard/signal-provenance.tsx`:
```tsx
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SignalProvenance({
  source,
  aiFallback,
}: {
  source: 'ai' | 'rule'
  aiFallback: boolean
}) {
  if (source === 'ai' && !aiFallback) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
        <Sparkles size={10} aria-hidden="true" />
        AI
      </span>
    )
  }
  if (source === 'ai' && aiFallback) {
    return (
      <span
        title="The AI call failed; this signal fell back to rule-based logic."
        className="inline-flex items-center rounded-md border border-amber-400/25 bg-amber-400/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-400"
      >
        AI·fallback
      </span>
    )
  }
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border border-muted/30 bg-muted/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted',
    )}>
      Rule
    </span>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd specter-web && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
cd specter-web
git add components/dashboard/confidence-meter.tsx components/dashboard/signal-provenance.tsx
git commit -m "feat(dashboard): add ConfidenceMeter and SignalProvenance components" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Signals page wiring

**Files:**
- Modify: `specter-web/app/(dashboard)/signals/page.tsx` (full replacement)

Adds count tabs, Sort + Min-confidence dropdowns, ConfidenceMeter, SignalProvenance, price delta, and day-grouping (Newest only). All controls are URL state via `useQueryParams`.

- [ ] **Step 1: Replace the page**

`specter-web/app/(dashboard)/signals/page.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Radio, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSignals, type SignalType, type Signal } from '@/lib/api'
import SignalBadge from '@/components/dashboard/signal-badge'
import ConfidenceMeter from '@/components/dashboard/confidence-meter'
import SignalProvenance from '@/components/dashboard/signal-provenance'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseSignalType, parsePage, parseSignalSort, parseMinConfidence } from '@/lib/dashboard/url-params'
import { repricingHref } from '@/lib/dashboard/deep-links'
import { formatPriceDelta } from '@/lib/dashboard/price-delta'
import { groupSignalsByDay } from '@/lib/dashboard/group-signals'

const PAGE_SIZE = 20

const SORTS: Array<{ label: string; value: 'recent' | 'confidence' }> = [
  { label: 'Newest', value: 'recent' },
  { label: 'Highest confidence', value: 'confidence' },
]

const THRESHOLDS: Array<{ label: string; value: number }> = [
  { label: 'All', value: 0 },
  { label: '50%+', value: 0.5 },
  { label: '70%+', value: 0.7 },
  { label: '90%+', value: 0.9 },
]

export default function SignalsPage() {
  const { get, set } = useQueryParams()
  const filter = parseSignalType(get('type'))
  const page = parsePage(get('page'))
  const sort = parseSignalSort(get('sort'))
  const minConfidence = parseMinConfidence(get('min'))

  const { data, isLoading } = useSignals({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    type: filter,
    sort,
    minConfidence,
  })

  const signals = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const counts = data?.counts

  const FILTERS: Array<{ label: string; value: SignalType | undefined; count?: number }> = [
    { label: 'All', value: undefined, count: counts ? counts.raise + counts.lower + counts.hold : undefined },
    { label: 'Raise', value: 'RAISE', count: counts?.raise },
    { label: 'Lower', value: 'LOWER', count: counts?.lower },
    { label: 'Hold', value: 'HOLD', count: counts?.hold },
  ]

  // Clamp a deep-linked / hand-edited page past the end once data loads.
  useEffect(() => {
    if (data && page > totalPages - 1) {
      const last = totalPages - 1
      set({ page: last > 0 ? String(last) : null })
    }
  }, [data, page, totalPages, set])

  function renderRow(sig: Signal) {
    const delta = formatPriceDelta(sig.current_price, sig.price_suggestion)
    return (
      <li
        key={sig.id}
        className="flex items-start gap-4 bg-surface border border-border rounded-xl px-4 py-3.5"
      >
        <SignalBadge type={sig.type} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-body text-sm font-medium text-text truncate">{sig.sku_title}</p>
            <SignalProvenance source={sig.source} aiFallback={sig.ai_fallback} />
          </div>
          {sig.reasoning && (
            <p className="font-body text-xs text-muted mt-0.5">{sig.reasoning}</p>
          )}
          {sig.price_suggestion !== null && (
            <p className="font-mono text-xs text-primary mt-1">
              Suggested: ${sig.price_suggestion.toFixed(2)}
              {delta && <span className="text-muted"> ({delta})</span>}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ConfidenceMeter confidence={sig.confidence} />
          <span className="font-body text-xs text-muted">{timeAgo(sig.created_at)}</span>
        </div>
        <Link
          href={repricingHref(sig.sku_id, 'signals')}
          className="font-body text-xs text-primary hover:underline shrink-0 self-center whitespace-nowrap"
        >
          Review &amp; act →
        </Link>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">Signals</h1>
        <p className="font-body text-sm text-muted mt-1">
          AI-powered RAISE / LOWER / HOLD recommendations across your tracked products.
        </p>
      </header>

      {/* Filter tabs with per-type counts */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => set({ type: f.value ?? null, page: null })}
            className={cn(
              'px-3.5 py-1.5 rounded-lg font-body text-sm transition-colors',
              filter === f.value
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-text hover:bg-border/40',
            )}
          >
            {f.label}
            {f.count !== undefined && (
              <span className="ml-1.5 font-mono text-xs opacity-70">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sort + min-confidence controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-body text-xs text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => set({ sort: e.target.value === 'recent' ? null : e.target.value, page: null })}
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-body text-xs text-muted">
          Min confidence
          <select
            value={String(minConfidence)}
            onChange={(e) => {
              const v = Number(e.target.value)
              set({ min: v === 0 ? null : String(v), page: null })
            }}
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
          >
            {THRESHOLDS.map((t) => (
              <option key={t.value} value={String(t.value)}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[60px] rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No signals to show"
          description="Signals are generated after each scrape cycle once you're tracking competitors. Check back shortly, or adjust your filter."
          cta={{ label: 'Manage competitors', href: '/competitors' }}
        />
      ) : (
        <>
          {sort === 'recent' ? (
            <div className="flex flex-col gap-5">
              {groupSignalsByDay(signals, new Date()).map((group) => (
                <div key={group.label} className="flex flex-col gap-2">
                  <h2 className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    {group.label}
                  </h2>
                  <ul className="flex flex-col gap-2">{group.items.map(renderRow)}</ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">{signals.map(renderRow)}</ul>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="font-body text-xs text-muted">
              {total} signal{total === 1 ? '' : 's'} · page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => set({ page: page > 1 ? String(page - 1) : null })}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border font-body text-sm text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} />
                Prev
              </button>
              <button
                onClick={() => set({ page: String(page + 1) })}
                disabled={page + 1 >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border font-body text-sm text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd specter-web && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
cd specter-web
git add "app/(dashboard)/signals/page.tsx"
git commit -m "feat(signals): count tabs, sort + min-confidence, meter, provenance, delta, day-grouping" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Alerts page wiring

**Files:**
- Modify: `specter-web/app/(dashboard)/alerts/page.tsx` (full replacement)

Adds a client-side Sort dropdown, an active·resolved summary header, per-row OOS duration, and an urgency accent for >24h active alerts.

- [ ] **Step 1: Replace the page**

`specter-web/app/(dashboard)/alerts/page.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { BellRing, BellOff, Bell, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAlerts, useSilenceAlert } from '@/lib/api'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseAlertStatus, parseAlertSort } from '@/lib/dashboard/url-params'
import { repricingHref } from '@/lib/dashboard/deep-links'
import {
  sortAlerts,
  alertCounts,
  oosDurationMs,
  formatOosDuration,
  isUrgentOOS,
} from '@/lib/dashboard/alert-helpers'

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'active' as const },
  { label: 'Resolved', value: 'resolved' as const },
]

const SORTS = [
  { label: 'Newest', value: 'recent' as const },
  { label: 'Oldest', value: 'oldest' as const },
  { label: 'Domain', value: 'domain' as const },
]

export default function AlertsPage() {
  const { get, set } = useQueryParams()
  const filter = parseAlertStatus(get('status'))
  const sort = parseAlertSort(get('sort'))
  const { data, isLoading } = useAlerts(filter)
  const silenceMut = useSilenceAlert()

  const rawAlerts = data?.items ?? []
  const alerts = sortAlerts(rawAlerts, sort)
  const counts = alertCounts(rawAlerts)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">Out-of-stock alerts</h1>
        <p className="font-body text-sm text-muted mt-1">
          When a tracked competitor goes out of stock, that&apos;s your window to raise
          price and capture demand.
        </p>
        {rawAlerts.length > 0 && (
          <p className="font-mono text-xs text-muted mt-2">
            <span className="text-rose-400">{counts.active} active</span>
            {' · '}
            <span className="text-primary">{counts.resolved} resolved</span>
          </p>
        )}
      </header>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => set({ status: f.value ?? null })}
            className={cn(
              'px-3.5 py-1.5 rounded-lg font-body text-sm transition-colors',
              filter === f.value
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-text hover:bg-border/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort control */}
      <label className="flex items-center gap-2 font-body text-xs text-muted">
        Sort
        <select
          value={sort}
          onChange={(e) => set({ sort: e.target.value === 'recent' ? null : e.target.value })}
          className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No alerts"
          description="You'll be notified here (and by email) the moment a tracked competitor goes out of stock. Nothing to action right now."
          cta={{ label: 'Manage competitors', href: '/competitors' }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((a) => {
            const isActive = a.status === 'active'
            const urgent = isUrgentOOS(a)
            const duration = formatOosDuration(oosDurationMs(a))
            return (
              <li
                key={a.id}
                className={cn(
                  'flex items-center gap-4 border rounded-xl px-4 py-3',
                  urgent
                    ? 'border-rose-400/50 bg-rose-400/[0.07]'
                    : 'border-border bg-surface',
                )}
              >
                <div className="shrink-0">
                  {isActive ? (
                    <AlertCircle size={18} className="text-rose-400" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={18} className="text-primary" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-text truncate">
                    <span className="font-medium">{a.competitor_domain}</span> out of stock
                    <span className="text-muted"> · your {a.sku_title}</span>
                  </p>
                  <p className="font-body text-xs text-muted mt-0.5">
                    {isActive ? (
                      <>Detected {timeAgo(a.detected_at)} · out of stock for {duration}</>
                    ) : (
                      <>Resolved {a.resolved_at ? timeAgo(a.resolved_at) : ''} · restocked after {duration}</>
                    )}
                  </p>
                </div>

                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold uppercase shrink-0',
                    isActive
                      ? 'border-rose-400/25 bg-rose-400/12 text-rose-400'
                      : 'border-primary/25 bg-primary/12 text-primary',
                  )}
                >
                  {a.status}
                </span>

                {isActive && (
                  <Link
                    href={repricingHref(a.sku_id, 'alerts')}
                    className="font-body text-xs text-primary hover:underline shrink-0 whitespace-nowrap"
                  >
                    Review &amp; act →
                  </Link>
                )}

                {/* Silence toggle (per competitor URL) */}
                <button
                  onClick={() =>
                    silenceMut.mutate(
                      { alertId: a.id, silenced: !a.silenced },
                      {
                        onSuccess: () =>
                          toast.success(
                            `Alerts ${!a.silenced ? 'silenced' : 'unsilenced'} for ${a.competitor_domain}`,
                          ),
                      },
                    )
                  }
                  disabled={silenceMut.isPending}
                  title={a.silenced ? 'Alerts silenced for this URL' : 'Silence alerts for this URL'}
                  className={cn(
                    'p-2 rounded-lg transition-colors shrink-0',
                    a.silenced
                      ? 'text-muted hover:text-text hover:bg-border/40'
                      : 'text-primary hover:bg-primary/10',
                  )}
                >
                  {a.silenced ? <BellOff size={16} /> : <Bell size={16} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd specter-web && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
cd specter-web
git add "app/(dashboard)/alerts/page.tsx"
git commit -m "feat(alerts): client-side sort, summary header, OOS duration, urgency accent" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full web unit suite**

Run: `cd specter-web && npm test -- --run`
Expected: PASS — all prior 266 tests plus the new pure suites (confidence 3, price-delta 7, group-signals 4, alert-helpers 15, url-params parsers). No failures.

- [ ] **Step 2: Lint**

Run: `cd specter-web && npm run lint`
Expected: no new errors/warnings from the changed files.

- [ ] **Step 3: Production build**

Run: `cd specter-web && npm run build`
Expected: build succeeds; `/signals` and `/alerts` compile clean.

- [ ] **Step 4: specter-api signal tests**

Run: `cd specter-api && python -m pytest routers/test_signals.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: No commit** — verification only. If any step fails, fix in the owning task before finishing the branch.

---

## Self-Review (completed during planning)

**1. Spec coverage**
- §3.1 sort/min_confidence/current_price/counts → Tasks 2, 3. ✓
- §3.2 migration 0006 → Task 1. ✓
- §3.3 API tests (sort, min_confidence, counts, current_price, type composition, 422) → Tasks 2–3. *Note:* ordering/threshold filtering is performed in SQL; with the repo's mocked-session test infra these are covered at the contract level (serialization of canned rows + 422 validation boundary) rather than against a live DB, matching existing `test_products.py` practice. Live-DB assertions of ordering are out of reach without a test Postgres and are not introduced here.
- §4.1 api types + useSignals + preview fixtures → Task 9. ✓
- §4.2 confidence/price-delta/group-signals/alert-helpers + url parsers → Tasks 4–8. ✓
- §4.3 confidence-meter + signal-provenance → Task 10. ✓
- §4.4 Signals page wiring → Task 11. ✓
- §4.5 Alerts page wiring → Task 12. ✓
- §6 testing (pure-only on web; pytest on api) → Tasks 4–8, 13. ✓

**2. Placeholder scan:** none — every code step contains complete code.

**3. Type consistency:**
- `SignalTypeCounts` web `{ raise, lower, hold }` ↔ api `raise_`/serialization_alias `"raise"` → JSON key `raise` matches the web type. ✓
- `AlertSort` defined once in `alert-helpers.ts`, imported by `url-params.ts` (Task 8) and used by the alerts page (Task 12). ✓
- `confidenceTier`/`ConfidenceTier` used by `confidence-meter.tsx`. ✓
- `useSignals` opts (`sort`, `minConfidence`) match the Signals page call site. ✓
- URL keys: signals use `type`/`page`/`sort`/`min`; alerts use `status`/`sort` — no collisions within a page. ✓

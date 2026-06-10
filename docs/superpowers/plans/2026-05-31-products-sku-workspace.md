# Products / SKU Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a product-centric Products dashboard tab (below Competitors) backed by one aggregated `GET /products` endpoint, refactor the Competitors tab into a client-side by-domain lens over the same data, and enforce/display the SKU-pairing limit consistently.

**Architecture:** specter-api gains one read-only `GET /products` endpoint that joins each product to its enabled competitor trackings (+ latest price snapshot) and its latest signal — no schema changes, no migration. specter-web adds a Products page and refactors Competitors to pivot the same payload by domain; both share one TanStack Query cache. SKU = (product × competitor) pairing; limits are already enforced server-side in `POST /competitors`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async + Pydantic v2 + pytest (backend); Next.js 14 App Router + TypeScript + TanStack Query + Tailwind + Vitest (frontend).

---

## Source-of-Truth References

- Spec: `docs/superpowers/specs/2026-05-31-products-sku-workspace-design.md`.
- Existing patterns to mirror: `specter-api/routers/skus.py` (SKU schemas/count), `specter-api/routers/competitors.py` (tracking mutations + 402/409/422), `specter-api/routers/test_merchants.py` (test harness), `specter-web/lib/api.ts` (`useRepricing` aggregate hook precedent), `specter-web/app/(dashboard)/competitors/page.tsx` (current page being refactored), `specter-web/app/(dashboard)/layout.tsx` (nav).

## Conventions (read before any task)

- **Backend test policy:** full TDD with pytest. Env vars set by `tests/conftest.py`. Run from `specter-api`: `python -m pytest -q`. Mirror `routers/test_merchants.py` (real HS256 JWT via `make_jwt`, `MagicMock(spec=Merchant)` via `make_merchant`, dependency overrides on `get_current_merchant` + `get_db`).
- **Frontend test policy (CLAUDE.md):** test **pure logic only** (helpers). DO NOT write component/page tests. Verify UI with `npm run lint` + `npm run build` + manual `npm run dev`. Run from `specter-web`: `npm test -- <file>`, `npm run lint`, `npm run build`.
- **Branches (already created):** specter-api → `plg-free-tools-redesign`; specter-web → `plg-free-tools-redesign`. Commit each task there. Do NOT use `git reset --hard`. Stage only the exact files listed (the git root is `C:/Users/manoj` with large untracked content — never `git add -A`/`.`).
- **Restore dependencies (from the earlier reset, pre-req for specific steps):** `.eslintrc.json` must be restored before `npm run lint`/`build` pass; `components/marketing/pricing-section.tsx` must be restored before Task E2. These are flagged inline.
- **Hard rules:** plan limits enforced server-side only (frontend UI-only); `GET /products` is read-only; no schema/migration changes in this plan.

---

# PHASE A — Backend: `GET /products`

### Task A1: Pure `assemble_products()` builder + Pydantic schemas

**Files:**

- Create: `specter-api/routers/products.py`
- Test: `specter-api/routers/test_products.py`

- [ ] **Step 1: Write the failing test for the pure builder**

Create `specter-api/routers/test_products.py`:

```python
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from routers.products import assemble_products


def _ns(**kw):
    return SimpleNamespace(**kw)


def test_assemble_groups_competitors_under_product_and_derives_source():
    p_id = uuid.uuid4()
    url_id = uuid.uuid4()
    tr_id = uuid.uuid4()
    sku = _ns(id=p_id, title="Earbuds", handle="earbuds", current_price=Decimal("89.99"),
              shopify_variant_id="123", active=True, floor_price=None, ceiling_price=None)
    tracking = _ns(id=tr_id, own_product_id=p_id, competitor_url_id=url_id,
                   enabled=True, silenced_oos=False)
    url = _ns(domain="amazon.com", url_path="/dp/x", robots_blocked=False)
    snap = _ns(price=Decimal("79.99"), in_stock=True,
               scraped_at=datetime(2026, 5, 31, tzinfo=timezone.utc))
    sig = _ns(type="RAISE", price_suggestion=Decimal("93.40"),
              confidence=Decimal("0.82"), created_at=datetime(2026, 5, 31, tzinfo=timezone.utc))

    out = assemble_products(
        skus=[sku], trackings=[tracking],
        url_by_id={url_id: url}, snapshot_by_url={url_id: snap},
        signal_by_sku={p_id: sig}, sku_used=1, sku_limit=100, max_competitors_per_sku=3,
    )
    assert out.sku_used == 1 and out.sku_limit == 100 and out.max_competitors_per_sku == 3
    assert len(out.items) == 1
    item = out.items[0]
    assert item.source == "shopify"          # shopify_variant_id present
    assert item.competitor_count == 1
    assert item.latest_signal.type == "RAISE"
    assert float(item.latest_signal.confidence) == 0.82
    assert len(item.competitors) == 1
    c = item.competitors[0]
    assert c.domain == "amazon.com"
    assert c.url == "https://amazon.com/dp/x"
    assert c.latest_price == Decimal("79.99")
    assert c.in_stock is True


def test_assemble_manual_source_and_missing_snapshot_and_signal():
    p_id = uuid.uuid4(); url_id = uuid.uuid4(); tr_id = uuid.uuid4()
    sku = _ns(id=p_id, title="Manual", handle=None, current_price=None,
              shopify_variant_id=None, active=True, floor_price=None, ceiling_price=None)
    tracking = _ns(id=tr_id, own_product_id=p_id, competitor_url_id=url_id,
                   enabled=True, silenced_oos=False)
    url = _ns(domain="rival.com", url_path="/p", robots_blocked=True)

    out = assemble_products(
        skus=[sku], trackings=[tracking],
        url_by_id={url_id: url}, snapshot_by_url={}, signal_by_sku={},
        sku_used=1, sku_limit=None, max_competitors_per_sku=None,
    )
    item = out.items[0]
    assert item.source == "manual"            # no shopify_variant_id
    assert item.latest_signal is None
    c = item.competitors[0]
    assert c.latest_price is None and c.in_stock is None and c.last_checked_at is None
    assert c.robots_blocked is True
```

- [ ] **Step 2: Run it, expect FAIL**

Run (cwd `specter-api`): `python -m pytest routers/test_products.py -q`
Expected: FAIL — `cannot import name 'assemble_products'`.

- [ ] **Step 3: Implement schemas + the pure builder**

Create `specter-api/routers/products.py`:

```python
"""
Products workspace — aggregated read endpoint (GET /products).

Returns the product-centric tree: each product → its enabled competitor
trackings (+ latest price snapshot) → the product's latest signal, plus the
merchant's SKU usage counters. Read-only; no schema changes.

SKU = one (product × competitor) pairing. Limit = COUNT(enabled trackings).
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import PLAN_MAX_SKUS
from auth.supabase import get_current_merchant
from db import get_db
from models.competitor_trackings import CompetitorTracking
from models.competitor_urls import CompetitorURL
from models.merchants import Merchant
from models.price_snapshots import PriceSnapshot
from models.signals import Signal
from models.skus import SKU

router = APIRouter(prefix="/products", tags=["products"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CompetitorRow(BaseModel):
    tracking_id: uuid.UUID
    competitor_url_id: uuid.UUID
    url: str
    domain: str
    enabled: bool
    silenced_oos: bool
    robots_blocked: bool
    latest_price: Optional[Decimal]
    in_stock: Optional[bool]
    last_checked_at: Optional[str]


class LatestSignal(BaseModel):
    type: str
    price_suggestion: Optional[Decimal]
    confidence: Decimal
    created_at: str


class ProductOut(BaseModel):
    id: uuid.UUID
    title: str
    handle: Optional[str]
    current_price: Optional[Decimal]
    source: str
    active: bool
    floor_price: Optional[Decimal]
    ceiling_price: Optional[Decimal]
    competitor_count: int
    latest_signal: Optional[LatestSignal]
    competitors: list[CompetitorRow]


class ProductsOut(BaseModel):
    items: list[ProductOut]
    sku_used: int
    sku_limit: Optional[int]
    max_competitors_per_sku: Optional[int]


# ── Pure builder (unit-tested without a DB) ──────────────────────────────────

def assemble_products(
    *,
    skus,
    trackings,
    url_by_id,
    snapshot_by_url,
    signal_by_sku,
    sku_used: int,
    sku_limit: Optional[int],
    max_competitors_per_sku: Optional[int],
) -> ProductsOut:
    """Build the ProductsOut tree from already-fetched rows / lookup dicts.

    `trackings` must already be filtered to enabled rows. Reads attributes only,
    so plain objects (e.g. SimpleNamespace) work in tests.
    """
    trackings_by_product: dict[uuid.UUID, list] = {}
    for t in trackings:
        trackings_by_product.setdefault(t.own_product_id, []).append(t)

    items: list[ProductOut] = []
    for sku in skus:
        rows: list[CompetitorRow] = []
        for t in trackings_by_product.get(sku.id, []):
            url = url_by_id.get(t.competitor_url_id)
            snap = snapshot_by_url.get(t.competitor_url_id)
            rows.append(CompetitorRow(
                tracking_id=t.id,
                competitor_url_id=t.competitor_url_id,
                url=f"https://{url.domain}{url.url_path}" if url else "",
                domain=url.domain if url else "",
                enabled=t.enabled,
                silenced_oos=t.silenced_oos,
                robots_blocked=url.robots_blocked if url else False,
                latest_price=snap.price if snap else None,
                in_stock=snap.in_stock if snap else None,
                last_checked_at=snap.scraped_at.isoformat() if snap else None,
            ))
        sig = signal_by_sku.get(sku.id)
        latest = LatestSignal(
            type=sig.type,
            price_suggestion=sig.price_suggestion,
            confidence=sig.confidence,
            created_at=sig.created_at.isoformat(),
        ) if sig else None
        items.append(ProductOut(
            id=sku.id,
            title=sku.title,
            handle=sku.handle,
            current_price=sku.current_price,
            source="shopify" if sku.shopify_variant_id else "manual",
            active=sku.active,
            floor_price=sku.floor_price,
            ceiling_price=sku.ceiling_price,
            competitor_count=len(rows),
            latest_signal=latest,
            competitors=rows,
        ))
    return ProductsOut(
        items=items,
        sku_used=sku_used,
        sku_limit=sku_limit,
        max_competitors_per_sku=max_competitors_per_sku,
    )
```

- [ ] **Step 4: Run it, expect PASS**

Run: `python -m pytest routers/test_products.py -q`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add specter-api/routers/products.py specter-api/routers/test_products.py
git commit -m "feat(api): products workspace schemas + assemble_products builder"
```

### Task A2: `GET /products` route (DB fetch → assemble) + registration

**Files:**

- Modify: `specter-api/routers/products.py`
- Modify: `specter-api/main.py`
- Test: `specter-api/routers/test_products.py`

- [ ] **Step 1: Write the failing route smoke test**

Append to `specter-api/routers/test_products.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from auth.supabase import get_current_merchant
from db import get_db
from main import app


def _merchant(plan="recon"):
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = plan
    m.max_competitors_per_sku = 3
    return m


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_get_products_empty_returns_counts(client):
    m = _merchant(plan="recon")

    session = AsyncMock()
    # Every select(...).scalars().all() → [] ; func.count() → 0
    empty = MagicMock()
    empty.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    empty.scalar_one = MagicMock(return_value=0)
    session.execute = AsyncMock(return_value=empty)

    async def _ovr_merchant(): return m
    async def _ovr_db(): yield session
    app.dependency_overrides[get_current_merchant] = _ovr_merchant
    app.dependency_overrides[get_db] = _ovr_db

    resp = client.get("/products")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["sku_used"] == 0
    assert body["sku_limit"] == 100          # RECON
    assert body["max_competitors_per_sku"] == 3
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `python -m pytest routers/test_products.py::test_get_products_empty_returns_counts -q`
Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Implement the route**

Append to `specter-api/routers/products.py`:

```python
@router.get("", response_model=ProductsOut)
async def list_products(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> ProductsOut:
    # 1. Products
    skus = list((await session.execute(
        select(SKU).where(SKU.merchant_id == merchant.id).order_by(SKU.created_at.desc())
    )).scalars().all())
    sku_ids = [s.id for s in skus]

    # 2. Enabled trackings for this merchant
    trackings = list((await session.execute(
        select(CompetitorTracking).where(
            CompetitorTracking.merchant_id == merchant.id,
            CompetitorTracking.enabled.is_(True),
        )
    )).scalars().all())

    # 3. Competitor URLs referenced
    url_ids = list({t.competitor_url_id for t in trackings})
    url_by_id: dict = {}
    if url_ids:
        for u in (await session.execute(
            select(CompetitorURL).where(CompetitorURL.id.in_(url_ids))
        )).scalars().all():
            url_by_id[u.id] = u

    # 4. Latest snapshot per URL (newest scraped_at wins)
    snapshot_by_url: dict = {}
    if url_ids:
        snaps = (await session.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.competitor_url_id.in_(url_ids))
            .order_by(PriceSnapshot.scraped_at.desc())
        )).scalars().all()
        for s in snaps:
            snapshot_by_url.setdefault(s.competitor_url_id, s)  # first = newest

    # 5. Latest signal per product (newest created_at wins)
    signal_by_sku: dict = {}
    if sku_ids:
        sigs = (await session.execute(
            select(Signal)
            .where(Signal.sku_id.in_(sku_ids))
            .order_by(Signal.created_at.desc())
        )).scalars().all()
        for sig in sigs:
            signal_by_sku.setdefault(sig.sku_id, sig)  # first = newest

    # 6. SKU usage = enabled tracking count
    sku_used = (await session.execute(
        select(func.count()).where(
            CompetitorTracking.merchant_id == merchant.id,
            CompetitorTracking.enabled.is_(True),
        )
    )).scalar_one()

    return assemble_products(
        skus=skus,
        trackings=trackings,
        url_by_id=url_by_id,
        snapshot_by_url=snapshot_by_url,
        signal_by_sku=signal_by_sku,
        sku_used=sku_used,
        sku_limit=PLAN_MAX_SKUS.get(merchant.plan),
        max_competitors_per_sku=merchant.max_competitors_per_sku,
    )
```

Register in `specter-api/main.py`:

```python
from routers import merchants, skus, competitors, signals, alerts, repricing, attribution, products
...
app.include_router(products.router)
```

- [ ] **Step 4: Run it, expect PASS**

Run: `python -m pytest routers/test_products.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite + commit**

Run: `python -m pytest -q` → all green.

```bash
git add specter-api/routers/products.py specter-api/routers/test_products.py specter-api/main.py
git commit -m "feat(api): GET /products aggregated endpoint + registration"
```

---

# PHASE B — Frontend: types, hook, pure helpers

### Task B1: `useProducts` hook + types in `lib/api.ts`

**Files:**

- Modify: `specter-web/lib/api.ts`

- [ ] **Step 1: Add types + hook** (place after the SKU hooks section)

```ts
// ════════════════════════════════════════════════════════════════════════════
// PRODUCTS WORKSPACE
// ════════════════════════════════════════════════════════════════════════════

export interface ProductCompetitor {
  tracking_id: string
  competitor_url_id: string
  url: string
  domain: string
  enabled: boolean
  silenced_oos: boolean
  robots_blocked: boolean
  latest_price: number | null
  in_stock: boolean | null
  last_checked_at: string | null
}

export interface ProductSignal {
  type: SignalType
  price_suggestion: number | null
  confidence: number
  created_at: string
}

export interface Product {
  id: string
  title: string
  handle: string | null
  current_price: number | null
  source: 'shopify' | 'manual'
  active: boolean
  floor_price: number | null
  ceiling_price: number | null
  competitor_count: number
  latest_signal: ProductSignal | null
  competitors: ProductCompetitor[]
}

export interface ProductsResponse {
  items: Product[]
  sku_used: number
  sku_limit: number | null
  max_competitors_per_sku: number | null
}

export function useProducts(): UseQueryResult<ProductsResponse, ApiError> {
  return useQuery({
    queryKey: ['products'] as const,
    queryFn: () => apiFetch<ProductsResponse>('/products'),
  })
}
```

Add to `queryKeys`: `products: ['products'] as const,`.

- [ ] **Step 2: Verify + commit**

Run (cwd `specter-web`): `npm run build` (lint requires `.eslintrc.json` restored — build alone compiles types).
Expected: compiles (types valid). If lint blocks, that's the pre-existing `.eslintrc` issue, not this change.

```bash
git add specter-web/lib/api.ts
git commit -m "feat(web): Product types + useProducts hook"
```

### Task B2: Pure helpers (`group-by-domain`, `sort-products`) + Vitest tests

**Files:**

- Create: `specter-web/lib/dashboard/group-by-domain.ts`
- Create: `specter-web/lib/dashboard/group-by-domain.test.ts`
- Create: `specter-web/lib/dashboard/sort-products.ts`
- Create: `specter-web/lib/dashboard/sort-products.test.ts`

- [ ] **Step 1: Write failing tests**

`specter-web/lib/dashboard/group-by-domain.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupByDomain } from './group-by-domain'
import type { Product } from '@/lib/api'

const product = (over: Partial<Product>): Product => ({
  id: 'p', title: 't', handle: null, current_price: 100, source: 'manual',
  active: true, floor_price: null, ceiling_price: null, competitor_count: 0,
  latest_signal: null, competitors: [], ...over,
})

describe('groupByDomain', () => {
  it('groups pairings by domain with avg price gap and stock counts', () => {
    const products: Product[] = [
      product({ id: 'a', current_price: 100, competitors: [
        { tracking_id: 't1', competitor_url_id: 'u1', url: 'https://amazon.com/x', domain: 'amazon.com',
          enabled: true, silenced_oos: false, robots_blocked: false, latest_price: 90, in_stock: true, last_checked_at: '2026-05-31T00:00:00Z' },
      ] }),
      product({ id: 'b', current_price: 100, competitors: [
        { tracking_id: 't2', competitor_url_id: 'u2', url: 'https://amazon.com/y', domain: 'amazon.com',
          enabled: true, silenced_oos: false, robots_blocked: false, latest_price: 110, in_stock: false, last_checked_at: '2026-05-31T00:00:00Z' },
      ] }),
    ]
    const groups = groupByDomain(products)
    expect(groups).toHaveLength(1)
    const g = groups[0]
    expect(g.domain).toBe('amazon.com')
    expect(g.productCount).toBe(2)
    expect(g.inStock).toBe(1)
    expect(g.oos).toBe(1)
    // gaps: (90-100)/100 = -0.10 ; (110-100)/100 = +0.10 ; avg = 0
    expect(g.avgPriceGap).toBeCloseTo(0)
    expect(g.health).toBe('healthy')
  })

  it('marks domain blocked when any pairing is robots_blocked', () => {
    const products: Product[] = [product({ competitors: [
      { tracking_id: 't', competitor_url_id: 'u', url: 'https://x.com/p', domain: 'x.com',
        enabled: true, silenced_oos: false, robots_blocked: true, latest_price: null, in_stock: null, last_checked_at: null },
    ] })]
    expect(groupByDomain(products)[0].health).toBe('blocked')
  })
})
```

`specter-web/lib/dashboard/sort-products.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sortProducts } from './sort-products'
import type { Product } from '@/lib/api'

const p = (id: string, type: 'RAISE'|'LOWER'|'HOLD'|null, conf = 0.5): Product => ({
  id, title: id, handle: null, current_price: 1, source: 'manual', active: true,
  floor_price: null, ceiling_price: null, competitor_count: 0, competitors: [],
  latest_signal: type ? { type, price_suggestion: null, confidence: conf, created_at: '2026-05-31T00:00:00Z' } : null,
})

describe('sortProducts signals-first', () => {
  it('orders RAISE, LOWER, HOLD, then no-signal; ties by confidence desc', () => {
    const out = sortProducts([p('hold','HOLD'), p('none',null), p('raiseLo','RAISE',0.4), p('lower','LOWER'), p('raiseHi','RAISE',0.9)], 'signals')
    expect(out.map(x => x.id)).toEqual(['raiseHi','raiseLo','lower','hold','none'])
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test -- group-by-domain sort-products`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement helpers**

`specter-web/lib/dashboard/sort-products.ts`:

```ts
import type { Product } from '@/lib/api'

export type ProductSort = 'signals' | 'updated' | 'name'

const SIGNAL_RANK: Record<string, number> = { RAISE: 0, LOWER: 1, HOLD: 2 }

export function sortProducts(products: Product[], mode: ProductSort): Product[] {
  const arr = [...products]
  if (mode === 'name') {
    return arr.sort((a, b) => a.title.localeCompare(b.title))
  }
  if (mode === 'updated') {
    return arr.sort((a, b) =>
      (b.latest_signal?.created_at ?? '').localeCompare(a.latest_signal?.created_at ?? ''))
  }
  // signals-first: RAISE, LOWER, HOLD, then none; ties by confidence desc
  return arr.sort((a, b) => {
    const ra = a.latest_signal ? SIGNAL_RANK[a.latest_signal.type] : 99
    const rb = b.latest_signal ? SIGNAL_RANK[b.latest_signal.type] : 99
    if (ra !== rb) return ra - rb
    return (b.latest_signal?.confidence ?? 0) - (a.latest_signal?.confidence ?? 0)
  })
}
```

`specter-web/lib/dashboard/group-by-domain.ts`:

```ts
import type { Product } from '@/lib/api'

export type DomainHealth = 'healthy' | 'degraded' | 'blocked'

export interface DomainPairing {
  productId: string
  productTitle: string
  trackingId: string
  url: string
  latestPrice: number | null
  inStock: boolean | null
  lastCheckedAt: string | null
  robotsBlocked: boolean
  silencedOos: boolean
}

export interface DomainGroup {
  domain: string
  productCount: number
  inStock: number
  oos: number
  avgPriceGap: number | null   // mean (competitor - your) / your ; null if no priced pairings
  health: DomainHealth
  lastCheckedAt: string | null // newest across pairings
  pairings: DomainPairing[]
}

export function groupByDomain(products: Product[]): DomainGroup[] {
  const map = new Map<string, DomainPairing[]>()
  const gapByDomain = new Map<string, number[]>()

  for (const prod of products) {
    for (const c of prod.competitors) {
      if (!c.domain) continue
      const list = map.get(c.domain) ?? []
      list.push({
        productId: prod.id, productTitle: prod.title, trackingId: c.tracking_id,
        url: c.url, latestPrice: c.latest_price, inStock: c.in_stock,
        lastCheckedAt: c.last_checked_at, robotsBlocked: c.robots_blocked,
        silencedOos: c.silenced_oos,
      })
      map.set(c.domain, list)
      if (c.latest_price != null && prod.current_price != null && prod.current_price > 0) {
        const gaps = gapByDomain.get(c.domain) ?? []
        gaps.push((c.latest_price - prod.current_price) / prod.current_price)
        gapByDomain.set(c.domain, gaps)
      }
    }
  }

  const groups: DomainGroup[] = []
  for (const [domain, pairings] of map) {
    const gaps = gapByDomain.get(domain) ?? []
    const avgPriceGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
    const inStock = pairings.filter(p => p.inStock === true).length
    const oos = pairings.filter(p => p.inStock === false).length
    const blocked = pairings.some(p => p.robotsBlocked)
    const allMissing = pairings.every(p => p.latestPrice == null)
    const lastCheckedAt = pairings
      .map(p => p.lastCheckedAt).filter(Boolean)
      .sort().reverse()[0] ?? null
    const health: DomainHealth = blocked ? 'blocked' : allMissing ? 'degraded' : 'healthy'
    groups.push({ domain, productCount: pairings.length, inStock, oos, avgPriceGap, health, lastCheckedAt, pairings })
  }
  return groups
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test -- group-by-domain sort-products`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add specter-web/lib/dashboard/group-by-domain.ts specter-web/lib/dashboard/group-by-domain.test.ts specter-web/lib/dashboard/sort-products.ts specter-web/lib/dashboard/sort-products.test.ts
git commit -m "feat(web): group-by-domain + sort-products pure helpers (tested)"
```

---

# PHASE C — Products tab

### Task C1: Nav entry + SKU meter + page scaffold

**Files:**

- Modify: `specter-web/app/(dashboard)/layout.tsx`
- Create: `specter-web/components/dashboard/sku-meter.tsx`
- Create: `specter-web/app/(dashboard)/products/page.tsx`

- [ ] **Step 1: Add the Products nav item below Competitors**

In `layout.tsx`, import `Boxes` from `lucide-react` and insert into `NAV` immediately after the Competitors entry:

```tsx
  { href: '/competitors', label: 'Competitors', icon: Globe },
  { href: '/products', label: 'Products', icon: Boxes },
  { href: '/alerts', label: 'Alerts', icon: BellRing },
```

- [ ] **Step 2: Create `sku-meter.tsx`**

```tsx
'use client'

import { cn } from '@/lib/utils'

export default function SkuMeter({
  used, limit, maxCompetitors,
}: { used: number; limit: number | null; maxCompetitors: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const tone = limit && used >= limit ? 'bg-rose-400' : pct >= 80 ? 'bg-amber-400' : 'bg-primary'
  return (
    <div className="flex flex-col gap-1 min-w-48">
      <div className="flex items-center justify-between font-mono text-xs text-muted">
        <span>SKUs {used}{limit != null ? ` / ${limit}` : ''}</span>
        {maxCompetitors != null && <span>up to {maxCompetitors} / product</span>}
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${limit ? pct : 4}%` }} />
      </div>
      <p className="font-body text-[11px] text-muted">1 SKU = one product tracked against one competitor.</p>
    </div>
  )
}
```

- [ ] **Step 3: Create the page scaffold (loading/empty/error + meter)**

`specter-web/app/(dashboard)/products/page.tsx`:

```tsx
'use client'

import { Boxes } from 'lucide-react'
import { useProducts } from '@/lib/api'
import SkuMeter from '@/components/dashboard/sku-meter'
import EmptyState from '@/components/dashboard/empty-state'

export default function ProductsPage() {
  const { data, isLoading, error } = useProducts()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Products</h1>
          <p className="font-body text-sm text-muted mt-1">
            Add a product, link the competitors you want to track, and watch its signal.
          </p>
        </div>
        {data && (
          <SkuMeter used={data.sku_used} limit={data.sku_limit} maxCompetitors={data.max_competitors_per_sku} />
        )}
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 font-body text-sm text-rose-300">
          Couldn’t load products. Refresh to try again.
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No products yet"
          description="Add a product manually, or connect your store in Settings to import them — then link competitors to start getting signals."
        />
      ) : (
        <ProductList />
      )}
    </div>
  )
}

function ProductList() {
  return null // replaced in Task C2
}
```

- [ ] **Step 4: Verify + commit**

Run: `npm run build` → compiles. Manual: `/products` shows header + meter + empty state.

```bash
git add specter-web/app/(dashboard)/layout.tsx specter-web/components/dashboard/sku-meter.tsx specter-web/app/(dashboard)/products/page.tsx
git commit -m "feat(dashboard): Products nav tab, SKU meter, page scaffold"
```

### Task C2: Product rows (collapsed/expanded) + search + sort

**Files:**

- Create: `specter-web/components/dashboard/product-search-sort.tsx`
- Create: `specter-web/components/dashboard/product-row.tsx`
- Modify: `specter-web/app/(dashboard)/products/page.tsx`

- [ ] **Step 1: Create `product-search-sort.tsx`**

```tsx
'use client'

import { Search } from 'lucide-react'
import type { ProductSort } from '@/lib/dashboard/sort-products'

export default function ProductSearchSort({
  query, onQuery, sort, onSort,
}: { query: string; onQuery: (v: string) => void; sort: ProductSort; onSort: (s: ProductSort) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="relative flex-1 min-w-48 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>
      <label className="flex items-center gap-2 font-mono text-xs text-muted">
        Sort:
        <select
          value={sort}
          onChange={e => onSort(e.target.value as ProductSort)}
          className="bg-surface border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-primary/60"
        >
          <option value="signals">Signals first</option>
          <option value="updated">Recently updated</option>
          <option value="name">Name A–Z</option>
        </select>
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Create `product-row.tsx`** (collapsed summary + expand; competitor list rendered here, with placeholders for the inline-link form and kebab added in C3)

```tsx
'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Product } from '@/lib/api'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/time-ago'

const SIGNAL_TONE: Record<string, string> = {
  RAISE: 'text-emerald-400', LOWER: 'text-rose-400', HOLD: 'text-amber-400',
}

export default function ProductRow({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const sig = product.latest_signal
  const price = product.current_price != null ? `$${product.current_price.toFixed(2)}` : '—'

  return (
    <li className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-border/20 transition-colors"
        aria-expanded={open}
      >
        <ChevronRight size={15} className={cn('text-muted transition-transform shrink-0', open && 'rotate-90')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-body text-sm text-text truncate">{product.title}</span>
            <span className="font-mono text-[10px] text-muted/70 border border-border rounded px-1.5 py-0.5 shrink-0">
              {product.source}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
            <span className="text-muted">{price}</span>
            {sig && (
              <span className={cn('font-semibold', SIGNAL_TONE[sig.type])}>
                {sig.type}
                {sig.price_suggestion != null && ` → $${sig.price_suggestion.toFixed(2)}`}
                {` (${Math.round(sig.confidence * 100)}%)`}
              </span>
            )}
            {sig && <span className="text-muted/70">· updated {timeAgo(sig.created_at)}</span>}
            {!sig && <span className="text-muted/70">· awaiting first signal</span>}
          </div>
        </div>
        <span className="font-mono text-xs text-muted shrink-0">{product.competitor_count} competitors</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
          {product.competitors.length === 0 && (
            <p className="font-body text-xs text-muted">No competitors linked yet.</p>
          )}
          {product.competitors.map(c => (
            <div key={c.tracking_id} className="flex items-center gap-3 font-mono text-xs">
              <span className="text-text truncate flex-1">{c.domain}</span>
              <span className="text-muted w-16 text-right">
                {c.latest_price != null ? `$${c.latest_price.toFixed(2)}` : '—'}
              </span>
              <span className={cn('w-16 text-right', c.in_stock === false ? 'text-rose-400' : c.in_stock ? 'text-emerald-400' : 'text-muted/60')}>
                {c.in_stock == null ? 'checking…' : c.in_stock ? 'in-stock' : 'OOS'}
              </span>
              <span className="text-muted/70 w-16 text-right">{c.last_checked_at ? timeAgo(c.last_checked_at) : '—'}</span>
              {/* kebab menu added in Task C3 */}
            </div>
          ))}
          {/* inline link form + floor/ceiling edit added in Task C3 */}
        </div>
      )}
    </li>
  )
}
```

> Verify `lib/time-ago.ts` exports `timeAgo(iso: string): string`. It survived the reset as an untracked util; if its export name differs, adapt the import. If it is missing, create it: `export function timeAgo(iso: string){ const s=(Date.now()-Date.parse(iso))/1000; if(s<60)return 'just now'; if(s<3600)return `${Math.floor(s/60)}m ago`; if(s<86400)return `${Math.floor(s/3600)}h ago `; return `${Math.floor(s/86400)}d ago ` }`.

- [ ] **Step 3: Wire list + search/sort into the page**

Replace the `ProductList` stub in `products/page.tsx`. Add imports and lift state into `ProductsPage`:

```tsx
import { useMemo, useState } from 'react'
import ProductSearchSort from '@/components/dashboard/product-search-sort'
import ProductRow from '@/components/dashboard/product-row'
import { sortProducts, type ProductSort } from '@/lib/dashboard/sort-products'
```

Inside `ProductsPage`, after the hook:

```tsx
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ProductSort>('signals')
  const visible = useMemo(() => {
    const items = data?.items ?? []
    const filtered = query.trim()
      ? items.filter(p => p.title.toLowerCase().includes(query.trim().toLowerCase()))
      : items
    return sortProducts(filtered, sort)
  }, [data, query, sort])
```

Replace the `<ProductList />` branch with:

```tsx
      ) : (
        <>
          <ProductSearchSort query={query} onQuery={setQuery} sort={sort} onSort={setSort} />
          <ul className="flex flex-col gap-2">
            {visible.map(p => <ProductRow key={p.id} product={p} />)}
          </ul>
        </>
      )}
```

Remove the now-unused `ProductList` stub.

- [ ] **Step 4: Verify + commit**

Run: `npm run build` → compiles. Manual: rows render, search filters, sort reorders (signals first).

```bash
git add specter-web/components/dashboard/product-search-sort.tsx specter-web/components/dashboard/product-row.tsx specter-web/app/(dashboard)/products/page.tsx
git commit -m "feat(dashboard): product rows with confidence, signal age, search, sort"
```

### Task C3: Manual add, inline competitor link, kebab actions, floor/ceiling edit, at-limit states

**Files:**

- Create: `specter-web/components/dashboard/add-product-form.tsx`
- Create: `specter-web/components/dashboard/link-competitor-inline.tsx`
- Create: `specter-web/components/dashboard/competitor-row-menu.tsx`
- Modify: `specter-web/lib/api.ts` (add `useCreateProduct` re-export + competitor mutations already exist)
- Modify: `specter-web/components/dashboard/product-row.tsx`
- Modify: `specter-web/app/(dashboard)/products/page.tsx`

- [ ] **Step 1: Confirm/extend mutation hooks in `lib/api.ts`**

`useCreateSKU`, `useAddCompetitor`, `useDeleteCompetitor`, `useSilenceOOS`, `useUpdateSKU` already exist. After each succeeds, also invalidate the products query so the workspace refreshes. In each of those hooks' `onSuccess`, add:

```ts
      qc.invalidateQueries({ queryKey: queryKeys.products })
```

(Leave their existing invalidations intact.)

- [ ] **Step 2: Create `competitor-row-menu.tsx`** (kebab → silence / remove)

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical } from 'lucide-react'
import { useSilenceOOS, useDeleteCompetitor } from '@/lib/api'

export default function CompetitorRowMenu({ trackingId, silenced }: { trackingId: string; silenced: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const silence = useSilenceOOS()
  const remove = useDeleteCompetitor()

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(o => !o)} aria-label="Competitor actions" className="p-1 rounded text-muted hover:text-text hover:bg-border/40">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 w-48 bg-surface border border-border rounded-lg shadow-xl py-1">
          <button
            onClick={() => { silence.mutate({ trackingId, silenced: !silenced }); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 font-body text-xs text-text hover:bg-border/40"
          >
            {silenced ? 'Unsilence OOS alerts' : 'Silence OOS alerts'}
          </button>
          <button
            onClick={() => { remove.mutate(trackingId); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 font-body text-xs text-rose-400 hover:bg-rose-400/10"
          >
            Remove competitor
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `link-competitor-inline.tsx`** (per-product add; handles 402/409/422 inline)

```tsx
'use client'

import { useState } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { useAddCompetitor, ApiError } from '@/lib/api'

export default function LinkCompetitorInline({ productId, atProductLimit }: { productId: string; atProductLimit: boolean }) {
  const add = useAddCompetitor()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (atProductLimit) {
    return <p className="font-body text-xs text-muted">Max competitors reached on your plan — <a href="/pricing" className="text-primary hover:underline">upgrade for more</a>.</p>
  }

  async function submit() {
    setErr(null)
    try {
      await add.mutateAsync({ url: url.trim(), own_product_id: productId })
      setUrl(''); setOpen(false)
    } catch (e) {
      if (e instanceof ApiError) {
        const b = e.body
        setErr(
          b?.error === 'sku_limit_reached' ? `SKU limit reached (${b.used}/${b.limit}). Upgrade to track more.`
          : b?.error === 'competitor_limit_reached' ? `Max ${b.limit} competitors for this product on your plan.`
          : b?.error === 'already_tracking' ? 'This URL is already tracked for this product.'
          : b?.error === 'url_unreachable' ? 'Could not reach that URL — make sure it is public.'
          : b?.message ?? 'Could not link competitor.')
      } else setErr('Could not link competitor.')
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 w-fit">
        <Plus size={12} /> link a competitor
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          autoFocus value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="https://competitor.com/products/their-product"
          className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 font-body text-xs text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60"
        />
        <button onClick={submit} disabled={add.isPending || !url.trim()} className="gradient-primary-cta px-3 rounded-lg font-semibold text-xs disabled:opacity-40">
          {add.isPending ? 'Linking…' : 'Link'}
        </button>
      </div>
      {err && <p className="flex items-center gap-1.5 font-body text-xs text-rose-400"><AlertTriangle size={12} /> {err}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Create `add-product-form.tsx`** (manual product)

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCreateSKU } from '@/lib/api'

export default function AddProductForm() {
  const create = useCreateSKU()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')

  async function submit() {
    if (!title.trim()) return
    await create.mutateAsync({ title: title.trim(), current_price: price || undefined })
    setTitle(''); setPrice(''); setOpen(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="gradient-primary-cta btn-ripple flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm w-fit">
        <Plus size={15} /> Add product
      </button>
    )
  }
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-2">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Product title"
          className="bg-bg border border-border rounded-lg px-3 py-2 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60" />
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" step="0.01" min="0"
          className="bg-bg border border-border rounded-lg px-3 py-2 font-mono text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60" />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={create.isPending || !title.trim()} className="gradient-primary-cta px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40">
          {create.isPending ? 'Adding…' : 'Add'}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg font-body text-sm text-muted hover:text-text">Cancel</button>
      </div>
    </div>
  )
}
```

> `useCreateSKU` input type is `CreateSKUInput { title; handle?; current_price?: string; shopify_variant_id? }`. `current_price` is a string — pass `price || undefined`.

- [ ] **Step 5: Wire menu + inline link + per-product limit into `product-row.tsx`**

Add imports at the top of `product-row.tsx`:

```tsx
import CompetitorRowMenu from '@/components/dashboard/competitor-row-menu'
import LinkCompetitorInline from '@/components/dashboard/link-competitor-inline'
```

Add a prop `maxCompetitors: number | null` to `ProductRow({ product, maxCompetitors })`. In the competitor row, replace the `{/* kebab menu added in Task C3 */}` comment with:

```tsx
              <CompetitorRowMenu trackingId={c.tracking_id} silenced={c.silenced_oos} />
```

Replace the `{/* inline link form ... */}` comment with:

```tsx
          <div className="pt-1">
            <LinkCompetitorInline
              productId={product.id}
              atProductLimit={maxCompetitors != null && product.competitor_count >= maxCompetitors}
            />
          </div>
```

- [ ] **Step 6: Wire add-product + at-limit into the page**

In `products/page.tsx`: import `AddProductForm`. Render it above the list (and in the empty state). Pass `maxCompetitors={data.max_competitors_per_sku}` to each `<ProductRow>`. Gate global add when at SKU limit:

```tsx
import AddProductForm from '@/components/dashboard/add-product-form'
...
const atSkuLimit = data?.sku_limit != null && data.sku_used >= data.sku_limit
...
{/* above the list */}
{atSkuLimit ? (
  <a href="/pricing" className="font-body text-sm text-amber-400 hover:underline w-fit">SKU limit reached — upgrade to track more →</a>
) : (
  <AddProductForm />
)}
...
{visible.map(p => <ProductRow key={p.id} product={p} maxCompetitors={data!.max_competitors_per_sku} />)}
```

- [ ] **Step 7: Verify + commit**

Run: `npm run build` → compiles. Manual: add a manual product; expand it; link a competitor (or see inline 402/409/422); kebab silence/remove works; at-limit shows upgrade.

```bash
git add specter-web/components/dashboard/add-product-form.tsx specter-web/components/dashboard/link-competitor-inline.tsx specter-web/components/dashboard/competitor-row-menu.tsx specter-web/components/dashboard/product-row.tsx specter-web/app/(dashboard)/products/page.tsx specter-web/lib/api.ts
git commit -m "feat(dashboard): manual add, inline competitor link, kebab actions, at-limit states"
```

### Task C4: Floor/ceiling edit + mobile cards

**Files:**

- Modify: `specter-web/components/dashboard/product-row.tsx`

- [ ] **Step 1: Add a floor/ceiling editor row** (uses existing `useUpdateSKU`)

In `product-row.tsx`, import `useUpdateSKU` and add an editable guardrails line inside the expanded panel (below the inline link). Show current floor/ceiling with an inline edit toggling two number inputs that `PATCH /skus/{id}` via `useUpdateSKU.mutate({ id, floor_price, ceiling_price })`, plus a muted note linking to `/repricing` for auto-reprice:

```tsx
          <div className="pt-2 mt-1 border-t border-border/50 flex items-center justify-between gap-3 font-mono text-xs">
            <span className="text-muted">
              floor {product.floor_price != null ? `$${product.floor_price}` : '—'} · ceiling {product.ceiling_price != null ? `$${product.ceiling_price}` : '—'}
            </span>
            <a href="/repricing" className="text-primary hover:underline">Auto-reprice →</a>
          </div>
```

(Full inline editing of floor/ceiling reuses the existing `/repricing` SKU editor; on the Products page we display the guardrails and deep-link to Repricing for changes — keeping the auto-reprice subsystem in one place per the spec. Editable inputs here are optional polish and may be deferred.)

- [ ] **Step 2: Make the expanded competitor list responsive**

Wrap each competitor row's columns so they stack under `sm`: change the competitor row container to `className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 font-mono text-xs"` and let the price/stock/age spans sit on a second line on mobile. The product summary button already wraps. Verify at a 375px viewport that rows read as stacked cards.

- [ ] **Step 3: Verify + commit**

Run: `npm run build` → compiles. Manual (devtools 375px): rows render as stacked cards; guardrails + Auto-reprice link show.

```bash
git add specter-web/components/dashboard/product-row.tsx
git commit -m "feat(dashboard): product guardrails display + mobile-responsive rows"
```

---

# PHASE D — Competitors tab → by-domain lens

### Task D1: Refactor Competitors page to pivot `/products` by domain

**Files:**

- Create: `specter-web/components/dashboard/competitor-domain-group.tsx`
- Modify: `specter-web/app/(dashboard)/competitors/page.tsx`

- [ ] **Step 1: Create `competitor-domain-group.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { DomainGroup } from '@/lib/dashboard/group-by-domain'
import CompetitorRowMenu from '@/components/dashboard/competitor-row-menu'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'

const HEALTH = {
  healthy:  { label: '● Healthy',  cls: 'text-emerald-400' },
  degraded: { label: '◐ Degraded', cls: 'text-amber-400' },
  blocked:  { label: '⚠ Blocked',  cls: 'text-rose-400' },
} as const

export default function CompetitorDomainGroup({ group }: { group: DomainGroup }) {
  const [open, setOpen] = useState(false)
  const h = HEALTH[group.health]
  const gap = group.avgPriceGap == null ? null : `${group.avgPriceGap > 0 ? '+' : ''}${(group.avgPriceGap * 100).toFixed(0)}%`
  return (
    <li className="bg-surface border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-border/20" aria-expanded={open}>
        <ChevronRight size={15} className={cn('text-muted transition-transform shrink-0', open && 'rotate-90')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <span className="font-body text-sm text-text">{group.domain}</span>
          <div className="flex items-center gap-2 mt-0.5 font-mono text-xs flex-wrap">
            <span className="text-muted">{group.productCount} products</span>
            {gap && <span className="text-muted">· avg gap {gap}</span>}
            {group.health !== 'blocked' && <span className="text-muted">· {group.inStock} in-stock / {group.oos} OOS</span>}
            <span className={h.cls}>· {h.label}</span>
            {group.lastCheckedAt && <span className="text-muted/70">· {timeAgo(group.lastCheckedAt)}</span>}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
          {group.health === 'blocked' && (
            <p className="font-body text-xs text-rose-400">robots.txt disallows automated tracking for this domain.</p>
          )}
          {group.pairings.map(p => (
            <div key={p.trackingId} className="flex items-center gap-3 font-mono text-xs">
              <span className="text-text truncate flex-1">{p.productTitle}</span>
              <span className="text-muted w-16 text-right">{p.latestPrice != null ? `$${p.latestPrice.toFixed(2)}` : '—'}</span>
              <span className={cn('w-16 text-right', p.inStock === false ? 'text-rose-400' : p.inStock ? 'text-emerald-400' : 'text-muted/60')}>
                {p.inStock == null ? 'checking…' : p.inStock ? 'in-stock' : 'OOS'}
              </span>
              <span className="text-muted/70 w-16 text-right">{p.lastCheckedAt ? timeAgo(p.lastCheckedAt) : '—'}</span>
              <CompetitorRowMenu trackingId={p.trackingId} silenced={p.silencedOos} />
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
```

- [ ] **Step 2: Rewrite `competitors/page.tsx` as the by-domain lens**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Globe, Search } from 'lucide-react'
import Link from 'next/link'
import { useProducts } from '@/lib/api'
import { groupByDomain, type DomainGroup } from '@/lib/dashboard/group-by-domain'
import CompetitorDomainGroup from '@/components/dashboard/competitor-domain-group'
import EmptyState from '@/components/dashboard/empty-state'

type DomainSort = 'products' | 'oos' | 'name'

export default function CompetitorsPage() {
  const { data, isLoading, error } = useProducts()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<DomainSort>('products')

  const groups = useMemo<DomainGroup[]>(() => {
    let g = groupByDomain(data?.items ?? [])
    if (query.trim()) g = g.filter(x => x.domain.includes(query.trim().toLowerCase()))
    return g.sort((a, b) =>
      sort === 'name' ? a.domain.localeCompare(b.domain)
      : sort === 'oos' ? b.oos - a.oos
      : b.productCount - a.productCount)
  }, [data, query, sort])

  const rivals = groups.length
  const skus = (data?.items ?? []).reduce((n, p) => n + p.competitor_count, 0)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">Competitors</h1>
        <p className="font-body text-sm text-muted mt-1">
          Your rivals, grouped by domain. Link competitors from the{' '}
          <Link href="/products" className="text-primary hover:underline">Products page →</Link>
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-2">{[0,1,2].map(i => <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 font-body text-sm text-rose-300">Couldn’t load competitors. Refresh to try again.</div>
      ) : groups.length === 0 ? (
        <EmptyState icon={Globe} title="No competitors tracked yet" description="Go to the Products page, pick a product, and link a competitor URL to start monitoring." />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-mono text-xs text-muted">tracking {rivals} rivals across {skus} SKUs</p>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search domains…"
                  className="bg-bg border border-border rounded-xl pl-9 pr-3 py-2 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60" />
              </div>
              <label className="flex items-center gap-2 font-mono text-xs text-muted">
                Sort:
                <select value={sort} onChange={e => setSort(e.target.value as DomainSort)} className="bg-surface border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-primary/60">
                  <option value="products">Most products</option>
                  <option value="oos">Most OOS</option>
                  <option value="name">Domain A–Z</option>
                </select>
              </label>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {groups.map(g => <CompetitorDomainGroup key={g.domain} group={g} />)}
          </ul>
        </>
      )}
    </div>
  )
}
```

> This removes the old flat-list add form. Adding competitors now lives on Products (Task C3). The `useCompetitors`/`useSKUs`/`useAddCompetitor` imports the old page used are no longer needed here.

- [ ] **Step 3: Verify + commit**

Run: `npm run build` → compiles. Manual: Competitors page shows domain groups with health + avg gap; expand lists products; kebab silence/remove updates both tabs (shared cache).

```bash
git add specter-web/components/dashboard/competitor-domain-group.tsx specter-web/app/(dashboard)/competitors/page.tsx
git commit -m "feat(dashboard): refactor Competitors into by-domain lens over /products"
```

---

# PHASE E — SKU-definition consistency

### Task E1: Overview usage card uses the SKU meter

**Files:**

- Modify: `specter-web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1:** Read the current Overview page. Add (or update) a usage card that renders `<SkuMeter used={...} limit={...} maxCompetitors={...} />` from `useProducts()` data, so the Overview states the SKU definition identically. Keep existing content; this is additive.
- [ ] **Step 2:** `npm run build` → compiles. Commit:

```bash
git add specter-web/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): Overview shows SKU usage meter (consistent definition)"
```

### Task E2: Pricing page SKU tooltip *(depends on Timeline restore of `pricing-section.tsx`)*

**Files:**

- Modify: `specter-web/components/marketing/pricing-section.tsx`

- [ ] **Step 1:** Confirm `components/marketing/pricing-section.tsx` is restored from Timeline (it was reverted by the earlier reset). If not restored, STOP and flag — do not recreate it from scratch.
- [ ] **Step 2:** Add a footnote/tooltip near each tier's SKU number: *"A SKU = one product tracked against one competitor. RECON = 100 SKUs (e.g. 33 products × 3 competitors)."* Match the existing pricing-card markup/styling.
- [ ] **Step 3:** `npm run build` → compiles. Commit:

```bash
git add specter-web/components/marketing/pricing-section.tsx
git commit -m "docs(pricing): clarify SKU = product×competitor on pricing cards"
```

### Task E3: Reconcile docs

**Files:**

- Modify: `docs/PRICING.md`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md`

- [ ] **Step 1:** Verify each doc states "1 SKU = one product tracked against one competitor; limit counts enabled (product×competitor) trackings." `ARCHITECTURE.md` already documents this — confirm and align `PRICING.md` + `FEATURES.md` wording (replace any "products" phrasing of the limit with "SKUs (product×competitor pairings)"). Add the Products tab + `GET /products` to ARCHITECTURE.md's surface list.
- [ ] **Step 2:** Commit (docs live in the outer repo at git root `C:/Users/manoj`, on branch `docs/plg-free-tools-redesign`):

```bash
git add docs/PRICING.md docs/ARCHITECTURE.md docs/FEATURES.md
git commit -m "docs: reconcile SKU = product×competitor definition + Products workspace"
```

---

## Final Verification

- [ ] Backend: `cd specter-api && python -m pytest -q` → all green (existing + new `test_products.py`).
- [ ] Frontend: `cd specter-web && npm test` → all Vitest helpers pass; `npm run lint && npm run build` → exit 0 (**requires `.eslintrc.json` restored**).
- [ ] Manual (`npm run dev`, both servers): `/products` add/link/expand/sort/search/kebab/at-limit; `/competitors` domain groups + health + avg gap; silence/remove reflects across both tabs.
- [ ] Final code-reviewer pass over the branch, then `superpowers:finishing-a-development-branch`.

## Self-Review (spec coverage)

| Spec section                                                                                                                                      | Task(s)                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| §1 architecture (one `GET /products`, two lenses, shared cache)                                                                                | A1–A2, B1, D1                     |
| §2 no schema /`source` derived / `collection_id` deferred                                                                                    | A1 (derivation), A2 (no migration) |
| §3 API (`GET /products` shape; reused mutations)                                                                                               | A1–A2, C3                         |
| §4 Products tab (meters, search, signals-first sort, confidence, signal age, rows, manual add, inline link, kebab, at-limit, mobile, guardrails) | C1–C4                             |
| §5 Competitors by-domain (pivot, health, avg gap, summary metrics, search/sort, kebab, no add form)                                              | B2, D1                             |
| §6 plan limits + SKU consistency (meter, Overview, pricing, docs)                                                                                | C1, E1–E3                         |
| §7 error/edge (402/409/422, checking…, awaiting signal, blocked)                                                                                | A1, C2, C3, D1                     |
| §8 testing (backend pytest; frontend pure helpers only)                                                                                          | A1–A2, B2                         |

**Known dependencies (flagged, not gaps):** `.eslintrc.json` restore (lint/build gate); `pricing-section.tsx` restore (Task E2). Both from the earlier `git reset`, tracked in the recovery conversation.

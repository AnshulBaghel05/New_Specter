# Action / Deep-link Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dashboard signals/alerts actionable via "Review & act" deep-links into the Repricing guardrail editor, and move every dashboard page's view-state (filters/search/pagination/selection) into the URL so it is shareable and durable.

**Architecture:** One reusable client hook (`useQueryParams`) reads/merge-writes URL search params (the single source of cross-page truth). Pure helpers build deep-link hrefs, parse params, and decide the Repricing prefill/landing-toast. Source pages emit `<Link>`s; the Repricing page consumes `?sku`/`?source` (scroll + highlight + focus + prefill + landing toast, then strips the params). A single `<Suspense>` boundary in the dashboard layout satisfies `useSearchParams`.

**Tech Stack:** Next.js 14 App Router (`useSearchParams`/`usePathname`/`useRouter`), TypeScript, TanStack Query v5, Sonner (via `@/lib/toast`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-02-action-deeplink-layer-design.md`

**Conventions for every task:**
- All code paths are relative to `specter-web/`. Run all `git`/`npm` commands **from inside `specter-web/`** (it is its own git repo, branch `main`).
- Implementation happens on a **new branch off `main`** named `action-deeplink-layer` (create it before Task 1 if not already on it).
- Stage only the exact paths listed (NEVER `git add .` / `git add -A`).
- End every commit message with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- Preview mode (`NEXT_PUBLIC_PREVIEW=1`) is active locally; `lib/api.ts` hooks return fixtures. Do not modify preview wiring.

---

### Task 0: Create the branch

- [ ] **Step 1: Branch off main**

Run (from `specter-web/`):
```bash
git checkout main
git checkout -b action-deeplink-layer
```
Expected: `Switched to a new branch 'action-deeplink-layer'`.

---

### Task 1: Pure deep-link builder (`deep-links.ts`)

**Files:**
- Create: `lib/dashboard/deep-links.ts`
- Test: `lib/dashboard/deep-links.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/deep-links.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { repricingHref } from './deep-links'

describe('repricingHref', () => {
  it('builds a sku-only href when no source given', () => {
    expect(repricingHref('sku_123')).toBe('/repricing?sku=sku_123')
  })

  it('appends the source when provided', () => {
    expect(repricingHref('sku_123', 'signals')).toBe('/repricing?sku=sku_123&source=signals')
  })

  it('url-encodes the sku id', () => {
    expect(repricingHref('a b/c')).toBe('/repricing?sku=a%20b%2Fc')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/deep-links.test.ts`
Expected: FAIL — cannot resolve `./deep-links`.

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard/deep-links.ts`:

```ts
// Pure builders for dashboard deep-links.
// ActionSource is the canonical "where did this action originate" tag,
// shared with url-params.ts (parseSource).

export type ActionSource = 'overview' | 'signals' | 'alerts'

export function repricingHref(skuId: string, source?: ActionSource): string {
  const base = `/repricing?sku=${encodeURIComponent(skuId)}`
  return source ? `${base}&source=${encodeURIComponent(source)}` : base
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/deep-links.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/deep-links.ts lib/dashboard/deep-links.test.ts
git commit -m "feat(deeplink): pure repricingHref builder + ActionSource

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Pure URL-param parsers (`url-params.ts`)

**Files:**
- Create: `lib/dashboard/url-params.ts`
- Test: `lib/dashboard/url-params.test.ts`

Depends on Task 1 (imports `ActionSource`). `ProductSort` is `'signals' | 'updated' | 'name'` (from `lib/dashboard/sort-products.ts`).

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/url-params.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  parseSignalType,
  parsePage,
  parseAlertStatus,
  parseProductSort,
  parseDomainSort,
  parseDays,
  parseSource,
} from './url-params'

describe('parseSignalType', () => {
  it('accepts valid types', () => {
    expect(parseSignalType('RAISE')).toBe('RAISE')
    expect(parseSignalType('LOWER')).toBe('LOWER')
    expect(parseSignalType('HOLD')).toBe('HOLD')
  })
  it('returns undefined for unknown/null', () => {
    expect(parseSignalType('raise')).toBeUndefined()
    expect(parseSignalType(null)).toBeUndefined()
  })
})

describe('parsePage', () => {
  it('parses non-negative integers', () => {
    expect(parsePage('0')).toBe(0)
    expect(parsePage('3')).toBe(3)
  })
  it('defaults to 0 for invalid/negative/fractional/null', () => {
    expect(parsePage('-1')).toBe(0)
    expect(parsePage('x')).toBe(0)
    expect(parsePage('1.5')).toBe(0)
    expect(parsePage(null)).toBe(0)
  })
})

describe('parseAlertStatus', () => {
  it('accepts active/resolved', () => {
    expect(parseAlertStatus('active')).toBe('active')
    expect(parseAlertStatus('resolved')).toBe('resolved')
  })
  it('returns undefined otherwise', () => {
    expect(parseAlertStatus('all')).toBeUndefined()
    expect(parseAlertStatus(null)).toBeUndefined()
  })
})

describe('parseProductSort', () => {
  it('accepts valid sorts', () => {
    expect(parseProductSort('signals')).toBe('signals')
    expect(parseProductSort('updated')).toBe('updated')
    expect(parseProductSort('name')).toBe('name')
  })
  it('defaults to signals', () => {
    expect(parseProductSort('price')).toBe('signals')
    expect(parseProductSort(null)).toBe('signals')
  })
})

describe('parseDomainSort', () => {
  it('accepts valid sorts', () => {
    expect(parseDomainSort('products')).toBe('products')
    expect(parseDomainSort('oos')).toBe('oos')
    expect(parseDomainSort('name')).toBe('name')
  })
  it('defaults to products', () => {
    expect(parseDomainSort('zzz')).toBe('products')
    expect(parseDomainSort(null)).toBe('products')
  })
})

describe('parseDays', () => {
  it('accepts 7/30/90', () => {
    expect(parseDays('7')).toBe(7)
    expect(parseDays('30')).toBe(30)
    expect(parseDays('90')).toBe(90)
  })
  it('defaults to 30', () => {
    expect(parseDays('45')).toBe(30)
    expect(parseDays(null)).toBe(30)
  })
})

describe('parseSource', () => {
  it('accepts known surfaces', () => {
    expect(parseSource('overview')).toBe('overview')
    expect(parseSource('signals')).toBe('signals')
    expect(parseSource('alerts')).toBe('alerts')
  })
  it('returns null otherwise', () => {
    expect(parseSource('signal')).toBeNull()
    expect(parseSource(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/url-params.test.ts`
Expected: FAIL — cannot resolve `./url-params`.

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard/url-params.ts`:

```ts
// Pure parsers: URL string -> typed dashboard view-state.
// Unknown values coerce to each param's default so a hand-edited URL never crashes.

import type { SignalType } from '@/lib/api'
import type { ProductSort } from '@/lib/dashboard/sort-products'
import type { ActionSource } from '@/lib/dashboard/deep-links'

export type DomainSort = 'products' | 'oos' | 'name'

export function parseSignalType(v: string | null): SignalType | undefined {
  return v === 'RAISE' || v === 'LOWER' || v === 'HOLD' ? v : undefined
}

export function parsePage(v: string | null): number {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

export function parseAlertStatus(v: string | null): 'active' | 'resolved' | undefined {
  return v === 'active' || v === 'resolved' ? v : undefined
}

export function parseProductSort(v: string | null): ProductSort {
  return v === 'signals' || v === 'updated' || v === 'name' ? v : 'signals'
}

export function parseDomainSort(v: string | null): DomainSort {
  return v === 'products' || v === 'oos' || v === 'name' ? v : 'products'
}

export function parseDays(v: string | null): 7 | 30 | 90 {
  const n = Number(v)
  return n === 7 || n === 90 ? n : 30
}

export function parseSource(v: string | null): ActionSource | null {
  return v === 'overview' || v === 'signals' || v === 'alerts' ? v : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/url-params.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/url-params.ts lib/dashboard/url-params.test.ts
git commit -m "feat(deeplink): pure URL-param parsers for dashboard view-state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Pure prefill + landing-toast rule (`reprice-prefill.ts`)

**Files:**
- Create: `lib/dashboard/reprice-prefill.ts`
- Test: `lib/dashboard/reprice-prefill.test.ts`

Uses `RepriceSKU` / `LatestSuggestion` from `lib/api.ts` (already defined there).

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/reprice-prefill.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { repricePrefill, formatLandingToast } from './reprice-prefill'
import type { RepriceSKU } from '@/lib/api'

function makeSku(overrides: Partial<RepriceSKU>): RepriceSKU {
  return {
    id: 'sku_1',
    title: 'Wireless Earbuds',
    current_price: 39.99,
    floor_price: null,
    ceiling_price: null,
    auto_reprice_enabled: false,
    latest_suggestion: null,
    ...overrides,
  }
}

describe('repricePrefill', () => {
  it('RAISE -> ceiling with the suggested price', () => {
    expect(
      repricePrefill(makeSku({ latest_suggestion: { type: 'RAISE', price_suggestion: 42, confidence: 0.9, created_at: '' } })),
    ).toEqual({ bound: 'ceiling', value: '42.00' })
  })
  it('LOWER -> floor with the suggested price', () => {
    expect(
      repricePrefill(makeSku({ latest_suggestion: { type: 'LOWER', price_suggestion: 33.5, confidence: 0.9, created_at: '' } })),
    ).toEqual({ bound: 'floor', value: '33.50' })
  })
  it('HOLD -> no prefill', () => {
    expect(
      repricePrefill(makeSku({ latest_suggestion: { type: 'HOLD', price_suggestion: 40, confidence: 0.9, created_at: '' } })),
    ).toEqual({ bound: null, value: null })
  })
  it('no suggestion -> no prefill', () => {
    expect(repricePrefill(makeSku({ latest_suggestion: null }))).toEqual({ bound: null, value: null })
  })
  it('null price_suggestion -> no prefill', () => {
    expect(
      repricePrefill(makeSku({ latest_suggestion: { type: 'RAISE', price_suggestion: null, confidence: 0.9, created_at: '' } })),
    ).toEqual({ bound: null, value: null })
  })
})

describe('formatLandingToast', () => {
  it('includes the suggested ceiling for a RAISE', () => {
    expect(
      formatLandingToast(makeSku({ latest_suggestion: { type: 'RAISE', price_suggestion: 42, confidence: 0.9, created_at: '' } })),
    ).toEqual({ title: 'Reviewing Wireless Earbuds', description: 'Suggested ceiling: $42.00' })
  })
  it('includes the suggested floor for a LOWER', () => {
    expect(
      formatLandingToast(makeSku({ latest_suggestion: { type: 'LOWER', price_suggestion: 33.5, confidence: 0.9, created_at: '' } })),
    ).toEqual({ title: 'Reviewing Wireless Earbuds', description: 'Suggested floor: $33.50' })
  })
  it('omits description when there is no actionable suggestion', () => {
    expect(formatLandingToast(makeSku({ latest_suggestion: null }))).toEqual({ title: 'Reviewing Wireless Earbuds' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/reprice-prefill.test.ts`
Expected: FAIL — cannot resolve `./reprice-prefill`.

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard/reprice-prefill.ts`:

```ts
// Pure rules for the Repricing deep-link landing: which guardrail bound to
// prefill from the latest suggestion, and the connecting toast copy.

import type { RepriceSKU } from '@/lib/api'

export interface PrefillResult {
  bound: 'floor' | 'ceiling' | null
  value: string | null
}

// RAISE -> ceiling, LOWER -> floor, HOLD / no suggestion -> no prefill.
export function repricePrefill(sku: RepriceSKU): PrefillResult {
  const s = sku.latest_suggestion
  if (!s || s.price_suggestion === null) return { bound: null, value: null }
  if (s.type === 'RAISE') return { bound: 'ceiling', value: s.price_suggestion.toFixed(2) }
  if (s.type === 'LOWER') return { bound: 'floor', value: s.price_suggestion.toFixed(2) }
  return { bound: null, value: null }
}

export interface LandingToast {
  title: string
  description?: string
}

export function formatLandingToast(sku: RepriceSKU): LandingToast {
  const { bound, value } = repricePrefill(sku)
  const title = `Reviewing ${sku.title}`
  if (bound && value) {
    return { title, description: `Suggested ${bound}: $${value}` }
  }
  return { title }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/reprice-prefill.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/reprice-prefill.ts lib/dashboard/reprice-prefill.test.ts
git commit -m "feat(deeplink): pure repricing prefill + landing-toast rules

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `useQueryParams` hook + Suspense boundary

**Files:**
- Create: `lib/dashboard/use-query-params.ts`
- Modify: `app/(dashboard)/layout.tsx`

No unit test (Next-router glue + layout wiring; verified by `tsc` and the final build). The merge-not-replace behavior is exercised by the page tasks and the final smoke.

- [ ] **Step 1: Create the hook**

Create `lib/dashboard/use-query-params.ts`:

```ts
'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Read/merge-write URL search params — the single source of cross-page view-state.
 *
 * `set` always builds from the CURRENT params and mutates only the keys passed,
 * so unrelated params are preserved (e.g. set({ sort }) keeps an existing ?q).
 * Pass a key's value as null/'' to remove it (used for default-omission).
 * Uses router.replace (no history spam, no scroll jump).
 */
export function useQueryParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const get = useCallback((key: string) => searchParams.get(key), [searchParams])

  const set = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k)
        else params.set(k, v)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  return { get, set }
}
```

- [ ] **Step 2: Add the Suspense boundary in the layout**

In `app/(dashboard)/layout.tsx`, add the `Suspense` import. Change:

```tsx
'use client'

import Link from 'next/link'
```

to:

```tsx
'use client'

import { Suspense } from 'react'
import Link from 'next/link'
```

Then wrap `{children}`. Change:

```tsx
      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-8 max-w-6xl">{children}</main>
```

to:

```tsx
      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-8 max-w-6xl">
        <Suspense
          fallback={
            <div className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
          }
        >
          {children}
        </Suspense>
      </main>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/use-query-params.ts "app/(dashboard)/layout.tsx"
git commit -m "feat(deeplink): useQueryParams hook + dashboard Suspense boundary

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Overview — emit deep-links

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add the import**

Add after the existing `import { timeAgo } from '@/lib/time-ago'` line:

```tsx
import { repricingHref } from '@/lib/dashboard/deep-links'
```

- [ ] **Step 2: Add "Review & act" to each signal row**

In the recent-signal feed, change:

```tsx
                <span className="font-body text-xs text-muted shrink-0 w-16 text-right">
                  {timeAgo(sig.created_at)}
                </span>
              </li>
```

to:

```tsx
                <span className="font-body text-xs text-muted shrink-0 w-16 text-right">
                  {timeAgo(sig.created_at)}
                </span>
                <Link
                  href={repricingHref(sig.sku_id, 'overview')}
                  className="font-body text-xs text-primary hover:underline shrink-0 whitespace-nowrap"
                >
                  Review &amp; act →
                </Link>
              </li>
```

(`Link` is already imported in this file.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(deeplink): Review & act link on Overview signal feed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Signals — deep-links + `type`/`page` in URL

**Files:**
- Modify: `app/(dashboard)/signals/page.tsx`

This page is edited once: it gains the deep-link and moves its filter/pagination state to the URL.

- [ ] **Step 1: Swap imports**

Change:

```tsx
import { useState } from 'react'
import { Radio, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useSignals, type SignalType } from '@/lib/api'
import SignalBadge from '@/components/dashboard/signal-badge'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
```

to:

```tsx
import { useEffect } from 'react'
import Link from 'next/link'
import { Radio, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useSignals, type SignalType } from '@/lib/api'
import SignalBadge from '@/components/dashboard/signal-badge'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseSignalType, parsePage } from '@/lib/dashboard/url-params'
import { repricingHref } from '@/lib/dashboard/deep-links'
```

- [ ] **Step 2: Read filter/page from the URL + clamp out-of-range page**

Change:

```tsx
export default function SignalsPage() {
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<SignalType | undefined>(undefined)

  const { data, isLoading } = useSignals({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    type: filter,
  })

  const signals = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
```

to:

```tsx
export default function SignalsPage() {
  const { get, set } = useQueryParams()
  const filter = parseSignalType(get('type'))
  const page = parsePage(get('page'))

  const { data, isLoading } = useSignals({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    type: filter,
  })

  const signals = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // If a deep-linked / hand-edited page is past the end, clamp it once data loads.
  useEffect(() => {
    if (data && page > totalPages - 1) {
      const last = totalPages - 1
      set({ page: last > 0 ? String(last) : null })
    }
  }, [data, page, totalPages, set])
```

- [ ] **Step 3: Filter tabs write to the URL**

Change:

```tsx
            onClick={() => {
              setFilter(f.value)
              setPage(0)
            }}
```

to:

```tsx
            onClick={() => set({ type: f.value ?? null, page: null })}
```

- [ ] **Step 4: Add the deep-link to each signal row**

Change:

```tsx
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-mono text-xs text-text tabular-nums">
                    {Math.round(sig.confidence * 100)}% conf.
                  </span>
                  <span className="font-body text-xs text-muted">{timeAgo(sig.created_at)}</span>
                </div>
              </li>
```

to:

```tsx
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-mono text-xs text-text tabular-nums">
                    {Math.round(sig.confidence * 100)}% conf.
                  </span>
                  <span className="font-body text-xs text-muted">{timeAgo(sig.created_at)}</span>
                </div>
                <Link
                  href={repricingHref(sig.sku_id, 'signals')}
                  className="font-body text-xs text-primary hover:underline shrink-0 self-center whitespace-nowrap"
                >
                  Review &amp; act →
                </Link>
              </li>
```

- [ ] **Step 5: Pagination buttons write to the URL**

Change:

```tsx
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
```

to:

```tsx
              <button
                onClick={() => set({ page: page > 1 ? String(page - 1) : null })}
                disabled={page === 0}
```

Change:

```tsx
              <button
                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                disabled={page + 1 >= totalPages}
```

to:

```tsx
              <button
                onClick={() => set({ page: String(page + 1) })}
                disabled={page + 1 >= totalPages}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/signals/page.tsx"
git commit -m "feat(deeplink): Signals deep-link + type/page in URL

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Alerts — deep-links + `status` in URL

**Files:**
- Modify: `app/(dashboard)/alerts/page.tsx`

- [ ] **Step 1: Swap imports**

Change:

```tsx
import { useState } from 'react'
import { BellRing, BellOff, Bell, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAlerts, useSilenceAlert } from '@/lib/api'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
```

to:

```tsx
import Link from 'next/link'
import { BellRing, BellOff, Bell, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAlerts, useSilenceAlert } from '@/lib/api'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseAlertStatus } from '@/lib/dashboard/url-params'
import { repricingHref } from '@/lib/dashboard/deep-links'
```

(The `useState` import is removed — this page no longer uses local state. `toast` is already imported from sub-project A.)

- [ ] **Step 2: Read status from the URL**

Change:

```tsx
export default function AlertsPage() {
  const [filter, setFilter] = useState<'active' | 'resolved' | undefined>(undefined)
  const { data, isLoading } = useAlerts(filter)
```

to:

```tsx
export default function AlertsPage() {
  const { get, set } = useQueryParams()
  const filter = parseAlertStatus(get('status'))
  const { data, isLoading } = useAlerts(filter)
```

- [ ] **Step 3: Filter tabs write to the URL**

Change:

```tsx
            onClick={() => setFilter(f.value)}
```

to:

```tsx
            onClick={() => set({ status: f.value ?? null })}
```

- [ ] **Step 4: Add "Review & act" to each active alert**

Change:

```tsx
                {/* Silence toggle (per competitor URL) */}
                <button
                  onClick={() =>
```

to:

```tsx
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
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/alerts/page.tsx"
git commit -m "feat(deeplink): Alerts deep-link + status in URL

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Repricing — consume `?sku`/`?source`

**Files:**
- Modify: `app/(dashboard)/repricing/page.tsx`

The page reads `?sku`, derives prefill/toast from its own loaded data, focuses the row, then strips the params. `SKURow` reacts once. `Bound` forwards an input ref.

- [ ] **Step 1: Swap/extend imports**

Change:

```tsx
import { useState } from 'react'
import { SlidersHorizontal, Sparkles, History } from 'lucide-react'
import {
  useRepricing,
  usePriceChanges,
  useUpdateRepriceSettings,
  useUpdateRepriceSKU,
  type RepriceSKU,
} from '@/lib/api'
import UpgradeGate from '@/components/dashboard/upgrade-gate'
import SignalBadge from '@/components/dashboard/signal-badge'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
```

to:

```tsx
import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Sparkles, History } from 'lucide-react'
import {
  useRepricing,
  usePriceChanges,
  useUpdateRepriceSettings,
  useUpdateRepriceSKU,
  type RepriceSKU,
} from '@/lib/api'
import UpgradeGate from '@/components/dashboard/upgrade-gate'
import SignalBadge from '@/components/dashboard/signal-badge'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseSource } from '@/lib/dashboard/url-params'
import { repricePrefill, formatLandingToast } from '@/lib/dashboard/reprice-prefill'
```

- [ ] **Step 2: Consume the deep-link in `RepricingPage`**

Change:

```tsx
export default function RepricingPage() {
  const { data, isLoading, error } = useRepricing()
  const { data: changes } = usePriceChanges()
  const settingsMut = useUpdateRepriceSettings()
  const skuMut = useUpdateRepriceSKU()

  // 403 → render the upgrade gate (backend is the real gate).
  if (error?.status === 403) {
```

to:

```tsx
export default function RepricingPage() {
  const { data, isLoading, error } = useRepricing()
  const { data: changes } = usePriceChanges()
  const settingsMut = useUpdateRepriceSettings()
  const skuMut = useUpdateRepriceSKU()

  const { get, set } = useQueryParams()
  const [focusedSkuId, setFocusedSkuId] = useState<string | null>(null)
  const handledSkuRef = useRef<string | null>(null)

  // Handle a ?sku deep-link once data has resolved, then strip the params.
  useEffect(() => {
    const skuId = get('sku')
    if (!skuId || !data) return // wait for the repricing list
    if (handledSkuRef.current === skuId) return // one-time per id
    handledSkuRef.current = skuId

    const match = data.skus.find((s) => s.id === skuId)
    // parseSource(get('source')) is available here for future analytics.
    if (match) {
      setFocusedSkuId(skuId)
      const t = formatLandingToast(match)
      toast(t.title, t.description ? { description: t.description } : undefined)
    } else {
      toast.error("That product isn't in your repricing list.")
    }
    set({ sku: null, source: null })
  }, [get, data, set])

  // 403 → render the upgrade gate (backend is the real gate).
  if (error?.status === 403) {
```

- [ ] **Step 3: Pass `focused` to each `SKURow`**

Change:

```tsx
            <SKURow key={sku.id} sku={sku} onSave={skuMut.mutateAsync} saving={skuMut.isPending} />
```

to:

```tsx
            <SKURow
              key={sku.id}
              sku={sku}
              onSave={skuMut.mutateAsync}
              saving={skuMut.isPending}
              focused={sku.id === focusedSkuId}
            />
```

- [ ] **Step 4: `SKURow` — accept `focused`, react once**

Change the `SKURow` signature and the top of its body. Change:

```tsx
function SKURow({
  sku,
  onSave,
  saving,
}: {
  sku: RepriceSKU
  onSave: (input: { id: string; floor_price?: number; ceiling_price?: number; auto_reprice_enabled?: boolean }) => Promise<unknown>
  saving: boolean
}) {
  const [floor, setFloor] = useState(sku.floor_price?.toString() ?? '')
  const [ceiling, setCeiling] = useState(sku.ceiling_price?.toString() ?? '')

  const dirty =
    floor !== (sku.floor_price?.toString() ?? '') ||
    ceiling !== (sku.ceiling_price?.toString() ?? '')

  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3.5 flex flex-col gap-3">
```

to:

```tsx
function SKURow({
  sku,
  onSave,
  saving,
  focused,
}: {
  sku: RepriceSKU
  onSave: (input: { id: string; floor_price?: number; ceiling_price?: number; auto_reprice_enabled?: boolean }) => Promise<unknown>
  saving: boolean
  focused: boolean
}) {
  const [floor, setFloor] = useState(sku.floor_price?.toString() ?? '')
  const [ceiling, setCeiling] = useState(sku.ceiling_price?.toString() ?? '')
  const rowRef = useRef<HTMLDivElement>(null)
  const floorRef = useRef<HTMLInputElement>(null)
  const ceilingRef = useRef<HTMLInputElement>(null)
  const handledRef = useRef(false)
  const [highlight, setHighlight] = useState(false)

  const dirty =
    floor !== (sku.floor_price?.toString() ?? '') ||
    ceiling !== (sku.ceiling_price?.toString() ?? '')

  // When this row becomes the deep-link target: scroll to it, highlight (fades),
  // and prefill the suggested bound IF that bound is empty. Runs once.
  useEffect(() => {
    if (!focused || handledRef.current) return
    handledRef.current = true
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlight(true)
    const timer = setTimeout(() => setHighlight(false), 4000)

    const { bound, value } = repricePrefill(sku)
    if (bound === 'ceiling' && value && sku.ceiling_price === null) {
      setCeiling(value)
      ceilingRef.current?.focus()
    } else if (bound === 'floor' && value && sku.floor_price === null) {
      setFloor(value)
      floorRef.current?.focus()
    }
    return () => clearTimeout(timer)
    // Run only when the row becomes focused; sku is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused])

  return (
    <div
      ref={rowRef}
      className={cn(
        'bg-surface border rounded-xl px-4 py-3.5 flex flex-col gap-3 transition-all',
        highlight ? 'border-primary/60 ring-2 ring-primary/40' : 'border-border',
      )}
    >
```

- [ ] **Step 5: Wire the input refs through `Bound`**

In `SKURow`, change:

```tsx
        <Bound label="Floor" value={floor} onChange={setFloor} />
        <Bound label="Ceiling" value={ceiling} onChange={setCeiling} />
```

to:

```tsx
        <Bound label="Floor" value={floor} onChange={setFloor} inputRef={floorRef} />
        <Bound label="Ceiling" value={ceiling} onChange={setCeiling} inputRef={ceilingRef} />
```

Then change the `Bound` component. Change:

```tsx
function Bound({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-body text-xs text-muted">{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-24 bg-bg border border-border rounded-lg pl-5 pr-2 py-1.5 font-mono text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>
    </div>
  )
}
```

to:

```tsx
function Bound({
  label,
  value,
  onChange,
  inputRef,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-body text-xs text-muted">{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">$</span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-24 bg-bg border border-border rounded-lg pl-5 pr-2 py-1.5 font-mono text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/repricing/page.tsx"
git commit -m "feat(deeplink): Repricing consumes ?sku — scroll/highlight/focus/prefill + landing toast

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Products — `q`/`sort` in URL

**Files:**
- Modify: `app/(dashboard)/products/page.tsx`

`sort` is URL-driven (discrete); `q` keeps responsive local state synced to the URL on a 300ms debounce. `ProductSearchSort` itself is unchanged (the page owns the state).

- [ ] **Step 1: Swap imports**

Change:

```tsx
import { useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import { useProducts } from '@/lib/api'
import SkuMeter from '@/components/dashboard/sku-meter'
import EmptyState from '@/components/dashboard/empty-state'
import ProductSearchSort from '@/components/dashboard/product-search-sort'
import ProductRow from '@/components/dashboard/product-row'
import AddProductForm from '@/components/dashboard/add-product-form'
import { sortProducts, type ProductSort } from '@/lib/dashboard/sort-products'
```

to:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import { useProducts } from '@/lib/api'
import SkuMeter from '@/components/dashboard/sku-meter'
import EmptyState from '@/components/dashboard/empty-state'
import ProductSearchSort from '@/components/dashboard/product-search-sort'
import ProductRow from '@/components/dashboard/product-row'
import AddProductForm from '@/components/dashboard/add-product-form'
import { sortProducts } from '@/lib/dashboard/sort-products'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseProductSort } from '@/lib/dashboard/url-params'
```

(`type ProductSort` is no longer referenced in this file after migration — `parseProductSort` provides the typed value.)

- [ ] **Step 2: Read sort from URL, debounce-sync search**

Change:

```tsx
export default function ProductsPage() {
  const { data, isLoading, error } = useProducts()

  const atSkuLimit = data?.sku_limit != null && data.sku_used >= data.sku_limit

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ProductSort>('signals')
  const visible = useMemo(() => {
```

to:

```tsx
export default function ProductsPage() {
  const { data, isLoading, error } = useProducts()

  const atSkuLimit = data?.sku_limit != null && data.sku_used >= data.sku_limit

  const { get, set } = useQueryParams()
  const sort = parseProductSort(get('sort'))
  const [query, setQuery] = useState(() => get('q') ?? '')

  // Keep typing responsive (local state); sync to the URL after a 300ms pause.
  useEffect(() => {
    const current = get('q') ?? ''
    if (query === current) return
    const id = setTimeout(() => set({ q: query.trim() || null }), 300)
    return () => clearTimeout(id)
  }, [query, get, set])

  const visible = useMemo(() => {
```

- [ ] **Step 3: Wire `ProductSearchSort` sort to the URL**

Change:

```tsx
          <ProductSearchSort query={query} onQuery={setQuery} sort={sort} onSort={setSort} />
```

to:

```tsx
          <ProductSearchSort
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={(s) => set({ sort: s === 'signals' ? null : s })}
          />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/products/page.tsx"
git commit -m "feat(deeplink): Products q/sort in URL (debounced search)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Competitors — `q`/`sort` in URL (+ shared `DomainSort`)

**Files:**
- Modify: `app/(dashboard)/competitors/page.tsx`

`DomainSort` moves from this file into `url-params.ts` (defined there in Task 2) so the parser and the page share one definition.

- [ ] **Step 1: Swap imports + drop the inline type**

Change:

```tsx
import { useMemo, useState } from 'react'
import { Globe, Search } from 'lucide-react'
import Link from 'next/link'
import { useProducts } from '@/lib/api'
import { groupByDomain, type DomainGroup } from '@/lib/dashboard/group-by-domain'
import CompetitorDomainGroup from '@/components/dashboard/competitor-domain-group'
import EmptyState from '@/components/dashboard/empty-state'

type DomainSort = 'products' | 'oos' | 'name'
```

to:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Globe, Search } from 'lucide-react'
import Link from 'next/link'
import { useProducts } from '@/lib/api'
import { groupByDomain, type DomainGroup } from '@/lib/dashboard/group-by-domain'
import CompetitorDomainGroup from '@/components/dashboard/competitor-domain-group'
import EmptyState from '@/components/dashboard/empty-state'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseDomainSort } from '@/lib/dashboard/url-params'
```

- [ ] **Step 2: Read sort from URL, debounce-sync search**

Change:

```tsx
export default function CompetitorsPage() {
  const { data, isLoading, error } = useProducts()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<DomainSort>('products')

  const allGroups = useMemo<DomainGroup[]>(() => groupByDomain(data?.items ?? []), [data?.items])
```

to:

```tsx
export default function CompetitorsPage() {
  const { data, isLoading, error } = useProducts()
  const { get, set } = useQueryParams()
  const sort = parseDomainSort(get('sort'))
  const [query, setQuery] = useState(() => get('q') ?? '')

  // Keep typing responsive (local state); sync to the URL after a 300ms pause.
  useEffect(() => {
    const current = get('q') ?? ''
    if (query === current) return
    const id = setTimeout(() => set({ q: query.trim() || null }), 300)
    return () => clearTimeout(id)
  }, [query, get, set])

  const allGroups = useMemo<DomainGroup[]>(() => groupByDomain(data?.items ?? []), [data?.items])
```

- [ ] **Step 3: Wire the sort select to the URL**

Change:

```tsx
                <select value={sort} onChange={e => setSort(e.target.value as DomainSort)} className="bg-surface border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-primary/60">
```

to:

```tsx
                <select value={sort} onChange={e => set({ sort: e.target.value === 'products' ? null : e.target.value })} className="bg-surface border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-primary/60">
```

(The search `<input>` keeps `value={query} onChange={e => setQuery(e.target.value)}` — unchanged; the debounced effect syncs it.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/competitors/page.tsx"
git commit -m "feat(deeplink): Competitors q/sort in URL (shared DomainSort)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Attribution — `days` in URL

**Files:**
- Modify: `app/(dashboard)/attribution/page.tsx`

- [ ] **Step 1: Add imports**

Add after the existing `import { toast } from '@/lib/toast'` line:

```tsx
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseDays } from '@/lib/dashboard/url-params'
```

(The `useState` import stays — `downloading` still uses it.)

- [ ] **Step 2: Read days from the URL**

Change:

```tsx
export default function AttributionPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const { data, isLoading, error } = useAttribution(days)
  const [downloading, setDownloading] = useState(false)
```

to:

```tsx
export default function AttributionPage() {
  const { get, set } = useQueryParams()
  const days = parseDays(get('days'))
  const { data, isLoading, error } = useAttribution(days)
  const [downloading, setDownloading] = useState(false)
```

- [ ] **Step 3: Range buttons write to the URL**

Change:

```tsx
            onClick={() => setDays(r)}
```

to:

```tsx
            onClick={() => set({ days: r === 30 ? null : String(r) })}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/attribution/page.tsx"
git commit -m "feat(deeplink): Attribution days in URL

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: all suites pass — the previous 222 tests plus the new pure suites (deep-links 3, url-params 14, reprice-prefill 8) = **247 total**.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds; all dashboard routes compile; **no `useSearchParams() should be wrapped in a suspense boundary` error** (the layout boundary covers them).

- [ ] **Step 3: Manual smoke (preview mode)**

With `NEXT_PUBLIC_PREVIEW=1` and the dev server running:
- On Overview / Signals / Alerts, click **Review & act →** on a row → lands on `/repricing` with that row scrolled-to, highlighted (ring fades ~4s), the suggested bound focused + prefilled (when empty), and a landing toast (`Reviewing <title>` / `Suggested ceiling: $X.XX`). Confirm `?sku`/`?source` are then **absent** from the URL.
- Visit `/repricing?sku=bogus` → an error toast appears, no crash, param stripped.
- On each of Signals / Alerts / Products / Competitors / Attribution, set a filter/search/sort/range, copy the URL, open it in a new tab → the same state is restored.
- On Products, type a search then change the sort → the `?q` value is preserved alongside `?sort` (and vice-versa).

---

## Notes for the executor

- Tasks 1–3 are pure logic (unit-tested via TDD). Tasks 4–11 are glue/UI verified by `npx tsc --noEmit` and the final `npm run build` — matches the CLAUDE.md rule (test pure logic only; no component/page tests).
- **Default-omission rule:** the "all" filter, page `0`, sort `signals`/`products`, and `days` `30` are written as `null` (removed), so unfiltered/first-page URLs stay clean. Reading a missing param yields the default via its parser, so the round-trip is lossless.
- **Merge, never replace:** every `set(...)` builds from the current params, so changing one param preserves the others (e.g. sorting keeps the search query). Do not construct params from scratch anywhere.
- **One-time guards:** the Repricing page (`handledSkuRef`) and `SKURow` (`handledRef`) ensure the deep-link is processed once and the 60s background refetch never re-clobbers a value the user is editing.
- The `eslint-disable-next-line react-hooks/exhaustive-deps` on the `SKURow` effect is intentional: the effect must run only when `focused` flips true, reading `sku` at that moment; adding `sku` to deps would re-fire on every refetch.

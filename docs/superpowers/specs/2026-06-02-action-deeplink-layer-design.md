# Sub-project B: Action / Deep-link Layer — Design Spec

**Date:** 2026-06-02
**Status:** Approved (design); pending implementation plan
**Part of:** SPECTER Dashboard UX/UI Optimization (sub-project B of A–G)
**Depends on:** Sub-project A (Toast Foundation, merged) — reuses `@/lib/toast`

## Goal

Turn the SPECTER dashboard from passive monitoring into an actionable workflow by
(1) making signals and out-of-stock alerts **actionable** — a "Review & act" link
routes the user to the Repricing guardrail editor for that product, pre-positioned to
act on the suggestion — and (2) giving every dashboard page **proper cross-page
communication** by making its view state (filters, search, pagination, selection)
live in the URL: shareable, bookmarkable, and durable across refresh and back/forward.

## Mechanism (decided)

**URL search params** are the single source of cross-page truth, accessed through one
reusable client hook (`useQueryParams`). No global store (no Zustand/Context). Server
data continues to flow through the existing TanStack Query cache — only *view state*
moves to the URL.

Rejected alternatives: a Zustand store or React Context — both are non-shareable, lost
on refresh, and introduce a state layer for what URLs already do natively.

## Architecture

```
Source pages                     URL                       Destination
────────────                     ───                       ───────────
Overview  ─┐
Signals   ─┤  <Link href=          /repricing?sku=ID        Repricing page
Alerts    ─┘   repricingHref()> ──> &source=SURFACE   ────> reads ?sku → scroll +
                                                             highlight + focus +
                                                             prefill + landing toast,
                                                             then strips ?sku/?source

All pages: filters/search/pagination ⇄ URL via useQueryParams (replace, merge)
Dashboard layout: one <Suspense> boundary around {children}
```

### Units

| Unit | Type | Responsibility |
|------|------|----------------|
| `lib/dashboard/use-query-params.ts` | client hook (glue) | Read/merge-write URL search params via Next router |
| `lib/dashboard/deep-links.ts` | pure | Build deep-link hrefs (`repricingHref`) |
| `lib/dashboard/url-params.ts` | pure | Parse/validate URL strings → typed view-state |
| `lib/dashboard/reprice-prefill.ts` | pure | Decide prefill bound/value + format landing toast |
| `app/(dashboard)/layout.tsx` | edit | Add `<Suspense>` boundary around `{children}` |
| 7 dashboard route files | edit | Emit deep-links and/or consume URL view-state |

## Component 1 — `useQueryParams` hook

```ts
// lib/dashboard/use-query-params.ts
'use client'
import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function useQueryParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const get = useCallback(
    (key: string) => searchParams.get(key),
    [searchParams],
  )

  // Always builds from the CURRENT params and mutates only the given keys, so
  // unrelated params are preserved (e.g. set({ sort }) keeps an existing ?q).
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

- `set` accepts a **batch** so multiple params change atomically
  (e.g. `set({ type: 'RAISE', page: '0' })`).
- **Merge, never replace** — unrelated params survive every `set`. (Acceptance criterion.)
- Filters use `router.replace` → no history spam, no scroll jump.
- Cross-page navigation uses plain `<Link href>` (push) → back returns to the source.

### Suspense boundary

`useSearchParams()` requires a Suspense boundary above it or static export breaks at
build. Fix once in `app/(dashboard)/layout.tsx`:

```tsx
import { Suspense } from 'react'
// ...
<main className="flex-1 min-w-0 px-8 py-8 max-w-6xl">
  <Suspense fallback={<div className="h-24 rounded-xl bg-surface border border-border animate-pulse" />}>
    {children}
  </Suspense>
</main>
```

The layout itself uses `usePathname`/`useSignalSummary` (not `useSearchParams`), so it
stays outside the boundary.

## Component 2 — Deep-link sources

```ts
// lib/dashboard/deep-links.ts (pure) — canonical home of ActionSource
export type ActionSource = 'overview' | 'signals' | 'alerts'

export function repricingHref(skuId: string, source?: ActionSource): string {
  const base = `/repricing?sku=${encodeURIComponent(skuId)}`
  return source ? `${base}&source=${encodeURIComponent(source)}` : base
}
```

A **"Review & act →"** `<Link>` is added to each row on three surfaces, routing to
`repricingHref(sku_id, <surface>)`:

- **Overview** (`app/(dashboard)/dashboard/page.tsx`) — each recent-signal row →
  `repricingHref(sig.sku_id, 'overview')`.
- **Signals** (`app/(dashboard)/signals/page.tsx`) — each signal row →
  `repricingHref(sig.sku_id, 'signals')`.
- **Alerts** (`app/(dashboard)/alerts/page.tsx`) — each **active** OOS alert →
  `repricingHref(a.sku_id, 'alerts')`.

Shown on every signal row regardless of type (RAISE/LOWER/HOLD all benefit from landing
on guardrails). RECON users without repricing access land on the existing upgrade gate —
an intentional, consistent conversion nudge. No row-component extraction; inline `<Link>`.

## Component 3 — Repricing consumer (`?sku` / `?source`)

The Repricing page reads `?sku`. The matching `RepriceSKU` already carries
`latest_suggestion` (`type` + `price_suggestion`), so **the URL needs only the id** —
the page derives prefill and toast copy from its own loaded data.

### Consumption flow (Repricing page)

A `useEffect` watches `get('sku')` and the loaded `data`:

1. **Wait** until `data` (repricing list) has resolved. If `?sku` is present but data is
   still loading, do nothing yet.
2. **One-time guard:** a `handledSkuRef` records the last-processed id so each `?sku`
   value is handled once (immune to the 60s background refetch).
3. **Found** (sku in `data.skus`):
   - Copy the id into **local** `focusedSkuId` state (drives the row's `focused` prop).
   - Read `source = parseSource(get('source'))` and keep it available for future
     analytics (no analytics emitted in this sub-project — plumbing only).
   - Fire the **landing toast** from `formatLandingToast(sku)` (before stripping).
   - **Strip** params: `set({ sku: null, source: null })`.
4. **Not found** (data resolved, id absent — and not the 403-gate path, where the page
   returned the upgrade gate and `data` is undefined): fire
   `toast.error("That product isn't in your repricing list.")`, then strip params.

Because params are stripped on consumption, a refresh won't re-trigger and the URL stays
clean. The highlight is driven by local `focusedSkuId`, decoupled from the removed param.

### `SKURow` reaction (one-time, on becoming focused)

`SKURow` gains a `focused?: boolean` prop and an internal `handledRef`. A `useEffect`
keyed on `focused` runs **once** when the row becomes focused:

- `scrollIntoView({ behavior: 'smooth', block: 'center' })`.
- Apply a **highlight ring** (e.g. `ring-2 ring-primary/60`) that fades after ~4s via a
  local `highlight` state + timer.
- Compute `repricePrefill(sku)` and, **only if the target bound input is currently
  empty**, set it (marking the row dirty so Save enables) and `focus()` that input.
  Never clobber an existing guardrail value.

The one-time `handledRef` ensures the 60s refetch never re-clobbers a value the user is
mid-edit.

## Component 4 — Prefill + landing-toast rule (pure)

```ts
// lib/dashboard/reprice-prefill.ts (pure)
import type { RepriceSKU } from '@/lib/api'

export interface PrefillResult {
  bound: 'floor' | 'ceiling' | null
  value: string | null
}

// RAISE → ceiling, LOWER → floor, HOLD/none → no prefill.
export function repricePrefill(sku: RepriceSKU): PrefillResult {
  const s = sku.latest_suggestion
  if (!s || s.price_suggestion === null) return { bound: null, value: null }
  if (s.type === 'RAISE') return { bound: 'ceiling', value: s.price_suggestion.toFixed(2) }
  if (s.type === 'LOWER') return { bound: 'floor', value: s.price_suggestion.toFixed(2) }
  return { bound: null, value: null } // HOLD
}

export interface LandingToast {
  title: string
  description?: string
}

export function formatLandingToast(sku: RepriceSKU): LandingToast {
  const { bound, value } = repricePrefill(sku)
  const title = `Reviewing ${sku.title}`
  if (bound && value) {
    const label = bound === 'ceiling' ? 'ceiling' : 'floor'
    return { title, description: `Suggested ${label}: $${value}` }
  }
  return { title }
}
```

The consumer calls `toast(t.title, { description: t.description })`. The caller decides
whether the empty-bound condition holds before *applying* the prefill (Component 3); the
toast always reflects the suggestion regardless, to reinforce why the user arrived.

## Component 5 — Per-page filter → URL migration

Each page's view state moves from local `useState` to the URL via `useQueryParams`, with
a **pure parser** per param (validates/coerces unknown values to a default — never
crashes on a hand-edited URL).

```ts
// lib/dashboard/url-params.ts (pure)
import type { SignalType } from '@/lib/api'
import type { ProductSort } from '@/lib/dashboard/sort-products'
import type { ActionSource } from '@/lib/dashboard/deep-links'

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
// ProductSort = 'signals' | 'updated' | 'name' (from lib/dashboard/sort-products.ts)
export function parseProductSort(v: string | null): ProductSort {
  return v === 'signals' || v === 'updated' || v === 'name' ? v : 'signals' // default matches current page default
}
export type DomainSort = 'products' | 'oos' | 'name'
export function parseDomainSort(v: string | null): DomainSort {
  return v === 'products' || v === 'oos' || v === 'name' ? v : 'products'
}
export function parseDays(v: string | null): 7 | 30 | 90 {
  const n = Number(v)
  return n === 7 || n === 90 ? n : 30 // default 30
}
export function parseSource(v: string | null): ActionSource | null {
  return v === 'overview' || v === 'signals' || v === 'alerts' ? v : null
}
```

> Note: `ActionSource` is defined once in `deep-links.ts` and imported here to avoid
> duplication. `DomainSort` currently lives inline in `competitors/page.tsx`; the plan
> moves it here so the parser and the page share one definition.

| Page | URL params | Parser |
|------|-----------|--------|
| Signals (`signals/page.tsx`) | `type`, `page` | `parseSignalType`, `parsePage` |
| Alerts (`alerts/page.tsx`) | `status` | `parseAlertStatus` |
| Products (`products/page.tsx`) | `q`, `sort` | `parseProductSort` |
| Competitors (`competitors/page.tsx`) | `q`, `sort` | `parseDomainSort` |
| Attribution (`attribution/page.tsx`) | `days` | `parseDays` |

- **Discrete filters** (type, status, sort, days, page): URL is the source of truth —
  read directly, write on change. Changing the Signals filter resets page:
  `set({ type, page: '0' })`.
- **Free-text search** (`q` on Products/Competitors): the input keeps responsive **local
  state**; a **300ms debounced** effect syncs it to the URL; the URL initializes it on
  mount. Avoids a `router.replace` per keystroke.
- **Sorting preserves search** and vice-versa — guaranteed by the merge-not-replace
  setter; `set({ sort })` keeps `?q`. (Acceptance criterion.)
- Invalid param values coerce to the default on read; we don't rewrite the URL.
- **Default values are omitted on write** (pass `null` to `set`): the "all" filter, page
  `0`, sort `signals`/`products`, and `days` `30` produce no param — so first-page /
  unfiltered URLs stay clean (`/signals`, not `/signals?type=&page=0`). Reading a missing
  param yields the default via its parser, so the round-trip is lossless.

## Error handling & edge cases

- **Unknown `?sku`** → `toast.error` + strip, only after data resolves; never on the
  403-gate path (where `data` is undefined and the upgrade gate is shown).
- **`?page` out of range** → `parsePage` clamps to `≥ 0`; if it exceeds `totalPages`
  once data loads, clamp and `set({ page })` to correct the URL.
- **Bad filter values** (`?type=BOGUS`) → coerce to default, no crash, no rewrite.
- **Suspense de-opt** → single boundary in the dashboard layout.
- **History hygiene** → filters `replace`, cross-page navigation `push`.
- **Mid-edit safety** → one-time `handledRef` on `SKURow` so background refetch never
  re-applies prefill over a value the user is editing.

## Testing

Per CLAUDE.md (pure logic only; **no component/page tests**):

| Test file | Covers |
|-----------|--------|
| `lib/dashboard/deep-links.test.ts` | `repricingHref` with/without source; encoding |
| `lib/dashboard/url-params.test.ts` | all parsers — valid, invalid, null, defaults |
| `lib/dashboard/reprice-prefill.test.ts` | `repricePrefill` (RAISE/LOWER/HOLD/null) + `formatLandingToast` (with/without suggestion) |

**Not unit-tested (glue / interactive):** `useQueryParams` (Next-router wrapper), the
Suspense boundary, the 7 page edits, and `SKURow` deep-link reaction — verified by
`npx tsc --noEmit`, `npm run build`, and a manual preview-mode smoke:

- Click "Review & act" on Overview/Signals/Alerts → lands on Repricing with the row
  scrolled-to, highlighted, focused, prefilled (when bound empty), landing toast shown;
  `?sku`/`?source` then absent from the URL.
- Unknown `?sku=bogus` → error toast, no crash.
- Set filters on each page, copy the URL, open in a new tab → same state restored.
- Type a Products search, change sort → `?q` preserved alongside `?sort`.

## File structure summary

**New (pure + tested):**
- `lib/dashboard/deep-links.ts` (+ `.test.ts`)
- `lib/dashboard/url-params.ts` (+ `.test.ts`)
- `lib/dashboard/reprice-prefill.ts` (+ `.test.ts`)

**New (glue):**
- `lib/dashboard/use-query-params.ts`

**Modified:**
- `app/(dashboard)/layout.tsx` — Suspense boundary
- `app/(dashboard)/dashboard/page.tsx` — emit deep-links
- `app/(dashboard)/signals/page.tsx` — emit deep-links + `type`/`page` to URL
- `app/(dashboard)/alerts/page.tsx` — emit deep-links + `status` to URL
- `app/(dashboard)/repricing/page.tsx` — consume `?sku`/`?source`; `SKURow` reaction
- `app/(dashboard)/products/page.tsx` — `q`/`sort` to URL
- `app/(dashboard)/competitors/page.tsx` — `q`/`sort` to URL
- `app/(dashboard)/attribution/page.tsx` — `days` to URL

Unchanged: `lib/dashboard/sort-products.ts`, `lib/dashboard/group-by-domain.ts`.

## Out of scope (deferred)

- True one-click "Apply suggested price" (writes to Shopify) — needs a new
  server-side-gated specter-api endpoint (separate backend spec).
- Prefilter chains (competitor domain → filtered Signals/Products, etc.) — several need
  new specter-api query params (sub-project "Everything + prefilter chains").
- Emitting analytics events from the `source` param — plumbing added now; wiring later.

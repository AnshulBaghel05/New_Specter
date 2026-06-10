# Overview Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the dashboard Overview into an adaptive command center — a smart-funnel getting-started checklist for new accounts, and account banners + clickable stat cards + inline active OOS alerts + a revenue hero for activated accounts.

**Architecture:** A pure module (`overview-state.ts`) centralizes all branching (activation, checklist steps, banners, trial countdown) and is unit-tested via TDD. The Overview page orchestrates existing TanStack Query hooks, derives state from the pure module, and renders one of three states (loading / onboarding / activated). New presentational concerns become small, focused components under `components/dashboard/overview/`.

**Tech Stack:** Next.js 14 App Router, TypeScript, TanStack Query v5, Tailwind, Vitest. Reuses sub-project B's `repricingHref` and URL filter params; reuses `@/lib/toast` from sub-project A (not needed directly here).

**Spec:** `docs/superpowers/specs/2026-06-02-overview-command-center-design.md`

**Conventions for every task:**
- All code paths are relative to `specter-web/`. Run all `git`/`npm` commands **from inside `specter-web/`** (its own git repo, branch `main`).
- Work on a **new branch off `main`** named `overview-command-center` (Task 0).
- Stage only the exact paths listed (NEVER `git add .` / `git add -A`).
- End every commit message with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- Preview mode (`NEXT_PUBLIC_PREVIEW=1`) is active locally; `lib/api.ts` hooks return fixtures. Do not modify preview wiring (`lib/api.ts`, `lib/preview-data.ts`).
- Per CLAUDE.md: unit-test pure logic only. Components/pages are verified by `npx tsc --noEmit` + `npm run build`, never component tests.

---

### Task 0: Create the branch

- [ ] **Step 1: Branch off main**

Run (from `specter-web/`):
```bash
git checkout main
git checkout -b overview-command-center
```
Expected: `Switched to a new branch 'overview-command-center'`.

---

### Task 1: Pure state module (`overview-state.ts`)

**Files:**
- Create: `lib/dashboard/overview-state.ts`
- Test: `lib/dashboard/overview-state.test.ts`

This is the only branching logic in the sub-project. It imports the `Merchant` and `ProductsResponse` types (and transitively `Product`/`ProductSignal`) from `@/lib/api` — all already defined there.

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/overview-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  isActivated,
  deriveOverviewState,
  accountBanners,
  trialDaysLeft,
} from './overview-state'
import type { Merchant, Product, ProductsResponse } from '@/lib/api'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Wireless Earbuds',
    handle: null,
    current_price: null,
    source: 'manual',
    active: true,
    floor_price: null,
    ceiling_price: null,
    competitor_count: 0,
    latest_signal: null,
    competitors: [],
    ...overrides,
  }
}

function makeProducts(items: Product[]): ProductsResponse {
  return { items, sku_used: items.length, sku_limit: null, max_competitors_per_sku: null }
}

function makeMerchant(overrides: Partial<Merchant> = {}): Merchant {
  return {
    id: 'm1',
    plan: 'recon',
    shopify_domain: null,
    shopify_connected: false,
    shopify_reconnect_required: false,
    trial_ends_at: null,
    read_only: false,
    eclipse_interval_ms: 0,
    max_competitors_per_sku: null,
    auto_reprice_enabled: false,
    email_notifications_enabled: false,
    ...overrides,
  }
}

const SIGNAL = { type: 'RAISE' as const, price_suggestion: 42, confidence: 0.9, created_at: '' }

describe('isActivated', () => {
  it('is false when products is undefined', () => {
    expect(isActivated(undefined)).toBe(false)
  })
  it('is false when no product has a signal', () => {
    expect(isActivated(makeProducts([makeProduct({ competitor_count: 1 })]))).toBe(false)
  })
  it('is true when a product has a latest_signal', () => {
    expect(isActivated(makeProducts([makeProduct({ latest_signal: SIGNAL })]))).toBe(true)
  })
})

describe('trialDaysLeft', () => {
  const now = new Date('2026-06-02T12:00:00Z')
  it('returns null when there is no trial date', () => {
    expect(trialDaysLeft(null, now)).toBeNull()
  })
  it('returns whole days remaining for a future date', () => {
    expect(trialDaysLeft('2026-06-05T12:00:00Z', now)).toBe(3)
  })
  it('returns null for a past/expired date', () => {
    expect(trialDaysLeft('2026-06-01T12:00:00Z', now)).toBeNull()
  })
  it('returns null for an unparseable date', () => {
    expect(trialDaysLeft('not-a-date', now)).toBeNull()
  })
})

describe('accountBanners', () => {
  const now = new Date('2026-06-02T12:00:00Z')
  it('returns [] when merchant is undefined', () => {
    expect(accountBanners(undefined, now)).toEqual([])
  })
  it('returns [] when nothing is wrong', () => {
    expect(accountBanners(makeMerchant(), now)).toEqual([])
  })
  it('surfaces a reconnect banner', () => {
    const b = accountBanners(makeMerchant({ shopify_reconnect_required: true }), now)
    expect(b.map((x) => x.kind)).toEqual(['reconnect'])
    expect(b[0].severity).toBe('urgent')
  })
  it('surfaces a read-only banner', () => {
    const b = accountBanners(makeMerchant({ read_only: true }), now)
    expect(b.map((x) => x.kind)).toEqual(['read_only'])
  })
  it('surfaces a trial banner with day count', () => {
    const b = accountBanners(makeMerchant({ trial_ends_at: '2026-06-05T12:00:00Z' }), now)
    expect(b.map((x) => x.kind)).toEqual(['trial'])
    expect(b[0].severity).toBe('info')
    expect(b[0].title).toContain('3 days')
  })
  it('orders multiple banners reconnect, read_only, trial', () => {
    const b = accountBanners(
      makeMerchant({
        shopify_reconnect_required: true,
        read_only: true,
        trial_ends_at: '2026-06-05T12:00:00Z',
      }),
      now,
    )
    expect(b.map((x) => x.kind)).toEqual(['reconnect', 'read_only', 'trial'])
  })
})

describe('deriveOverviewState', () => {
  it('returns null while products is loading', () => {
    expect(deriveOverviewState(undefined, makeMerchant())).toBeNull()
  })
  it('empty catalog: all steps pending, not activated', () => {
    const s = deriveOverviewState(makeProducts([]), makeMerchant())!
    expect(s.activated).toBe(false)
    expect(s.steps.map((x) => x.done)).toEqual([false, false, false])
  })
  it('products only: step 1 done, rest pending', () => {
    const s = deriveOverviewState(makeProducts([makeProduct()]), makeMerchant())!
    expect(s.steps.map((x) => x.done)).toEqual([true, false, false])
    expect(s.activated).toBe(false)
  })
  it('linked competitor but no signal yet: steps 1 and 2 done, 3 pending', () => {
    const s = deriveOverviewState(makeProducts([makeProduct({ competitor_count: 1 })]), makeMerchant())!
    expect(s.steps.map((x) => x.done)).toEqual([true, true, false])
    expect(s.activated).toBe(false)
  })
  it('first signal received: all steps done, activated', () => {
    const s = deriveOverviewState(
      makeProducts([makeProduct({ competitor_count: 1, latest_signal: SIGNAL })]),
      makeMerchant(),
    )!
    expect(s.steps.map((x) => x.done)).toEqual([true, true, true])
    expect(s.activated).toBe(true)
  })
  it('the automatic signal step has no cta', () => {
    const s = deriveOverviewState(makeProducts([]), makeMerchant())!
    expect(s.steps[2].id).toBe('signal')
    expect(s.steps[2].cta).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/overview-state.test.ts`
Expected: FAIL — cannot resolve `./overview-state`.

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard/overview-state.ts`:

```ts
// Pure state for the adaptive Overview page: activation, the onboarding
// checklist, and account banners. The single source of branching truth so the
// page and its section components stay as thin glue.

import type { Merchant, ProductsResponse } from '@/lib/api'

// ── Activation ────────────────────────────────────────────────────────────────
// The single source of truth for "this account has received value."
// Today: a tracked product has produced at least one signal. Evolve here only.
export function isActivated(products: ProductsResponse | undefined): boolean {
  if (!products) return false
  return products.items.some((p) => p.latest_signal !== null)
}

// ── Onboarding checklist ──────────────────────────────────────────────────────
export interface ChecklistStep {
  id: 'products' | 'competitors' | 'signal'
  label: string
  hint: string
  done: boolean
  cta?: { label: string; href: string } // omitted for the automatic signal step
}

export interface OverviewState {
  activated: boolean
  steps: ChecklistStep[]
}

// Returns null while products is still loading (caller shows skeletons).
export function deriveOverviewState(
  products: ProductsResponse | undefined,
  _merchant: Merchant | undefined,
): OverviewState | null {
  if (!products) return null

  const hasProducts = products.items.length > 0
  const hasCompetitor = products.items.some((p) => p.competitor_count > 0)
  const activated = isActivated(products) // step 3 == activation

  const steps: ChecklistStep[] = [
    {
      id: 'products',
      label: 'Add your products',
      hint: 'Connect Shopify to import your catalog, or add a product manually.',
      done: hasProducts,
      cta: { label: hasProducts ? 'Manage products' : 'Add a product', href: '/products' },
    },
    {
      id: 'competitors',
      label: 'Link a competitor',
      hint: 'Track at least one competitor URL so SPECTER can compare prices.',
      done: hasCompetitor,
      cta: { label: 'Link a competitor', href: '/products' },
    },
    {
      id: 'signal',
      label: 'Receive your first signal',
      hint: 'Signals arrive within one scrape cycle after you link a competitor.',
      done: activated,
    },
  ]

  return { activated, steps }
}

// ── Account banners ───────────────────────────────────────────────────────────
export type BannerKind = 'reconnect' | 'read_only' | 'trial'

export interface Banner {
  kind: BannerKind
  severity: 'urgent' | 'info'
  title: string
  cta: { label: string; href: string }
}

// Whole days remaining in the trial, or null if no active (future) trial.
export function trialDaysLeft(trialEndsAt: string | null, now: Date = new Date()): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end)) return null
  const ms = end - now.getTime()
  if (ms <= 0) return null
  return Math.ceil(ms / 86_400_000)
}

// Ordered list of banners to show, urgent first. Empty array → render nothing.
export function accountBanners(merchant: Merchant | undefined, now: Date = new Date()): Banner[] {
  if (!merchant) return []
  const banners: Banner[] = []

  if (merchant.shopify_reconnect_required) {
    banners.push({
      kind: 'reconnect',
      severity: 'urgent',
      title: 'Your Shopify connection needs attention — reconnect to keep prices syncing.',
      cta: { label: 'Reconnect', href: '/settings' },
    })
  }
  if (merchant.read_only) {
    banners.push({
      kind: 'read_only',
      severity: 'urgent',
      title: 'Your account is read-only due to a billing issue. Update billing to resume repricing.',
      cta: { label: 'Fix billing', href: '/settings' },
    })
  }
  const days = trialDaysLeft(merchant.trial_ends_at, now)
  if (days !== null) {
    banners.push({
      kind: 'trial',
      severity: 'info',
      title: days === 1 ? '1 day left in your trial.' : `${days} days left in your trial.`,
      cta: { label: 'View plans', href: '/pricing' },
    })
  }
  return banners
}
```

(`_merchant` is accepted but unused today; it keeps the signature stable for future rules that key on merchant state, and the leading underscore tells the linter it is intentionally unused.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/overview-state.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/overview-state.ts lib/dashboard/overview-state.test.ts
git commit -m "feat(overview): pure state module — activation, checklist, banners

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Make `StatCard` optionally a link

**Files:**
- Modify: `components/dashboard/stat-card.tsx`

Add an optional `href`. When present, the card renders as a `Link` with a hover affordance; otherwise it is unchanged (every existing call site passes no `href`).

- [ ] **Step 1: Replace the component**

Replace the entire contents of `components/dashboard/stat-card.tsx` with:

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
  loading,
  href,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  accent?: 'primary' | 'rose' | 'muted'
  hint?: string
  loading?: boolean
  href?: string
}) {
  const accentColor =
    accent === 'primary'
      ? 'text-primary'
      : accent === 'rose'
        ? 'text-rose-400'
        : 'text-text'

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-body text-sm text-muted">{label}</span>
        {Icon && <Icon size={16} className="text-muted" aria-hidden="true" />}
      </div>
      {loading ? (
        <div className="h-8 w-20 rounded-md bg-border/60 animate-pulse" />
      ) : (
        <span className={cn('font-display text-3xl font-bold tabular-nums', accentColor)}>
          {value}
        </span>
      )}
      {hint && <span className="font-body text-xs text-muted">{hint}</span>}
    </>
  )

  const base = 'bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3'

  if (href) {
    return (
      <Link href={href} className={cn(base, 'hover:border-primary/40 transition-colors')}>
        {inner}
      </Link>
    )
  }

  return <div className={base}>{inner}</div>
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (existing usages without `href` still compile).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/stat-card.tsx
git commit -m "feat(overview): StatCard supports optional href (clickable cards)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Account banners component

**Files:**
- Create: `components/dashboard/overview/account-banners.tsx`

Self-contained: reads `useMerchant()` itself and renders from `accountBanners()`. A future global mount is then a one-line `<AccountBanners />` in the layout.

- [ ] **Step 1: Create the component**

Create `components/dashboard/overview/account-banners.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { PlugZap, AlertTriangle, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMerchant } from '@/lib/api'
import { accountBanners, type BannerKind } from '@/lib/dashboard/overview-state'
import { cn } from '@/lib/utils'

const ICONS: Record<BannerKind, LucideIcon> = {
  reconnect: PlugZap,
  read_only: AlertTriangle,
  trial: Clock,
}

export default function AccountBanners() {
  const { data: merchant } = useMerchant()
  const banners = accountBanners(merchant)
  if (banners.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {banners.map((b) => {
        const Icon = ICONS[b.kind]
        const urgent = b.severity === 'urgent'
        return (
          <div
            key={b.kind}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3',
              urgent ? 'border-rose-400/30 bg-rose-400/10' : 'border-primary/30 bg-primary/10',
            )}
          >
            <Icon
              size={18}
              className={cn('shrink-0', urgent ? 'text-rose-400' : 'text-primary')}
              aria-hidden="true"
            />
            <p className={cn('font-body text-sm flex-1 min-w-0', urgent ? 'text-rose-300' : 'text-primary')}>
              {b.title}
            </p>
            <Link
              href={b.cta.href}
              className={cn(
                'font-body text-xs font-medium shrink-0 whitespace-nowrap hover:underline',
                urgent ? 'text-rose-300' : 'text-primary',
              )}
            >
              {b.cta.label} →
            </Link>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "components/dashboard/overview/account-banners.tsx"
git commit -m "feat(overview): self-contained account banners (reconnect/read-only/trial)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Getting-started checklist component

**Files:**
- Create: `components/dashboard/overview/getting-started.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/overview/getting-started.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import type { ChecklistStep } from '@/lib/dashboard/overview-state'
import { cn } from '@/lib/utils'

export default function GettingStarted({ steps }: { steps: ChecklistStep[] }) {
  const done = steps.filter((s) => s.done).length
  const pct = Math.round((done / steps.length) * 100)

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-text">Get started with SPECTER</h2>
          <span className="font-mono text-xs text-muted">{pct}% complete</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="flex flex-col gap-4">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            {step.done ? (
              <CheckCircle2 size={20} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <Circle size={20} className="text-muted shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-body text-sm font-medium',
                  step.done ? 'text-muted line-through' : 'text-text',
                )}
              >
                {step.label}
              </p>
              <p className="font-body text-xs text-muted mt-0.5">{step.hint}</p>
            </div>
            {!step.done && step.cta && (
              <Link
                href={step.cta.href}
                className="font-body text-xs text-primary hover:underline shrink-0 whitespace-nowrap mt-0.5"
              >
                {step.cta.label} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "components/dashboard/overview/getting-started.tsx"
git commit -m "feat(overview): getting-started checklist with completion %

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Active OOS alerts panel component

**Files:**
- Create: `components/dashboard/overview/active-alerts-panel.tsx`

Reads `useAlerts('active')` and renders nothing when there are no active alerts. Defensively filters to `status === 'active'` (preview fixtures ignore the query arg). Reuses sub-project B's `repricingHref`.

- [ ] **Step 1: Create the component**

Create `components/dashboard/overview/active-alerts-panel.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useAlerts } from '@/lib/api'
import { timeAgo } from '@/lib/time-ago'
import { repricingHref } from '@/lib/dashboard/deep-links'

export default function ActiveAlertsPanel() {
  const { data } = useAlerts('active')
  const alerts = (data?.items ?? []).filter((a) => a.status === 'active').slice(0, 5)
  if (alerts.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-text">Active OOS alerts</h2>
        <Link href="/alerts?status=active" className="font-body text-sm text-primary hover:underline">
          View all
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm text-text truncate">
                <span className="font-medium">{a.competitor_domain}</span> out of stock
                <span className="text-muted"> · your {a.sku_title}</span>
              </p>
              <p className="font-body text-xs text-muted mt-0.5">Detected {timeAgo(a.detected_at)}</p>
            </div>
            <Link
              href={repricingHref(a.sku_id, 'overview')}
              className="font-body text-xs text-primary hover:underline shrink-0 whitespace-nowrap"
            >
              Review &amp; act →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "components/dashboard/overview/active-alerts-panel.tsx"
git commit -m "feat(overview): inline active OOS alerts panel with deep-links

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Wire the adaptive Overview page

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

Replace the whole page so it derives state and renders onboarding vs command-center. The recent-signals feed markup is preserved verbatim inside the activated branch.

- [ ] **Step 1: Replace the page**

Replace the entire contents of `app/(dashboard)/dashboard/page.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, DollarSign, BellRing, Radio } from 'lucide-react'
import { useSignals, useSignalSummary, useProducts, useMerchant } from '@/lib/api'
import StatCard from '@/components/dashboard/stat-card'
import SignalBadge from '@/components/dashboard/signal-badge'
import EmptyState from '@/components/dashboard/empty-state'
import SkuMeter from '@/components/dashboard/sku-meter'
import AccountBanners from '@/components/dashboard/overview/account-banners'
import GettingStarted from '@/components/dashboard/overview/getting-started'
import ActiveAlertsPanel from '@/components/dashboard/overview/active-alerts-panel'
import { timeAgo } from '@/lib/time-ago'
import { repricingHref } from '@/lib/dashboard/deep-links'
import { deriveOverviewState } from '@/lib/dashboard/overview-state'

export default function DashboardPage() {
  const { data: merchant } = useMerchant()
  const { data: products } = useProducts()
  const { data: summary, isLoading: summaryLoading } = useSignalSummary()
  const { data: feed, isLoading: feedLoading } = useSignals({ limit: 10 })

  const state = deriveOverviewState(products, merchant)
  const signals = feed?.items ?? []

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Overview</h1>
          <p className="font-body text-sm text-muted mt-1">
            Your competitive pricing intelligence at a glance.
          </p>
        </div>
        {products && (
          <SkuMeter
            used={products.sku_used}
            limit={products.sku_limit}
            maxCompetitors={products.max_competitors_per_sku}
          />
        )}
      </header>

      <AccountBanners />

      {state === null ? (
        // Products still loading.
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </section>
      ) : !state.activated ? (
        <GettingStarted steps={state.steps} />
      ) : (
        <>
          {/* Revenue hero */}
          <Link
            href="/attribution"
            className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-2 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-muted">Revenue recovered (MTD)</span>
              <DollarSign size={18} className="text-muted" aria-hidden="true" />
            </div>
            <span className="font-display text-4xl sm:text-5xl font-bold tabular-nums text-primary">
              ${(summary?.revenue_recovered_mtd ?? 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="font-body text-xs text-muted">
              From auto-reprice price changes this month →
            </span>
          </Link>

          {/* Secondary stat row */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="RAISE signals (24h)"
              value={summary?.raise_24h ?? 0}
              icon={TrendingUp}
              accent="primary"
              loading={summaryLoading}
              href="/signals?type=RAISE"
            />
            <StatCard
              label="LOWER signals (24h)"
              value={summary?.lower_24h ?? 0}
              icon={TrendingDown}
              accent="rose"
              loading={summaryLoading}
              href="/signals?type=LOWER"
            />
            <StatCard
              label="HOLD signals (24h)"
              value={summary?.hold_24h ?? 0}
              icon={Minus}
              accent="muted"
              loading={summaryLoading}
              href="/signals?type=HOLD"
            />
            <StatCard
              label="Active OOS alerts"
              value={summary?.active_oos_count ?? 0}
              icon={BellRing}
              accent={summary?.active_oos_count ? 'rose' : 'muted'}
              loading={summaryLoading}
              href="/alerts?status=active"
            />
          </section>

          <ActiveAlertsPanel />

          {/* Recent signal feed */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-text">Recent signals</h2>
              <Link href="/signals" className="font-body text-sm text-primary hover:underline">
                View all
              </Link>
            </div>

            {feedLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />
                ))}
              </div>
            ) : signals.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="No signals yet"
                description="Once you connect a store and track competitors, RAISE/LOWER/HOLD signals will appear here within one scrape cycle."
                cta={{ label: 'Add competitors', href: '/competitors' }}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {signals.map((sig) => (
                  <li
                    key={sig.id}
                    className="flex items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3"
                  >
                    <SignalBadge type={sig.type} />
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-text truncate">{sig.sku_title}</p>
                      {sig.reasoning && (
                        <p className="font-body text-xs text-muted truncate">{sig.reasoning}</p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted tabular-nums shrink-0">
                      {Math.round(sig.confidence * 100)}%
                    </span>
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
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(overview): adaptive page — onboarding checklist vs command center

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: all suites pass — the previous **247** tests plus the new `overview-state` suite (**19** tests) = **266 total**.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors/warnings introduced by the new files (pre-existing warnings in tool-calculator files are unrelated).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/dashboard` compiles; no `useSearchParams` suspense error.

- [ ] **Step 4: Manual smoke (preview mode)**

With `NEXT_PUBLIC_PREVIEW=1` and the dev server running (`npm run dev`), open `/dashboard`:
- The preview fixtures have products with signals, so the **activated** command center renders: revenue hero on top, four clickable stat cards, the active-alerts panel (if the fixture has active alerts), and the recent-signals feed.
- Click each stat card → navigates to `/signals?type=RAISE` (and LOWER/HOLD), `/alerts?status=active`, and the revenue hero → `/attribution`.
- Click "Review & act →" in the alerts panel → lands on `/repricing` with the row focused (sub-project B behavior).
- If `previewMerchant` has `trial_ends_at` / `shopify_reconnect_required` / `read_only` set, confirm the matching banner shows above the body; otherwise no banner.

---

## Notes for the executor

- **Activation = first signal.** `isActivated` keys on `Product.latest_signal !== null`. A product with a linked competitor but no signal yet stays in onboarding (step 3 pending) — there is intentionally no "activated but all-zero" command center.
- **Single source of truth:** never inline the activation check in a component; always call `isActivated` / `deriveOverviewState`.
- **Banners are reusable:** `AccountBanners` reads its own `useMerchant()` and renders nothing when no condition applies, so mounting it globally later is one line in `app/(dashboard)/layout.tsx` (not done in this sub-project).
- **Test pure logic only** (CLAUDE.md): the `overview-state` suite is the only new test file. Components/page are verified by `tsc` + `build`.
- **Deep-links reuse sub-project B:** stat cards use `/signals?type=…` and `/alerts?status=active`; the alerts panel uses `repricingHref(sku_id, 'overview')`. Do not introduce new local state for navigation.
```

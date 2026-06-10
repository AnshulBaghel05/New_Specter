# Sub-project C: Overview — Adaptive Command Center — Design Spec

**Date:** 2026-06-02
**Repo:** `specter-web` (Next.js 14 App Router, branch `main`)
**Part of:** SPECTER Dashboard UX/UI Optimization (sub-project C of A–G)
**Depends on:** Sub-project A (Toast Foundation, merged) and Sub-project B (Action/Deep-link layer, merged) — reuses `@/lib/toast`, `repricingHref`, and the URL filter params (`/signals?type=…`, `/alerts?status=active`).

---

## 1. Purpose

The Overview (`app/(dashboard)/dashboard/page.tsx`) is the first screen a merchant sees. Today it is a passive dashboard: stat cards + a recent-signals feed, both empty/zero for brand-new accounts. This sub-project makes Overview **adaptive and actionable**:

- **New / not-yet-activated accounts** get a focused getting-started checklist that drives the activation funnel (products → competitor → first signal).
- **Activated accounts** get a command center: account/connection banners, a revenue hero metric, clickable stat cards that deep-link into filtered views, the actual active OOS alerts inline, and the recent-signals feed.

The page transitions between these states automatically based on data already loaded.

## 2. Scope

**In scope**
- An adaptive Overview page with three render states: loading, onboarding, activated.
- A reusable account-banners unit (reconnect / read-only / trial countdown), built self-contained so it can be mounted globally later; mounted **only on Overview** in this sub-project.
- A smart-funnel getting-started checklist (3 steps + completion %).
- An inline active-OOS-alerts panel with deep-links.
- Clickable stat cards (deep-link to sub-project B filtered views) and a revenue hero card in the activated layout.
- A pure, unit-tested state module that centralizes activation, banner, and trial logic.

**Out of scope**
- A revenue sparkline / mini attribution chart on Overview (belongs to sub-project G, Attribution).
- Mounting the banner unit globally in the dashboard layout (trivial follow-up; not done here).
- Any change to specter-api or new endpoints — uses existing hooks only.
- Signals/Alerts page enrichment (sub-project D).

## 3. Architecture

`DashboardPage` remains the orchestrator: it calls the hooks, derives state via the pure module, and renders one of three states. New presentational concerns are extracted into focused components; the only branching logic lives in a pure module.

```
DashboardPage (app/(dashboard)/dashboard/page.tsx)
│  hooks: useMerchant, useProducts, useSignalSummary, useSignals({limit:10}), useAlerts('active')
│  const state = deriveOverviewState(products, merchant)   // pure
│
├─ <AccountBanners />                 (always, when accountBanners() non-empty)
│
├─ state === null            → existing loading skeletons
├─ state.activated === false → <GettingStarted steps={state.steps} />
└─ state.activated === true  → Revenue hero card
                               + secondary StatCards (clickable)
                               + <ActiveAlertsPanel />
                               + Recent signals feed (existing markup)
```

Banners sit above the body in both onboarding and activated states (an onboarding user can still be on trial / read-only). The header `SkuMeter` stays whenever `products` is present.

### File structure

| File | Responsibility |
|------|----------------|
| `lib/dashboard/overview-state.ts` (new) | Pure: `isActivated`, `deriveOverviewState`, `accountBanners`, `trialDaysLeft`. The single source of truth for all Overview branching. |
| `lib/dashboard/overview-state.test.ts` (new) | Vitest unit tests for the pure module. |
| `components/dashboard/overview/account-banners.tsx` (new) | Self-contained banner unit; reads `useMerchant()`, renders from `accountBanners()`. |
| `components/dashboard/overview/getting-started.tsx` (new) | Checklist card; props `{ steps }`; renders steps + completion %. |
| `components/dashboard/overview/active-alerts-panel.tsx` (new) | Inline active OOS alerts; reads `useAlerts('active')`; deep-links via `repricingHref`. |
| `components/dashboard/stat-card.tsx` (modify) | Add optional `href` → wraps the card in a `Link` with hover affordance. |
| `app/(dashboard)/dashboard/page.tsx` (modify) | Orchestrate hooks + state; render onboarding vs command center. |

## 4. Pure module — `lib/dashboard/overview-state.ts`

```ts
import type { Merchant, ProductsResponse } from '@/lib/api'

// ── Activation ──────────────────────────────────────────────────────────────
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
  cta?: { label: string; href: string } // omitted for the automatic step 3
}

export interface OverviewState {
  activated: boolean
  steps: ChecklistStep[]
}

// Returns null while products is still loading (caller shows skeletons).
export function deriveOverviewState(
  products: ProductsResponse | undefined,
  merchant: Merchant | undefined,
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
      // no cta — this step completes automatically
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

**Notes**
- `isActivated` keys on `Product.latest_signal !== null`, which is on the existing `useProducts()` payload — no new hook, and `deriveOverviewState`'s signature stays `(products, merchant)`.
- Step 3 (`signal`) has no `cta` because it completes automatically after a scrape cycle; the component shows the `hint` while pending.
- Banner order is fixed: reconnect, read-only, trial. All applicable banners render (stacked).

## 5. Components

### 5.1 `account-banners.tsx`
- `'use client'`. Calls `useMerchant()`; computes `accountBanners(merchant)`. Returns `null` if empty.
- Renders each banner as a row: `severity === 'urgent'` → `border-rose-400/30 bg-rose-400/10 text-rose-300`; `info` → `border-primary/30 bg-primary/10 text-primary`. Title text + a right-aligned CTA `Link` styled as a small button/link. Lucide icon per kind (e.g. `PlugZap`/`AlertTriangle`/`Clock`).
- Self-contained so a future global mount is a one-line `<AccountBanners />` in the dashboard layout.

### 5.2 `getting-started.tsx`
- Props: `{ steps: ChecklistStep[] }`.
- Card titled "Get started with SPECTER" with a completion indicator: `const pct = Math.round(steps.filter(s => s.done).length / steps.length * 100)` → `"{pct}% complete"` plus a thin progress bar (`width: pct%`).
- Each step: a leading icon (`done` → filled `CheckCircle2` in primary; pending → muted `Circle`), `label` (struck/muted when done), `hint` as sub-text, and the step's `cta` `Link` rendered only when `!done && step.cta`. Pending automatic step (no cta) shows just its hint.

### 5.3 `active-alerts-panel.tsx`
- `'use client'`. Calls `useAlerts('active')`. Renders `null` when there are no active alerts (the OOS stat card already shows the count).
- Header: "Active OOS alerts" + "View all" → `/alerts?status=active`.
- Lists up to 5 active alerts: `{competitor_domain} out of stock · your {sku_title}`, `Detected {timeAgo(detected_at)}`, and a **"Review & act →"** `Link` → `repricingHref(a.sku_id, 'overview')`.

### 5.4 `stat-card.tsx` (modify)
- Add optional `href?: string`. When set, the outer container renders as `<Link href={href}>` with `hover:border-primary/40 transition-colors`; otherwise the current `<div>`. All existing call sites (no `href`) are unchanged.

### 5.5 Activated layout in `page.tsx`
- **Revenue hero:** a full-width card (spanning the grid) for **Revenue recovered (MTD)** — larger number, `accent="primary"`, `href="/attribution"`.
- **Secondary stat row:** RAISE / LOWER / HOLD / Active OOS as a responsive grid below the hero, each with `href`:

| Card | href |
|------|------|
| RAISE signals (24h) | `/signals?type=RAISE` |
| LOWER signals (24h) | `/signals?type=LOWER` |
| HOLD signals (24h) | `/signals?type=HOLD` |
| Active OOS alerts | `/alerts?status=active` |

- Then `<ActiveAlertsPanel />` and the existing recent-signals feed (unchanged markup, including its sub-project B deep-links).

## 6. Data flow, loading & errors

- `deriveOverviewState(products, merchant)`:
  - `null` (products loading) → existing skeleton grid.
  - `activated === false` → `<AccountBanners />` + `<GettingStarted steps={state.steps} />`. Stat cards & feed hidden (they would be zero/empty).
  - `activated === true` → `<AccountBanners />` + revenue hero + secondary stat row + `<ActiveAlertsPanel />` + recent feed.
- Products **error** → keep a graceful inline message (reuse the existing rose error pattern). `AccountBanners`/`ActiveAlertsPanel` render nothing if their own hook is loading or errors — no crash, no blocking.
- The header `SkuMeter` renders whenever `products` is present, in both states.

## 7. Testing

Per CLAUDE.md: **test pure logic only; no component/page tests.**

`lib/dashboard/overview-state.test.ts`:
- `isActivated`: `undefined` → false; products with no `latest_signal` → false; a product with `latest_signal` → true.
- `trialDaysLeft`: `null` → null; future date → correct whole-day ceiling; past/now date → null; invalid string → null.
- `accountBanners`: `undefined` merchant → `[]`; only reconnect; only read-only; only trial; multiple → ordered reconnect→read_only→trial; no conditions → `[]`.
- `deriveOverviewState`: `undefined` products → null; empty catalog → 3 steps all pending, `activated:false`; products only → step1 done, 2&3 pending; products+competitor, no signal → steps 1&2 done, 3 pending, `activated:false` (the "linked-but-no-signal-yet" case); product with `latest_signal` → all done, `activated:true`.

Glue/UI verified by `npx tsc --noEmit` and `npm run build` (no new component tests).

## 8. Acceptance criteria

- A brand-new account (no products) shows banners (if any) + a 3-step checklist at "0% complete", no stat cards/feed.
- Adding products checks step 1; linking a competitor checks step 2 ("67% complete"); the checklist persists until the first signal exists.
- Once any product has a `latest_signal`, the checklist disappears and the command center renders: revenue hero, clickable secondary stat cards, the active-alerts panel (when alerts exist), and the recent-signals feed.
- Clicking a stat card navigates to the matching filtered view (`/signals?type=RAISE`, `/alerts?status=active`, `/attribution`).
- `shopify_reconnect_required`, `read_only`, and an active trial each render their banner (urgent ones first); none render when not applicable.
- `npm test -- --run` passes including the new `overview-state` suite; `npm run build` succeeds.

## 9. Implementation notes

- New branch off `main`: `overview-command-center`.
- Stage only exact paths; never `git add .`. End commits with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- Preview mode (`NEXT_PUBLIC_PREVIEW=1`) returns fixtures; do not modify preview wiring (`lib/api.ts`, `lib/preview-data.ts`).
- Reuse `repricingHref` and the URL filter conventions from sub-project B; do not reintroduce local state for cross-page navigation.

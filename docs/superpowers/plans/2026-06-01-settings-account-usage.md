# Settings + Account/Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the SPECTER dashboard Settings page into a complete self-serve surface (plan, SKU usage, store connection, notifications, ECLIPSE interval, account basics) with a tailored FREE-plan state, extracting the inline cards into focused components.

**Architecture:** Frontend-only in `specter-web` — no backend changes. `app/(dashboard)/settings/page.tsx` becomes a thin orchestrator that fetches `useMerchant()` + `useProducts()` and composes per-card components from `components/dashboard/settings/`, branching once on `plan === 'free'`. Two pure modules (`plan-meta.ts`, `trial.ts`) hold the only unit-tested logic.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, TanStack Query (existing hooks), Supabase browser client (`@/lib/supabase/client`), Vitest. Reuses `sku-meter.tsx`, `useMerchant`, `useProducts`, `useUpdateMerchant`, `useDisconnectShopify`, `shopifyOAuthUrl`.

**Spec:** `docs/superpowers/specs/2026-06-01-settings-account-usage-design.md`

**Working dir for all commands:** `C:/Users/manoj/New Specter/specter-web`

**Testing rule (CLAUDE.md):** unit-test pure logic only — NO component or page tests. Component/page tasks are verified by `npm run build`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/dashboard/plan-meta.ts` | Pure: `planMeta(plan)` → static `{ label, priceLabel, refreshLabel }`. **Tested.** |
| `lib/dashboard/trial.ts` | Pure: `daysLeft(trialEndsAt)` → `number \| null`. **Tested.** |
| `lib/api.ts` | Widen `Merchant.plan` union to include `'free'`. |
| `components/dashboard/settings/settings-card.tsx` | Shared `<SettingsCard title>` shell. |
| `components/dashboard/settings/plan-card.tsx` | Tier badge, price, trial countdown, limits summary, change-plan / trial CTA. |
| `components/dashboard/settings/usage-card.tsx` | `SkuMeter` + add-on link (paid) or trial prompt (free); inline usage-error state. |
| `components/dashboard/settings/shopify-card.tsx` | Moved verbatim from page (connect/reconnect/disconnect). |
| `components/dashboard/settings/notifications-card.tsx` | Moved from page (email toggle) + mutation-error path. |
| `components/dashboard/settings/account-card.tsx` | Account email (Supabase), Sign out, Support link. |
| `components/dashboard/settings/eclipse-interval-card.tsx` | ECLIPSE-only 5–15 min control. |
| `app/(dashboard)/settings/page.tsx` | Thin orchestrator: fetch + free/paid branch + compose. |
| `lib/dashboard/plan-meta.test.ts`, `lib/dashboard/trial.test.ts` | Unit tests. |

---

### Task 1: `plan-meta.ts` (pure) + widen `Merchant.plan`

**Files:**
- Create: `lib/dashboard/plan-meta.ts`
- Test: `lib/dashboard/plan-meta.test.ts`
- Modify: `lib/api.ts:26`

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/plan-meta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { planMeta, PLAN_META } from './plan-meta'

describe('planMeta', () => {
  it('returns static display meta for each known plan', () => {
    expect(planMeta('recon')).toEqual({ label: 'RECON', priceLabel: '$79/mo', refreshLabel: 'every 6 hr' })
    expect(planMeta('eclipse').refreshLabel).toBe('5–15 min')
    expect(planMeta('free')).toEqual({ label: 'Free', priceLabel: '$0', refreshLabel: '—' })
  })

  it('covers all six plan keys', () => {
    expect(Object.keys(PLAN_META).sort()).toEqual(
      ['cipher', 'eclipse', 'free', 'phantom', 'predator', 'recon'].sort()
    )
  })

  it('falls back to an uppercased label for an unknown plan', () => {
    expect(planMeta('mystery')).toEqual({ label: 'MYSTERY', priceLabel: '', refreshLabel: '—' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/plan-meta.test.ts`
Expected: FAIL — cannot resolve `./plan-meta`.

- [ ] **Step 3: Implement `plan-meta.ts`**

Create `lib/dashboard/plan-meta.ts`:

```ts
export interface PlanMeta {
  label: string
  priceLabel: string
  refreshLabel: string
}

export const PLAN_META: Record<string, PlanMeta> = {
  free:     { label: 'Free',     priceLabel: '$0',         refreshLabel: '—' },
  recon:    { label: 'RECON',    priceLabel: '$79/mo',     refreshLabel: 'every 6 hr' },
  cipher:   { label: 'CIPHER',   priceLabel: '$249/mo',    refreshLabel: 'every 3 hr' },
  phantom:  { label: 'PHANTOM',  priceLabel: '$699/mo',    refreshLabel: 'every 2 hr' },
  predator: { label: 'PREDATOR', priceLabel: '$1,799/mo',  refreshLabel: 'every 1 hr' },
  eclipse:  { label: 'ECLIPSE',  priceLabel: 'Custom',     refreshLabel: '5–15 min' },
}

export function planMeta(plan: string): PlanMeta {
  return PLAN_META[plan] ?? { label: plan.toUpperCase(), priceLabel: '', refreshLabel: '—' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/plan-meta.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Widen `Merchant.plan` to include `'free'`**

In `lib/api.ts`, change line 26 from:

```ts
  plan: 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'
```
to:
```ts
  plan: 'free' | 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'
```

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/plan-meta.ts lib/dashboard/plan-meta.test.ts lib/api.ts
git commit -m "feat(settings): plan-meta pure module + widen Merchant.plan to include free"
```

---

### Task 2: `trial.ts` (pure)

**Files:**
- Create: `lib/dashboard/trial.ts`
- Test: `lib/dashboard/trial.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/trial.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { daysLeft } from './trial'

describe('daysLeft', () => {
  it('returns a positive integer for a future date (ceil of remaining days)', () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString()
    expect(daysLeft(inThreeDays)).toBe(3)
  })

  it('returns 1 for a date later today/tomorrow', () => {
    const soon = new Date(Date.now() + 60_000).toISOString()
    expect(daysLeft(soon)).toBe(1)
  })

  it('returns null for a past date', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(daysLeft(yesterday)).toBeNull()
  })

  it('returns null for null or invalid input', () => {
    expect(daysLeft(null)).toBeNull()
    expect(daysLeft('not-a-date')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/trial.test.ts`
Expected: FAIL — cannot resolve `./trial`.

- [ ] **Step 3: Implement `trial.ts`**

Create `lib/dashboard/trial.ts`:

```ts
/** Whole days until a trial ends. null when no trial, already ended, or unparseable. */
export function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end)) return null
  const diff = end - Date.now()
  if (diff <= 0) return null
  return Math.ceil(diff / 86_400_000)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/trial.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/trial.ts lib/dashboard/trial.test.ts
git commit -m "feat(settings): trial.daysLeft pure module"
```

---

### Task 3: `settings-card.tsx` shared shell

**Files:**
- Create: `components/dashboard/settings/settings-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/settings/settings-card.tsx`:

```tsx
import type { ReactNode } from 'react'

export default function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/settings/settings-card.tsx
git commit -m "feat(settings): shared SettingsCard shell"
```

---

### Task 4: Move `shopify-card.tsx` + `notifications-card.tsx`

**Files:**
- Create: `components/dashboard/settings/shopify-card.tsx`
- Create: `components/dashboard/settings/notifications-card.tsx`

> These are lifted out of the current `app/(dashboard)/settings/page.tsx` (where they exist as `ShopifyCard` / `NotificationsCard`), rewired to use the shared `SettingsCard`. `notifications-card` also gains a mutation-error line. `page.tsx` is not edited yet — that happens in Task 9.

- [ ] **Step 1: Create `shopify-card.tsx`**

Create `components/dashboard/settings/shopify-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Store, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useDisconnectShopify, shopifyOAuthUrl, type Merchant } from '@/lib/api'
import SettingsCard from './settings-card'

export default function ShopifyCard({ merchant }: { merchant: Merchant }) {
  const disconnect = useDisconnectShopify()
  const [shop, setShop] = useState('')

  function connect() {
    const trimmed = shop.trim().replace(/^https?:\/\//, '')
    if (!trimmed) return
    window.location.href = shopifyOAuthUrl(trimmed)
  }

  if (merchant.shopify_connected && !merchant.shopify_reconnect_required) {
    return (
      <SettingsCard title="Shopify">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 size={20} className="text-primary shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-body text-sm text-text truncate">{merchant.shopify_domain ?? 'Connected'}</p>
              <p className="font-body text-xs text-muted">Store connected</p>
            </div>
          </div>
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="font-body text-sm text-rose-400 hover:text-rose-300 disabled:opacity-40 shrink-0"
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
        {disconnect.isError && <p className="font-body text-xs text-rose-400">Couldn’t disconnect. Try again.</p>}
      </SettingsCard>
    )
  }

  if (merchant.shopify_connected && merchant.shopify_reconnect_required) {
    return (
      <SettingsCard title="Shopify">
        <div className="flex items-start gap-3 rounded-xl bg-amber-400/10 border border-amber-400/20 px-4 py-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-sm text-text">Reconnect required</p>
            <p className="font-body text-xs text-muted mt-0.5">
              Your Shopify access token expired or was revoked. Auto-repricing is paused until you reconnect{' '}
              {merchant.shopify_domain ?? 'your store'}.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (merchant.shopify_domain) window.location.href = shopifyOAuthUrl(merchant.shopify_domain)
          }}
          className="gradient-primary-cta btn-ripple self-start px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
        >
          Reconnect Shopify
        </button>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard title="Shopify">
      <div className="flex items-center gap-3">
        <Store size={20} className="text-muted shrink-0" aria-hidden="true" />
        <p className="font-body text-sm text-muted">Connect your store to import products and enable auto-repricing.</p>
      </div>
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && connect()}
          placeholder="your-store.myshopify.com"
          className="flex-1 bg-bg border border-border rounded-xl px-3.5 py-2.5 font-mono text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button
          onClick={connect}
          disabled={!shop.trim()}
          className="gradient-primary-cta btn-ripple px-5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        >
          Connect
        </button>
      </div>
    </SettingsCard>
  )
}
```

- [ ] **Step 2: Create `notifications-card.tsx`**

Create `components/dashboard/settings/notifications-card.tsx`:

```tsx
'use client'

import { Mail, Loader2 } from 'lucide-react'
import { useUpdateMerchant } from '@/lib/api'
import { cn } from '@/lib/utils'
import SettingsCard from './settings-card'

export default function NotificationsCard({ enabled }: { enabled: boolean }) {
  const update = useUpdateMerchant()

  return (
    <SettingsCard title="Notifications">
      <label className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Mail size={18} className="text-muted shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-sm text-text">Email notifications</p>
            <p className="font-body text-xs text-muted">Out-of-stock alerts, scrape failures, and reconnect reminders.</p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          disabled={update.isPending}
          onClick={() => update.mutate({ email_notifications_enabled: !enabled })}
          className={cn(
            'relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50',
            enabled ? 'bg-primary' : 'bg-border',
          )}
        >
          {update.isPending ? (
            <Loader2 size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-bg" />
          ) : (
            <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-bg transition-transform', enabled && 'translate-x-5')} />
          )}
        </button>
      </label>
      {update.isError && <p className="font-body text-xs text-rose-400">Couldn’t update. Try again.</p>}
    </SettingsCard>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`. (Both files are unused until Task 9 but must type-check.)

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/settings/shopify-card.tsx components/dashboard/settings/notifications-card.tsx
git commit -m "feat(settings): extract Shopify + Notifications cards (with error states)"
```

---

### Task 5: `account-card.tsx`

**Files:**
- Create: `components/dashboard/settings/account-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/settings/account-card.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, LogOut, LifeBuoy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import SettingsCard from './settings-card'

export default function AccountCard() {
  const router = useRouter()
  const [email, setEmail] = useState('—')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user?.email) setEmail(data.user.email)
      })
      .catch(() => {})
  }, [])

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  return (
    <SettingsCard title="Account">
      <div className="flex items-center gap-3 min-w-0">
        <Mail size={18} className="text-muted shrink-0" aria-hidden="true" />
        <p className="font-body text-sm text-text truncate">{email}</p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <a
          href="mailto:support@specterapp.io"
          className="font-body text-sm text-primary hover:underline inline-flex items-center gap-2"
        >
          <LifeBuoy size={16} aria-hidden="true" /> Contact support
        </a>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="font-body text-sm text-rose-400 hover:text-rose-300 disabled:opacity-40 inline-flex items-center gap-2 shrink-0"
        >
          <LogOut size={16} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </SettingsCard>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/settings/account-card.tsx
git commit -m "feat(settings): account card (email, sign out, support)"
```

---

### Task 6: `eclipse-interval-card.tsx`

**Files:**
- Create: `components/dashboard/settings/eclipse-interval-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/settings/eclipse-interval-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Gauge } from 'lucide-react'
import { useUpdateMerchant } from '@/lib/api'
import SettingsCard from './settings-card'

export default function EclipseIntervalCard({ intervalMs }: { intervalMs: number }) {
  const update = useUpdateMerchant()
  const [minutes, setMinutes] = useState(Math.round(intervalMs / 60_000))

  const clamped = Math.min(15, Math.max(5, Number.isFinite(minutes) ? minutes : 5))
  const dirty = clamped * 60_000 !== intervalMs

  function save() {
    update.mutate({ eclipse_interval_ms: clamped * 60_000 })
  }

  return (
    <SettingsCard title="Refresh interval">
      <div className="flex items-center gap-3">
        <Gauge size={18} className="text-muted shrink-0" aria-hidden="true" />
        <p className="font-body text-sm text-muted">How often ECLIPSE scrapes your competitors (5–15 minutes).</p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={5}
          max={15}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-20 bg-bg border border-border rounded-xl px-3 py-2 font-mono text-sm text-text focus:outline-none focus:border-primary/60"
        />
        <span className="font-body text-sm text-muted">minutes</span>
        <button
          onClick={save}
          disabled={!dirty || update.isPending}
          className="gradient-primary-cta btn-ripple px-5 py-2 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {update.isError && <p className="font-body text-xs text-rose-400">Couldn’t save. Try again.</p>}
    </SettingsCard>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/settings/eclipse-interval-card.tsx
git commit -m "feat(settings): ECLIPSE refresh-interval card"
```

---

### Task 7: `plan-card.tsx`

**Files:**
- Create: `components/dashboard/settings/plan-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/settings/plan-card.tsx`:

```tsx
'use client'

import { planMeta } from '@/lib/dashboard/plan-meta'
import { daysLeft } from '@/lib/dashboard/trial'
import { cn } from '@/lib/utils'
import SettingsCard from './settings-card'

export default function PlanCard({
  plan,
  trialEndsAt,
  skuLimit,
  maxCompetitors,
}: {
  plan: string
  trialEndsAt: string | null
  skuLimit: number | null
  maxCompetitors: number | null
}) {
  const meta = planMeta(plan)
  const isFree = plan === 'free'
  const trial = daysLeft(trialEndsAt)

  return (
    <SettingsCard title="Plan">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-primary/10 text-primary font-display text-sm font-bold tracking-wide">
              {meta.label}
            </span>
            {meta.priceLabel && <span className="font-body text-sm text-muted">{meta.priceLabel}</span>}
          </div>
          {trial != null && (
            <p className={cn('font-body text-xs', trial <= 2 ? 'text-amber-400' : 'text-muted')}>
              Trial — {trial} {trial === 1 ? 'day' : 'days'} left
            </p>
          )}
          {!isFree && (
            <p className="font-body text-xs text-muted">
              {skuLimit != null ? `${skuLimit} SKUs` : 'Unlimited SKUs'}
              {maxCompetitors != null ? ` · up to ${maxCompetitors} competitors/product` : ''}
              {` · refresh ${meta.refreshLabel}`}
            </p>
          )}
        </div>
        {isFree ? (
          <a
            href="/pricing"
            className="gradient-primary-cta btn-ripple px-5 py-2.5 rounded-xl font-semibold text-sm shrink-0"
          >
            Start 14-day trial
          </a>
        ) : (
          <a href="/pricing" className="font-body text-sm text-primary hover:underline shrink-0">
            Change plan
          </a>
        )}
      </div>
    </SettingsCard>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/settings/plan-card.tsx
git commit -m "feat(settings): plan card (badge, trial countdown, limits, CTA)"
```

---

### Task 8: `usage-card.tsx`

**Files:**
- Create: `components/dashboard/settings/usage-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/settings/usage-card.tsx`:

```tsx
'use client'

import SkuMeter from '@/components/dashboard/sku-meter'
import SettingsCard from './settings-card'

export default function UsageCard({
  plan,
  used,
  limit,
  maxCompetitors,
  error,
}: {
  plan: string
  used: number
  limit: number | null
  maxCompetitors: number | null
  error?: boolean
}) {
  if (plan === 'free') {
    return (
      <SettingsCard title="Usage">
        <p className="font-body text-sm text-muted">
          Free accounts don’t track competitors. Start a 14-day trial to monitor live prices and get signals.
        </p>
        <a
          href="/pricing"
          className="gradient-primary-cta btn-ripple self-start px-5 py-2.5 rounded-xl font-semibold text-sm"
        >
          Start 14-day trial
        </a>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard title="Usage">
      {error ? (
        <p className="font-body text-sm text-rose-400">Couldn’t load usage — refresh to retry.</p>
      ) : (
        <>
          <SkuMeter used={used} limit={limit} maxCompetitors={maxCompetitors} />
          <a href="/pricing" className="font-body text-sm text-primary hover:underline self-start">
            Need more SKUs? Add-on packs →
          </a>
        </>
      )}
    </SettingsCard>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/settings/usage-card.tsx
git commit -m "feat(settings): usage card (SkuMeter + add-on link / free trial prompt)"
```

---

### Task 9: Rewire `settings/page.tsx` as orchestrator

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx` (full rewrite — replaces inline cards with composed components)

- [ ] **Step 1: Replace the page**

Overwrite `app/(dashboard)/settings/page.tsx` with:

```tsx
'use client'

import { useMerchant, useProducts } from '@/lib/api'
import PlanCard from '@/components/dashboard/settings/plan-card'
import UsageCard from '@/components/dashboard/settings/usage-card'
import ShopifyCard from '@/components/dashboard/settings/shopify-card'
import NotificationsCard from '@/components/dashboard/settings/notifications-card'
import AccountCard from '@/components/dashboard/settings/account-card'
import EclipseIntervalCard from '@/components/dashboard/settings/eclipse-interval-card'

export default function SettingsPage() {
  const { data: merchant, isLoading, error } = useMerchant()
  const products = useProducts()

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">Settings</h1>
        <p className="font-body text-sm text-muted mt-1">
          Manage your plan, usage, store connection, and account.
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : error || !merchant ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 font-body text-sm text-rose-300">
          Couldn’t load your settings. Refresh to try again.
        </div>
      ) : (
        <>
          <PlanCard
            plan={merchant.plan}
            trialEndsAt={merchant.trial_ends_at}
            skuLimit={products.data?.sku_limit ?? null}
            maxCompetitors={merchant.max_competitors_per_sku}
          />
          <UsageCard
            plan={merchant.plan}
            used={products.data?.sku_used ?? 0}
            limit={products.data?.sku_limit ?? null}
            maxCompetitors={products.data?.max_competitors_per_sku ?? merchant.max_competitors_per_sku}
            error={!!products.error}
          />
          {merchant.plan === 'eclipse' && <EclipseIntervalCard intervalMs={merchant.eclipse_interval_ms} />}
          <ShopifyCard merchant={merchant} />
          {merchant.plan !== 'free' && <NotificationsCard enabled={merchant.email_notifications_enabled} />}
          <AccountCard />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build + full test suite**

Run: `npm run build`
Expected: `✓ Compiled successfully`; `/settings` route listed.

Run: `npm test -- --run`
Expected: all suites pass, including the new `plan-meta` and `trial` tests.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/settings/page.tsx"
git commit -m "feat(settings): rewire page as orchestrator with free/paid branch"
```

---

## Self-Review

**Spec coverage:**
- §4 file structure → Tasks 1–9 create exactly those files. ✔
- §5 plan-meta → Task 1. §6 trial → Task 2. ✔
- §7.1 Plan card → Task 7 (trial countdown, limits summary, free trial CTA). ✔
- §7.2 Usage card incl. free prompt + usage-error → Task 8. ✔
- §7.3 Shopify (verbatim) + §7.4 Notifications (paid-only, error path) → Task 4; paid-only gating in Task 9. ✔
- §7.5 Account → Task 5. §7.6 ECLIPSE interval → Task 6 + Task 9 gating. ✔
- §7.7 composition order (Plan→Usage→Eclipse→Shopify→Notifications→Account; free omits Eclipse/Notifications) → Task 9. ✔
- §8 states: loading skeleton, merchant-error banner, usage-card degrade, mutation errors, sign-out redirect → Tasks 4/6/8/9. ✔
- §9 testing: pure-logic tests only → Tasks 1–2; components verified by build. ✔
- §10 out of scope: no backend/DB/dep changes — only `lib/api.ts` type-union widening (frontend type only). ✔

**Placeholder scan:** none — every code step has complete code.

**Type consistency:** `planMeta(plan: string)`, `daysLeft(trialEndsAt: string | null)`, `SettingsCard({title, children})`, `PlanCard({plan, trialEndsAt, skuLimit, maxCompetitors})`, `UsageCard({plan, used, limit, maxCompetitors, error})`, `ShopifyCard({merchant: Merchant})`, `NotificationsCard({enabled})`, `EclipseIntervalCard({intervalMs})` — all prop names match their call sites in Task 9. `Merchant.plan` widened (Task 1) so `merchant.plan === 'free'`/`!== 'free'` compile. `useUpdateMerchant` body `{ eclipse_interval_ms }` / `{ email_notifications_enabled }` matches the existing `Partial<Pick<Merchant,'eclipse_interval_ms'|'email_notifications_enabled'>>` signature. ✔

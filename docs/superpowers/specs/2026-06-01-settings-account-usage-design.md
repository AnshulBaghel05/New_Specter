# SPECTER — Settings + Account/Usage (Design Spec)

> **Status:** Approved direction, pending spec review.
> **Date:** 2026-06-01
> **Scope:** Spec 2 of 3 in the dashboard expansion — the **frontend Settings page** (account + plan + usage), plus extraction of the existing inline cards into focused components. **WooCommerce connection** is split out into its own spec (it is a backend integration on par with Shopify F1). **Billing/Razorpay** and the **account deletion / data-export "danger zone"** are deferred to Spec 3.
> **Decision style:** lean v1 — frontend-only, no backend changes; reuse the existing `useMerchant` / `useProducts` hooks and `sku-meter.tsx`; one single-scroll page of stacked cards.

---

## 1. Goal

Turn the minimal Settings page (Plan badge + Shopify connect + email toggle) into a complete self-serve Settings surface: the merchant can see their plan and trial status, their SKU usage against plan limits (using the canonical SKU definition), manage their store connection and notifications, control the ECLIPSE refresh interval, and manage account basics (email, sign out, support). FREE-plan accounts see a tailored, trial-nudging variant.

**Non-goals (this spec):** WooCommerce, billing/subscription changes, account deletion, data export, granular per-event notification toggles, display-name/timezone editing (all need backend work or belong to later specs).

---

## 2. Background & Constraints

- The page already exists at `app/(dashboard)/settings/page.tsx` (~240 lines, all cards inline): a Plan card, a `ShopifyCard` (connect / reconnect / disconnect), and a `NotificationsCard` (single email toggle).
- **No backend changes.** Everything is served by endpoints that already exist:
  - `GET /merchants/me` → `plan`, `trial_ends_at`, `shopify_domain`, `shopify_connected`, `shopify_reconnect_required`, `eclipse_interval_ms`, `max_competitors_per_sku`, `auto_reprice_enabled`, `email_notifications_enabled`.
  - `GET /products` → `sku_used`, `sku_limit`, `max_competitors_per_sku` (shared TanStack cache with the Products tab — no extra fetch).
  - `PATCH /merchants/me` already accepts `email_notifications_enabled` and `eclipse_interval_ms` (validated server-side to 300000–900000 ms).
  - `POST /merchants/shopify/disconnect`, `GET /merchants/shopify/oauth` (existing flow).
  - Supabase browser client → account email (`auth.getUser()`) and `auth.signOut()`.
- **SKU definition is canonical** (see PRICING.md / ARCHITECTURE.md): *1 SKU = one of your products tracked against one competitor = one competitor scrape per cycle.* The Usage card reuses `components/dashboard/sku-meter.tsx`, which already renders this copy.
- **Plan hierarchy includes `free`** (PLG redesign): `['free','recon','cipher','phantom','predator','eclipse']`. FREE accounts track nothing (calculators only).
- **Testing rule (CLAUDE.md):** unit-test pure logic only — **no** component or page tests.

---

## 3. Architecture & Data Flow

`settings/page.tsx` is the single data-fetcher and orchestrator (client component). It calls `useMerchant()` and `useProducts()`, then composes cards, branching once on `plan === 'free'`. Cards receive plain props; the only card that fetches anything itself is `account-card.tsx` (reads the Supabase user for the email). Mutations reuse existing hooks (`useUpdateMerchant`, `useDisconnectShopify`), which already invalidate the `merchant` query.

```
[settings/page.tsx]
  ├── useMerchant()    → plan, trial, shopify_*, notif, eclipse_interval_ms
  ├── useProducts()    → sku_used, sku_limit, max_competitors_per_sku
  └── branch plan==='free' ? FreeComposition : PaidComposition
        └── renders cards (props only)
              account-card → supabase.auth.getUser() (email), signOut()
              notifications/eclipse/shopify → useUpdateMerchant / useDisconnectShopify
```

---

## 4. File Structure

```
app/(dashboard)/settings/page.tsx               thin orchestrator: fetch + compose + free/paid branch
components/dashboard/settings/
  settings-card.tsx        shared <Card title>{children}</Card> shell (lifted from current inline Card)
  plan-card.tsx            tier badge, price, trial countdown, plan-limits summary, change-plan / trial CTA
  usage-card.tsx           SkuMeter + limits + add-on link (paid) OR trial prompt (free)
  shopify-card.tsx         MOVED verbatim from page.tsx (connect / reconnect / disconnect)
  notifications-card.tsx   MOVED verbatim from page.tsx (email toggle); paid/trial only
  account-card.tsx         account email, Sign out, Support link
  eclipse-interval-card.tsx  ECLIPSE-only 5–15 min refresh control
lib/dashboard/plan-meta.ts  pure: PLAN_META[plan] → { label, priceLabel, refreshLabel }
lib/dashboard/trial.ts      pure: daysLeft(trial_ends_at: string|null) → number|null
tests:
lib/dashboard/plan-meta.test.ts
lib/dashboard/trial.test.ts
```

Each card is a small focused unit. `page.tsx` shrinks to fetch + branch + compose. `ShopifyCard`/`NotificationsCard` move out unchanged (no behavior change beyond relocation).

---

## 5. `lib/dashboard/plan-meta.ts`

Static display metadata only — **limits come live from the API** (`sku_limit`, `max_competitors_per_sku`) to avoid drift; refresh cadence and price are not in the API, so they live here.

```
PLAN_META: Record<string, { label: string; priceLabel: string; refreshLabel: string }>
  free     → { 'Free',     '$0',       '—'          }
  recon    → { 'RECON',    '$79/mo',   'every 6 hr' }
  cipher   → { 'CIPHER',   '$249/mo',  'every 3 hr' }
  phantom  → { 'PHANTOM',  '$699/mo',  'every 2 hr' }
  predator → { 'PREDATOR', '$1,799/mo','every 1 hr' }
  eclipse  → { 'ECLIPSE',  'Custom',   '5–15 min'   }

planMeta(plan): returns PLAN_META[plan] ?? { label: plan.toUpperCase(), priceLabel: '', refreshLabel: '—' }
```

## 6. `lib/dashboard/trial.ts`

```
daysLeft(trialEndsAt: string | null): number | null
  - null / invalid / unparseable input → null
  - past date (ends ≤ now) → null
  - otherwise → Math.ceil((end - now) / 86_400_000)   // future → positive integer; same-day future → 1; exact now → null
```

---

## 7. Card Behavior

### 7.1 Plan card (`plan-card.tsx`)
**Paid/trial:** tier badge (`planMeta.label`) + `priceLabel`; if `daysLeft(trial_ends_at)` is non-null, show "Trial — N days left" (amber when ≤ 2); limits summary line `{sku_limit} SKUs · up to {max_competitors_per_sku} competitors/product · refresh {refreshLabel}` (omit a value if its source is null, e.g. ECLIPSE unlimited → "Unlimited SKUs"); "Change plan →" link to `/pricing`.

**Free:** "Free / $0" badge + a prominent **Start 14-day trial** CTA → `/pricing`.

### 7.2 Usage card (`usage-card.tsx`)
**Paid/trial:** `<SkuMeter used={sku_used} limit={sku_limit} maxCompetitors={max_competitors_per_sku} />` (renders canonical SKU copy) + a "Need more SKUs? Add-on packs →" link to `/pricing`. If `useProducts` errored, render an inline "Couldn't load usage — refresh to retry" line instead of the meter (rest of page unaffected).

**Free:** no meter (free tracks nothing) — "Free accounts don't track competitors. Start a 14-day trial to monitor live prices and get signals." + **Start 14-day trial** CTA → `/pricing`.

### 7.3 Shopify card (`shopify-card.tsx`)
Moved verbatim from current `page.tsx`. Three states preserved: connected+healthy (disconnect), connected+reconnect-required (reconnect), not-connected (connect form). Shown on all plans.

### 7.4 Notifications card (`notifications-card.tsx`)
Moved verbatim (single `email_notifications_enabled` toggle via `useUpdateMerchant`). **Shown on paid/trial only** — hidden for FREE (no alerts are generated for free accounts). Adds a failure path: on mutation error the toggle re-enables and a small inline error message shows.

### 7.5 Account card (`account-card.tsx`)
All plans. Shows account email from Supabase `auth.getUser()` (→ "—" if unavailable); **Sign out** → `await supabase.auth.signOut()` then `router.push('/sign-in')`; **Support** → `mailto:support@specterapp.io`.

### 7.6 ECLIPSE interval card (`eclipse-interval-card.tsx`)
Rendered only when `plan === 'eclipse'`. A 5–15 minute control bound to `eclipse_interval_ms` (300000–900000), saved via `useUpdateMerchant({ eclipse_interval_ms })`. Client validation mirrors the backend bounds; out-of-range is blocked before submit. On mutation error, show inline error and keep the prior value.

### 7.7 Composition order
- **Paid/trial:** Plan → Usage → (Eclipse, if `plan==='eclipse'`) → Shopify → Notifications → Account
- **Free:** Plan(trial CTA) → Usage(trial prompt) → Shopify → Account

---

## 8. States & Error Handling

- **Loading** (`useMerchant` pending): existing 3-card skeleton.
- **`useMerchant` error:** top-level error banner (Products-page style); no cards rendered.
- **`useProducts` error:** only the Usage card degrades (inline message); all other cards render.
- **Supabase `getUser` failure:** Account card email "—"; Sign out still works.
- **Mutation errors** (toggle / eclipse / disconnect): control re-enables, inline error under it, no global crash.
- **Sign out:** explicit redirect to `/sign-in` after `signOut()` (middleware also enforces).

---

## 9. Testing

Pure logic only (no component/page tests, per CLAUDE.md):
- `plan-meta.test.ts`: each known plan returns expected `{label, priceLabel, refreshLabel}`; unknown plan falls back to uppercased label + `refreshLabel '—'`.
- `trial.test.ts`: `daysLeft` — future date → positive integer (ceil); ~now/past → null; null/invalid input → null.

Manual verification: build clean (`npm run build`), the `/settings` route renders for free, trial, paid (RECON/CIPHER/PHANTOM/PREDATOR), and ECLIPSE plan states without errors.

---

## 10. Out of Scope (this spec)

- **WooCommerce connection** → own spec (backend auth via REST API consumer key/secret + import + scrape/reprice adapters; merchant-model columns). Not OAuth like Shopify.
- **Billing / Razorpay**, **account deletion / data export "danger zone"** → Spec 3.
- **Granular per-event notification toggles, display name, timezone** → need `MerchantPatch` additions; deferred until requested.
- No new backend endpoints, no DB/schema changes, no new dependencies.

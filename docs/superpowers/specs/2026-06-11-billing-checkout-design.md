# SPECTER — Billing & Checkout Wiring (Design Spec)

**Date:** 2026-06-11
**Status:** Approved (design session) — ready for implementation plan
**Repos:** `specter-web` (Next.js) + `specter-api` (FastAPI)
**Supersedes:** none (first billing-UI design)

## Problem

The Razorpay billing backend is fully implemented (`routers/billing.py`,
`services/billing.py`) and the trial endpoint exists
(`routers/merchants.py::start_trial`), but **no frontend code calls any of them.**
A visitor cannot start a trial, subscribe, pay, upgrade, downgrade, or cancel
through the product. This is the single launch-blocking gap (Audit issue #1,
Sev 10): a SaaS with no checkout. The goal of this work is one verified,
end-to-end revenue path:

> **Visitor → Signup → Trial → Checkout → Paid Plan → Dashboard**

Everything else (blog, free tools, scraper, infra) is explicitly out of scope
until this path is functional.

## Goals

1. Pricing CTA → Checkout (authenticated) for self-serve plans.
2. Trial CTA → `POST /merchants/start-trial` (no card), from the free plan.
3. Upgrade modal (PQL) → Checkout.
4. Billing **success** and **cancel** return routes.
5. Subscription management UI (plan, renewal date, upgrade/downgrade, **cancel at
   period end**, add-ons).
6. Razorpay publishable-key integration (embedded checkout + hosted fallback).
7. Webhook verification and plan-elevation validation, including a new
   `subscription.cancelled` handler for end-of-period downgrade.

## Non-Goals

- PREDATOR / ECLIPSE self-serve checkout — these stay **contact-sales** (the
  pricing page already routes them to a lead-capture modal). Self-serve =
  **RECON / CIPHER / PHANTOM** only.
- Proration math on upgrade — Razorpay handles billing; we elevate on webhook.
- Dunning / failed-payment retry UX beyond what Razorpay sends.
- Invoices / receipts surface (Razorpay hosts these).

---

## Key Architectural Facts (grounding)

These are verified from the current backend and constrain the design:

- **Billing is Razorpay _subscriptions_, not one-time orders.** `/billing/subscribe`
  and `/billing/upgrade` call `billing.create_subscription(plan_id, …)` and return
  `SubscriptionOut { subscription_id, status, short_url }`. `short_url` is the
  Razorpay-hosted checkout page.
- **Plan elevation is webhook-driven, not instant.** The subscribe/upgrade
  endpoints only _start_ the subscription and persist `razorpay_subscription_id`.
  `merchants.plan` is raised only when Razorpay POSTs `subscription.activated` /
  `subscription.charged` to `/billing/webhook` (HMAC-verified). **The frontend
  cannot trust checkout completion to mean "I'm on the plan now" — it must poll
  `GET /merchants/me` after checkout.**
- **`RAZORPAY_KEY_ID` is the publishable key** used both as REST basic-auth user
  (backend) and as the `key` for the embedded checkout.js widget (frontend, via a
  new `NEXT_PUBLIC_RAZORPAY_KEY_ID`).
- **Trial is always RECON.** `start_trial` sets `plan=recon` + 14-day
  `trial_ends_at` and 409s if not currently `free`. The plan clicked on the
  pricing card is irrelevant to the trial — the trial is a single fixed offer.
- **Downgrade is immediate** (`/billing/downgrade` pauses excess SKUs, drops
  add-ons, applies plan in-DB). **Cancellation, per this design, is _not_
  immediate** — see below.

---

## Design Decisions (approved)

### 1. Checkout: embedded modal + hosted fallback
Use Razorpay **checkout.js** (`https://checkout.razorpay.com/v1/checkout.js`) for
an in-page modal keyed with `NEXT_PUBLIC_RAZORPAY_KEY_ID` and
`subscription_id`. If the script fails to load (CSP, ad-block, network) or the
key is missing, fall back to opening `short_url` (the hosted page) in the same
tab. Both paths converge on the **success route**, which polls `/merchants/me`.

### 2. Dual CTA per pricing card
Each self-serve plan card (RECON / CIPHER / PHANTOM) shows **two** actions:
- **Start 14-day trial** → `POST /merchants/start-trial` (no card), then dashboard.
- **Buy {plan}** → checkout for that plan + cadence.

PREDATOR / ECLIPSE keep their single **Contact sales** action (lead modal,
unchanged).

### 3. Intent preservation across signup
A logged-out visitor who clicks Buy/Trial must not lose their choice through the
Supabase email-confirm round-trip. Persist a small **billing intent** object in
`localStorage` (`specter.billing_intent`) `{ action: 'trial' | 'buy', plan,
cadence, ts }`, redirect to `/sign-up`, and on first authenticated dashboard
load **resume the intent once** (then clear it). TTL-guard with `ts` (e.g. 1h)
so a stale intent never auto-charges.

### 4. Subscription elevation is idempotent and webhook-authoritative
The success page polls `GET /merchants/me` until `plan` reflects the purchase (or
a timeout shows "payment received, finalizing…"). The webhook handler is the only
writer of paid-plan elevation; it is safe to receive `activated` and `charged`
for the same subscription (idempotent set of `plan`, clears `trial_ends_at`,
`read_only=False`, sets competitor ceiling).

### 5. Cancellation = **cancel at end of billing period** (changed from immediate)
> Industry standard (Stripe / Shopify / HubSpot / Notion). A customer who paid for
> the period keeps access until it ends; auto-renew stops. Immediate-to-free
> creates "I paid and lost access" support tickets.

**Flow:**
1. User clicks **Cancel subscription** in Settings → Billing.
2. Frontend calls `POST /billing/cancel` → backend calls
   `billing.cancel_subscription(sub_id, cancel_at_cycle_end=True)` (Razorpay
   already supports this param) and stamps `subscription_cancel_at` on the
   merchant.
3. UI shows: **"Cancels on {date} — you retain {PLAN} access until then."**
4. At period end, Razorpay POSTs `subscription.cancelled`; the webhook drops the
   merchant to `free` using the **same to-free transition** the downgrade path
   uses (pause SKUs over the free ceiling, drop add-ons), then clears the
   subscription fields.

This requires three backend additions beyond the original immediate-cancel design:
- **(a)** `POST /billing/cancel` endpoint (calls `cancel_subscription` with
  `cancel_at_cycle_end=True`, persists `subscription_cancel_at`).
- **(b)** Webhook handles `subscription.cancelled` → to-free transition.
- **(c)** Migration **0012** adds `subscription_current_end` (next renewal,
  populated from webhook `current_end`) and `subscription_cancel_at` (set on
  cancel) to `merchants`, so the UI can render "Next renewal: Jul 10" /
  "Cancels on Jul 10". The to-free logic (pause SKUs, drop add-ons, set ceiling)
  is extracted from `downgrade` into a shared helper reused by the cancelled
  webhook branch.

### 6. Full self-serve subscription management
Settings → Billing renders the current plan, renewal/cancel date, an
**Upgrade/Downgrade** control (to other self-serve plans), **Cancel
subscription** (period-end), and **add-on** management (list/add/remove via the
existing `/billing/addon` routes + a new `GET /billing/addons` read).

---

## User Journey (canonical happy path)

```
Visitor on /pricing
  │  clicks "Buy CIPHER" (monthly)
  ▼
Logged out?  ── yes ──► persist intent {buy, cipher, monthly} → /sign-up
  │                         │ email confirm round-trip
  │ no                      ▼
  │                     first authed dashboard load → resume intent once → (continue)
  ▼
POST /billing/subscribe {plan:cipher, cadence:monthly}
  → { subscription_id, short_url }
  ▼
Embedded checkout.js modal (key + subscription_id)   ──fallback──►  open short_url
  │  user pays
  ▼
Razorpay → /billing/success?... (frontend route)
  │  poll GET /merchants/me every ~2s (max ~30s)
  │        (meanwhile Razorpay POSTs subscription.activated → webhook elevates plan)
  ▼
plan === cipher ?  ── yes ──► toast "You're on CIPHER" → /dashboard
                   ── timeout ─► "Payment received — finalizing your plan. Refresh in a minute."
```

Trial path is shorter: `POST /merchants/start-trial` → `me` now `recon` +
`trial_ends_at` → dashboard with a trial banner. Cancel path: Settings → Cancel →
period-end notice; no immediate access change.

---

## Components & Files

### Frontend (`specter-web`)

| File | Responsibility |
|---|---|
| `lib/billing/checkout.ts` (new) | Pure-ish client helpers: `loadCheckoutScript()`, `openCheckout({subscriptionId, onSuccess, onDismiss})`, `openHostedFallback(shortUrl)`. No React. |
| `lib/billing/intent.ts` (new) | `saveIntent`, `readIntent`, `clearIntent`, `isFresh(intent)` over `localStorage` key `specter.billing_intent`. Pure, unit-tested. |
| `lib/api.ts` (modify) | Add hooks: `useStartTrial()`, `useSubscribe()`, `useUpgrade()`, `useDowngrade()`, `useCancelSubscription()`, `useAddons()`, `useAddAddon()`, `useRemoveAddon()`. All `previewFn`-wrapped (preview = no-op/optimistic). |
| `app/(marketing)/pricing/page.tsx` (modify) | Dual CTA per self-serve card → trial/buy handlers; PREDATOR/ECLIPSE unchanged. Auth-aware: logged-out persists intent + routes to `/sign-up`. |
| `app/(dashboard)/billing/success/page.tsx` (new) | Polls `/merchants/me`, shows finalizing/landed states, routes to `/dashboard`. `noindex`. |
| `app/(dashboard)/billing/cancel/page.tsx` (new) | "Checkout cancelled — no charge" + back to pricing. `noindex`. |
| `components/dashboard/billing-card.tsx` (new) | Settings → Billing: plan, renewal/cancel date, upgrade/downgrade, cancel-at-period-end, add-ons. |
| `components/dashboard/pql-upgrade-modal.tsx` (modify) | "Start trial" CTA → `useStartTrial()` (was a `/pricing` link); "Upgrade" → checkout. |
| `hooks/use-resume-intent.ts` (new) | Runs once on authed dashboard mount; resumes a fresh intent, then clears it. |
| `types/index.ts` (modify) | Extend `Merchant` with `subscription_current_end?`, `subscription_cancel_at?`; add `Addon` type. |

### Backend (`specter-api`)

| File | Responsibility |
|---|---|
| `models/merchants.py` (modify) | Add `subscription_current_end` + `subscription_cancel_at` (nullable timestamptz). |
| `alembic/versions/0012_subscription_periods.py` (new) | Migration for the two columns (+ Supabase SQL mirror). |
| `routers/billing.py` (modify) | New `POST /cancel` (cancel_at_cycle_end=True + stamp `subscription_cancel_at`); new `GET /addons`; extract `_apply_to_free(session, merchant)` shared helper; webhook handles `subscription.cancelled` and stamps `subscription_current_end` on activate/charge. |
| `routers/merchants.py` (modify) | `MerchantOut` + `get_me` expose `subscription_current_end` / `subscription_cancel_at`. |

### Config / Deploy

- **`NEXT_PUBLIC_RAZORPAY_KEY_ID`** in `specter-web` env (publishable key).
- Razorpay dashboard: register `https://specter-api.railway.app/billing/webhook`
  for `subscription.activated`, `subscription.charged`, `subscription.cancelled`;
  set `RAZORPAY_WEBHOOK_SECRET`.
- `RAZORPAY_PLAN_<PLAN>_<CADENCE>` plan ids configured for the 6 self-serve
  (plan × cadence) combinations.

---

## Error Handling & Edge Cases

- **checkout.js blocked / key missing** → hosted `short_url` fallback (same tab).
- **Webhook latency** → success page polls with timeout + a friendly "finalizing"
  state; never asserts failure on slow elevation.
- **Already trialed / paid (409 on start-trial)** → toast "You've already used your
  trial" and route to checkout instead.
- **Upgrade not-an-upgrade / downgrade not-a-downgrade (400)** → surfaced inline in
  the billing card (the backend already guards plan ordering).
- **Cancel when already cancelling** → idempotent; UI shows the existing
  `subscription_cancel_at` date.
- **Preview mode (`NEXT_PUBLIC_PREVIEW`)** → all billing hooks no-op/optimistic;
  no network; checkout disabled with a "demo mode" note (matches the existing
  `lib/api.ts` / `calculations-api.ts` preview pattern).
- **Stale intent** → `isFresh` TTL guard prevents an old localStorage intent from
  auto-opening checkout on a much later sign-in.

---

## Testing Strategy

Repo rule: **test pure logic only**, never UI/marketing components.

**Backend (`pytest`):**
- `POST /billing/cancel` → calls cancel with `cancel_at_cycle_end=True`, stamps
  `subscription_cancel_at`, returns the date; auth-isolated.
- Webhook `subscription.cancelled` → drops plan to `free`, pauses SKUs over the
  free ceiling, drops add-ons, clears subscription fields; HMAC-verified.
- Webhook `subscription.activated/charged` → stamps `subscription_current_end`.
- `GET /billing/addons` → returns this merchant's add-ons only.
- Shared `_apply_to_free` helper parity between downgrade and cancelled webhook.

**Frontend (`vitest`, pure modules only):**
- `lib/billing/intent.ts` — save/read/clear/`isFresh` TTL behavior.
- `lib/billing/checkout.ts` — fallback selection logic (script-present vs absent,
  key-present vs missing) with the DOM/script load mocked at the boundary.
- No tests for `pricing/page.tsx`, `billing-card.tsx`, success/cancel pages, or
  the modal (UI).

**Manual end-to-end (the verification that matters):**
Visitor → Buy → sign-up → resume intent → checkout (test key) → success poll →
dashboard on plan. Plus: trial path, upgrade, downgrade, cancel-at-period-end
(verify access retained + date shown), add-on add/remove.

---

## Out-of-Scope Follow-ups (noted, not built now)

- Proration display on upgrade.
- Invoice/receipt surface in-app.
- Failed-payment dunning UX.
- Annual/monthly toggle persistence beyond the pricing page.

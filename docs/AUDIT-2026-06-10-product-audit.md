# SPECTER — Full Product & Codebase Audit (2026-06-10)

**Method.** Findings below are traced through the actual source (frontend ↔ backend
contract, auth, data flow) and corroborated by running both test suites
(`specter-web`: 441 passing; `specter-api`: 337 passing) plus `tsc`/lint. A literal
click-through "as a paying user" requires the full stack running against live
Supabase/Redis (creds flagged for rotation), so user-flow findings come from
end-to-end request/response tracing, not a fabricated screen narrative. Every
issue marked **FIXED** was changed and re-verified; every issue marked **FLAG**
is verified-real but deferred (needs product decisions, credentials, or a feature
build that shouldn't be half-wired).

Severity is 1 (cosmetic) – 10 (launch-blocking).

---

## What is solid (verified)

- **API contract is clean.** All 22 endpoints the web client calls
  (`lib/api.ts`, `lib/calculations-api.ts`) match a backend route with the right
  method/path/prefix. No broken-contract bugs.
- **Auth/signup correct.** First sign-in creates `plan="free"`
  (`auth/supabase.py:138`); middleware guards all 9 dashboard routes and bounces
  authed users off `/sign-in`/`/sign-up` (`middleware.ts`).
- **Paid-tab gating is graceful.** 403s render `LockedValueCard` upgrade gates
  (e.g. `repricing/page.tsx:81`), not crashes. Overview shows adaptive
  `GettingStarted` onboarding for new users.
- **Both test suites green; web build prerenders 61 routes.** Tools are
  client-side and unit-tested; Shopify connect is wired (`settings/shopify-card.tsx`).

---

## Issues

### 1. No in-app billing / trial activation — a SaaS with no checkout — **Sev 10 — FLAG**
- **Location:** `app/(marketing)/pricing/page.tsx` (CTAs → `/sign-up`),
  `components/dashboard/pql-upgrade-modal.tsx` (→ `/pricing`). No caller anywhere
  in `specter-web` of `/billing/subscribe|upgrade|downgrade|addon` or
  `/merchants/start-trial`.
- **What breaks:** A customer cannot subscribe, pay, or start a trial through the
  product. The Razorpay billing backend (`routers/billing.py`) and the trial
  endpoint (`routers/merchants.py:237`) are fully implemented but have **zero**
  frontend callers. Conversion is impossible end-to-end.
- **Root cause:** Billing shipped backend-only (Prompt 15). The checkout / trial
  activation UI (Razorpay order → handler → `/billing/subscribe`) was never built.
- **Why flagged not fixed:** This is a feature, not a bug fix — it needs Razorpay
  publishable keys, a checkout UX decision, and a webhook callback URL. Half-wiring
  payments is worse than not. **Top priority for next session** (start with the
  brainstorming flow).

### 2. Dead conversion loop for logged-in free users — **Sev 7 — FLAG**
- **Location:** `pricing/page.tsx` (`tier.ctaHref ?? '/sign-up'`) + `middleware.ts:64–71`.
- **What breaks:** A signed-in `free` user who clicks "Start free trial" on
  `/pricing` is redirected `/sign-up → /dashboard` by middleware. Nothing happens —
  no trial, no upgrade, no feedback. The single most important CTA is a no-op for
  exactly the users most likely to convert.
- **Root cause:** Pricing CTAs hardcode `/sign-up` regardless of auth state; there
  is no authenticated "start trial / upgrade" path (see #1).
- **Resolution:** Resolved by #1's trial/billing wiring (authed CTA →
  `POST /merchants/start-trial` or checkout). Do not band-aid before #1.

### 3. Workspace errors in preview/demo mode — **Sev 5 — FIXED**
- **Location:** `lib/calculations-api.ts`, `lib/use-migrate-scenarios.ts`.
- **What broke:** In `NEXT_PUBLIC_PREVIEW` mode (the zero-setup local/demo path),
  `calculations-api.ts` ignored `PREVIEW` and fetched `localhost:8000`, so the
  Workspace + Opportunity Feed **errored** while every other dashboard surface
  rendered clean empty fixtures via `lib/api.ts`. Inconsistent, broken demo.
- **Root cause:** `calculations-api.ts` was written without the `PREVIEW`
  short-circuit pattern that `lib/api.ts` uses everywhere else.
- **Fix:** Added `PREVIEW` paths (empty saved-reports list + optimistic mutations)
  so the Workspace shows a clean empty state. Also guarded `useMigrateScenarios`
  to **skip in preview** — without this, optimistic "successful" saves would have
  cleared the user's local scenarios with nothing persisted (a data-loss
  regression the fix itself would have introduced). Verified: `tsc` clean, lint
  clean, 441 web tests pass.

### 4. Public copy names the wrong payment processor — **Sev 3 — FLAG**
- **Location:** `app/(marketing)/privacy/page.tsx:206,614`; pricing FAQ (`:218`)
  references Stripe. Backend billing is **Razorpay** (`services/billing.py`).
- **What breaks:** The privacy policy states "All payment processing is handled by
  Stripe" — factually wrong once billing ships; an accuracy/compliance/trust issue.
- **Root cause:** Copy predates the Razorpay decision and was never reconciled.
- **Why flagged:** Legal/privacy text — the processor name should be corrected, but
  legal copy shouldn't be rewritten unilaterally. Surface to owner before launch.

### 5. Free users land on Overview, not the Workspace — **Sev 2 — FLAG**
- **Location:** `middleware.ts` (authed → `/dashboard`), `app/(dashboard)/layout.tsx`
  (reorders nav only; no redirect).
- **What breaks:** Nothing functionally — Overview shows adaptive onboarding — but
  it deviates from the documented intent ("free landing = Workspace").
- **Root cause:** The Overview command-center was built after the master plan; the
  landing was never switched. May be the newer intent; low impact. Product decision.

### 6. Preview bypass keyed on Supabase creds, not the preview flag — **Sev 2 — FLAG**
- **Location:** `middleware.ts:6–11`.
- **What breaks:** If `NEXT_PUBLIC_PREVIEW=1` is set *with* Supabase creds present,
  middleware still enforces auth and redirects the preview dashboard to `/sign-in`.
  Edge case in local/demo setup.
- **Root cause:** Bypass condition checks for absent creds rather than the explicit
  `NEXT_PUBLIC_PREVIEW` flag.

---

## Competitive gaps (for next session)

Informed by category norms (Prisync, Price2Spy, Wiser, Intelligence Node), not a
live feature-by-feature comparison:

1. **In-app checkout + self-serve trial** — table stakes; currently absent (#1).
2. **Bulk competitor import** (CSV / URL list / auto-match) — competitors onboard
   catalogs in minutes; SPECTER appears to require per-URL entry.
3. **Per-SKU price-history charts** on the product/competitor view — only
   attribution trends exist today; rivals show historical competitor price graphs.
4. **Guided onboarding + sample data** — beyond `GettingStarted`, competitors seed
   a demo dataset and a product tour so value is visible pre-connect.
5. **In-app notification center** — alerts are email/Slack/Klaviyo; no in-product
   inbox/history surface.
6. **Scheduled / richer reporting & exports** — only attribution CSV today.
7. **Team & multi-user management** — ECLIPSE tier advertises it; not built.
8. **Mobile-responsive dashboard** — unverified; worth an explicit pass.

---

## Changes made this audit

- `lib/calculations-api.ts` — `PREVIEW` short-circuits for list/detail/save/update/delete.
- `lib/use-migrate-scenarios.ts` — skip migration in preview (prevents local-scenario data loss).
- This document.

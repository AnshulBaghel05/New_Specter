# SPECTER — Toast Feedback Foundation (Design Spec)

> **Status:** Approved direction, pending spec review.
> **Date:** 2026-06-01
> **Scope:** Sub-project **A** of the Dashboard UX Optimization effort (the "insight → action" program). This spec covers **only** the toast feedback foundation: install Sonner, add a globally-styled toaster, guarantee every failed mutation surfaces an error, and add contextual success toasts to every dashboard action. Subsequent sub-projects (B action/deep-link layer, C Overview, D Signals+Alerts, E Products, F Repricing, G Attribution) are **out of scope here** and get their own specs.
> **Decision style:** lean v1 — frontend-only, no backend changes, no new behavior beyond user feedback; reuse the existing `ApiError` shape and TanStack mutation hooks.

---

## 1. Goal

Replace silent mutations and the one raw `window.alert()` (Attribution export) with a single, consistent toast system styled to the dark-intelligence design. After this sub-project, **every** create/update/delete/toggle/connect/export action in the dashboard produces visible success or error feedback, and **no** mutation can fail silently.

**Why first:** every later sub-project (action layer, repricing validation, etc.) adds new actions; having the feedback channel in place first means those specs simply call `toast.*` instead of each re-inventing feedback.

---

## 2. Background & Constraints

- **No backend changes.** This is purely a frontend feedback layer over mutations that already exist.
- **Error shape is known.** `lib/api.ts` throws `ApiError { status: number; body: ApiErrorBody | null }`, where `ApiErrorBody` may carry `message` and/or `error`. The global error handler extracts a human string from this.
- **QueryClient lives in `components/providers/query-provider.tsx`** (a `'use client'` component created once via `useState`). It is the single place to attach a global mutation-error handler and to mount the toaster.
- **Design tokens** (from CLAUDE.md): `--surface #0D0F1A`, `--border #1A1D2E`, `--text #E8EAF0`, `--primary #00E87A` (success), rose-400 `#FB7185` (error), body font DM Sans. Toasts must visually match cards (`bg-surface`, `border-border`, rounded, `text-text`).
- **Testing rule (CLAUDE.md):** unit-test pure logic only — **no** component/toast tests. The only pure unit here is `formatApiError`.
- **Dependency:** add `sonner` (current stable, ^1.x). It is a small, dependency-light, widely-used toast library with first-class dark theming and a `toast.promise` API.

---

## 3. Architecture & Data Flow

Two complementary channels:

1. **Global error net** — a `MutationCache({ onError })` attached to the QueryClient. ANY mutation that rejects (anywhere, now or in future sub-projects) triggers `toast.error(formatApiError(err))`. This is the safety net: even a call site that forgets error handling still surfaces failures.
2. **Contextual success** — each call site adds a `toast.success('<specific copy>')` in its existing `onSuccess` (or after `await mutateAsync`). Success copy is action-specific and therefore lives at the call site, not in the hook.

```
mutation rejects ──▶ MutationCache.onError ──▶ toast.error(formatApiError(err))   [centralized, automatic]
mutation resolves ─▶ call-site onSuccess ────▶ toast.success("Guardrails saved")  [specific copy, per site]
slow op (CSV export) ─▶ toast.loading(...) then toast.success/error({ id })       [export only; boolean return, not a rejecting promise]
```

`<Toaster>` is mounted once inside `QueryProvider` (which already wraps the whole app), so it is available on marketing, auth, and dashboard routes alike with no per-route wiring.

**Note on double-toasting:** because the global net handles *errors*, call sites add **only `onSuccess`** toasts. Call sites do **not** add `onError` toasts (that would double-fire). The one exception is where a call site needs a *more specific* error message than the generic net provides — in that case it sets `meta: { suppressErrorToast?: ... }` — **NOT needed in v1**; all error copy in v1 comes from the global net. (Documented so future specs know the rule.)

---

## 4. File Structure

```
package.json                                   + "sonner" dependency
lib/toast.ts                                   re-export configured `toast`; pure `formatApiError(err): string`
lib/toast.test.ts                              unit tests for formatApiError
components/providers/query-provider.tsx        MODIFY: add MutationCache onError + mount <Toaster>
— call sites (add success toasts / replace alert) —
components/dashboard/settings/notifications-card.tsx
components/dashboard/settings/eclipse-interval-card.tsx
components/dashboard/settings/shopify-card.tsx
app/(dashboard)/repricing/page.tsx
app/(dashboard)/alerts/page.tsx
app/(dashboard)/attribution/page.tsx
components/dashboard/add-product-form.tsx
components/dashboard/competitor-row-menu.tsx
components/dashboard/link-competitor-inline.tsx
```

---

## 5. `lib/toast.ts`

```
import { toast } from 'sonner'        // re-exported for a single import path across the app
export { toast }

formatApiError(err: unknown): string
  - err is ApiError with body?.message (non-empty)  → body.message
  - else err is ApiError with body?.error  (non-empty) → body.error
  - else err instanceof Error with message → err.message
  - else → "Something went wrong. Please try again."
```

`formatApiError` is the ONLY logic that needs a unit test. It must not import React/sonner (pure, testable in isolation). It imports the `ApiError` type from `@/lib/api` for the `instanceof` check.

---

## 6. `components/providers/query-provider.tsx` changes

- Import `MutationCache` from `@tanstack/react-query`, `Toaster` from `sonner`, and `{ toast, formatApiError }` from `@/lib/toast`.
- Pass `mutationCache: new MutationCache({ onError: (err) => toast.error(formatApiError(err)) })` into the `QueryClient` config (keep existing `defaultOptions`).
- Render `<Toaster />` as a sibling of `{children}` inside `QueryClientProvider`, configured:
  - `theme="dark"`, `position="top-right"`, `richColors={false}` (we supply our own tokens), `closeButton`.
  - `toastOptions.classNames` (or `style`) mapping to tokens: container `bg-[#0D0F1A] border border-[#1A1D2E] text-[#E8EAF0]`, success accent `#00E87A`, error accent `#FB7185`, body font DM Sans. (Use Tailwind classes/CSS vars consistent with the rest of the app.)

No other behavior changes; `staleTime`/`refetchInterval`/`retry` defaults stay.

---

## 7. Call-site success copy (exact)

Each row: file → trigger → success toast text. (Errors are handled globally; do **not** add per-site error toasts in v1.)

| File | Action | Success toast |
|------|--------|---------------|
| `settings/notifications-card.tsx` | toggle email notifications | `Notifications updated` |
| `settings/eclipse-interval-card.tsx` | save refresh interval | `Refresh interval saved` |
| `settings/shopify-card.tsx` | disconnect Shopify | `Shopify store disconnected` |
| `repricing/page.tsx` | toggle global auto-reprice | ``Auto-reprice turned ${on ? 'on' : 'off'}`` |
| `repricing/page.tsx` (`SKURow`) | save floor/ceiling | `Guardrails saved` |
| `repricing/page.tsx` (`SKURow`) | toggle per-SKU auto | ``Auto-reprice ${on ? 'enabled' : 'disabled'} for this product`` |
| `alerts/page.tsx` | silence / unsilence | ``Alerts ${silenced ? 'silenced' : 'unsilenced'} for ${domain}`` |
| `add-product-form.tsx` | create product/SKU | `Product added` |
| `link-competitor-inline.tsx` | add competitor URL | `Competitor added` |
| `competitor-row-menu.tsx` | delete competitor | `Competitor removed` |
| `competitor-row-menu.tsx` | silence OOS for URL | ``OOS alerts ${silenced ? 'silenced' : 'unsilenced'}`` |
| `attribution/page.tsx` | export CSV | `downloadAttributionCsv()` returns a **boolean** (resolves `false` on failure, does not reject), so use a loading→result pattern, NOT `toast.promise`: `const id = toast.loading('Preparing export…')`, then on `ok` → `toast.success('Export ready', { id })`, else → `toast.error('Export failed — your plan may not include attribution exports.', { id })`. Remove the `alert()` entirely. |

> The Shopify **connect** flow is a full-page redirect to OAuth (`window.location.href = shopifyOAuthUrl(...)`), so no toast is shown at initiation; the post-OAuth return is handled by the existing redirect. No change needed there beyond leaving it as-is.

Where a call site currently uses `.mutate()` with no `onSuccess`, add an `onSuccess` (either inline on the `mutate` call or on the hook's `useMutation` options at the component — inline-on-`mutate` preferred to keep the success copy next to the action). Toggle-style copy reads the *new* value being set.

---

## 8. States & Error Handling

- **Success:** green-accented toast, ~3s auto-dismiss, with close button.
- **Error:** rose-accented toast from the global net via `formatApiError`; ~5s. A 403 plan-gate error (e.g., attribution export on wrong plan) surfaces its `body.message`.
- **Loading (export only):** a `toast.loading(...)` toast is updated in place to success/error via its `{ id }` once `downloadAttributionCsv()` resolves.
- **Optimistic toggles:** existing components already revert their own optimistic UI on error (e.g., notifications/eclipse cards show inline error). Those inline messages **stay**; the toast is additive (a transient confirmation/notice). No inline error UI is removed in this sub-project.
- **No duplicate toasts:** call sites add success-only; the global net owns errors.

---

## 9. Testing

Pure logic only (no component/toast tests, per CLAUDE.md):
- `lib/toast.test.ts` — `formatApiError`:
  - `new ApiError(400, { error: 'bad', message: 'Floor exceeds ceiling' })` → `'Floor exceeds ceiling'`
  - `new ApiError(403, { error: 'plan_required' })` (no message) → `'plan_required'`
  - `new Error('network down')` → `'network down'`
  - `'weird'` / `null` / `{}` → `'Something went wrong. Please try again.'`

**Manual verification:** `npm run build` clean; with preview mode on, trigger each action and confirm a toast appears (success on the happy path; force an error path — e.g., export on a gated plan — to confirm the error net). Toasts visually match the dark surface cards.

---

## 10. Out of Scope (this sub-project)

- Any new action buttons, deep-links, or "Apply/Raise price" affordances → **Sub-project B**.
- Page-specific redesigns (Overview hero, Signals/Alerts enrichment, Products sorts/filters, Repricing validation+range bar, Attribution top-products) → **Sub-projects C–G**.
- Backend changes of any kind (no new endpoints, no schema, no gating changes).
- Removing existing inline error messages (kept; toasts are additive).
- Per-site custom error copy / `suppressErrorToast` meta (not needed in v1; rule documented for future specs).

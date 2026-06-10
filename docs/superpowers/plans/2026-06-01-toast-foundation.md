# Toast Feedback Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sonner-based toast system to specter-web so every dashboard mutation surfaces success/error feedback and the Attribution `alert()` is replaced.

**Architecture:** A global `MutationCache.onError` net (in `QueryProvider`) toasts every failed mutation via a pure `formatApiError()` helper; each call site adds a contextual `toast.success(...)` in its `onSuccess`/after `await`. The `<Toaster>` mounts once inside `QueryProvider`. No backend changes.

**Tech Stack:** Next.js 14, TypeScript, TanStack Query v5, Sonner, Tailwind (existing `bg-surface`/`border-border`/`text-text` tokens), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-toast-foundation-design.md`

**Conventions for every task:** stage only the exact paths listed (NEVER `git add .` / `git add -A`). End each commit message with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. All paths are relative to `specter-web/` (run git/npm from inside `specter-web/`).

---

### Task 1: Add Sonner + `lib/toast.ts` (`formatApiError`)

**Files:**
- Modify: `package.json` (+ `package-lock.json`) — add `sonner`
- Create: `lib/toast.ts`
- Test: `lib/toast.test.ts`

- [ ] **Step 1: Install Sonner**

Run (from `specter-web/`): `npm install sonner`
Expected: `package.json` gains `"sonner": "^1..."` under dependencies; `package-lock.json` updates; exit 0.

- [ ] **Step 2: Write the failing test**

Create `lib/toast.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatApiError } from './toast'
import { ApiError } from '@/lib/api'

describe('formatApiError', () => {
  it('prefers ApiError body.message', () => {
    expect(formatApiError(new ApiError(400, { error: 'invalid_bounds', message: 'Floor exceeds ceiling' })))
      .toBe('Floor exceeds ceiling')
  })

  it('falls back to ApiError body.error when no message', () => {
    expect(formatApiError(new ApiError(403, { error: 'plan_required' }))).toBe('plan_required')
  })

  it('uses a plain Error message', () => {
    expect(formatApiError(new Error('network down'))).toBe('network down')
  })

  it('returns a generic message for unknown values', () => {
    const generic = 'Something went wrong. Please try again.'
    expect(formatApiError('weird')).toBe(generic)
    expect(formatApiError(null)).toBe(generic)
    expect(formatApiError({})).toBe(generic)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/toast.test.ts`
Expected: FAIL — cannot resolve `./toast` (module not found).

- [ ] **Step 4: Write minimal implementation**

Create `lib/toast.ts`:

```ts
import { ApiError } from '@/lib/api'

// Single import path for toasts across the app.
export { toast } from 'sonner'

/**
 * Extracts a human-readable message from anything thrown by a mutation.
 * Order: ApiError body.message → ApiError body.error → Error.message → generic.
 * Used by the global MutationCache error net and (optionally) call sites.
 */
export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.body?.message) return err.body.message
    if (err.body?.error) return err.body.error
  }
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong. Please try again.'
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/toast.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/toast.ts lib/toast.test.ts
git commit -m "feat(toast): add sonner + formatApiError helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire `QueryProvider` — global error net + `<Toaster>`

**Files:**
- Modify: `components/providers/query-provider.tsx`

No unit test (provider wiring; verified by build + manual). Pure logic already covered in Task 1.

- [ ] **Step 1: Replace the file contents**

Overwrite `components/providers/query-provider.tsx` with:

```tsx
'use client'

import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { toast, formatApiError } from '@/lib/toast'

/**
 * Wraps the app in a TanStack Query client.
 * Defaults: 60s stale time (matches dashboard refetch cadence in ARCHITECTURE.md),
 * one retry, no refetch-on-focus to avoid hammering specter-api.
 *
 * A global MutationCache.onError surfaces an error toast for ANY failed mutation,
 * so no mutation can fail silently. Call sites add their own success toasts.
 */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (err) => toast.error(formatApiError(err)),
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchInterval: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: 'bg-surface border border-border text-text font-body',
            title: 'text-text',
            description: 'text-muted',
            closeButton: 'bg-surface border-border text-muted',
            error: 'border-rose-400/40',
            success: 'border-primary/40',
          },
        }}
      />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (no type errors).

- [ ] **Step 3: Commit**

```bash
git add components/providers/query-provider.tsx
git commit -m "feat(toast): mount Toaster + global mutation error net in QueryProvider

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Success toasts on Settings cards

**Files:**
- Modify: `components/dashboard/settings/notifications-card.tsx`
- Modify: `components/dashboard/settings/eclipse-interval-card.tsx`
- Modify: `components/dashboard/settings/shopify-card.tsx`

Inline error messages already present in these cards STAY (toasts are additive). Add only success toasts.

- [ ] **Step 1: notifications-card.tsx**

Add the import after the existing `useUpdateMerchant` import line:

```tsx
import { toast } from '@/lib/toast'
```

Replace the `onClick` on the toggle button:

```tsx
          onClick={() => update.mutate({ email_notifications_enabled: !enabled })}
```

with:

```tsx
          onClick={() =>
            update.mutate(
              { email_notifications_enabled: !enabled },
              { onSuccess: () => toast.success('Notifications updated') },
            )
          }
```

- [ ] **Step 2: eclipse-interval-card.tsx**

Add after the `useUpdateMerchant` import:

```tsx
import { toast } from '@/lib/toast'
```

Replace the `save` function:

```tsx
  function save() {
    update.mutate({ eclipse_interval_ms: clamped * 60_000 })
  }
```

with:

```tsx
  function save() {
    update.mutate(
      { eclipse_interval_ms: clamped * 60_000 },
      { onSuccess: () => toast.success('Refresh interval saved') },
    )
  }
```

- [ ] **Step 3: shopify-card.tsx**

Add after the existing `useDisconnectShopify` import line:

```tsx
import { toast } from '@/lib/toast'
```

Replace the disconnect button `onClick`:

```tsx
            onClick={() => disconnect.mutate()}
```

with:

```tsx
            onClick={() =>
              disconnect.mutate(undefined, {
                onSuccess: () => toast.success('Shopify store disconnected'),
              })
            }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/settings/notifications-card.tsx components/dashboard/settings/eclipse-interval-card.tsx components/dashboard/settings/shopify-card.tsx
git commit -m "feat(toast): success toasts on settings cards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Success toasts on Repricing

**Files:**
- Modify: `app/(dashboard)/repricing/page.tsx`

Three triggers: global auto toggle (page header), per-SKU Save and per-SKU auto toggle (both in the `SKURow` function in the same file). `SKURow` calls `onSave` which is `skuMut.mutateAsync` (returns a Promise). Use `try/catch` around the awaited calls so a rejection doesn't become an unhandled rejection — the error toast is already produced by the global net.

- [ ] **Step 1: Add the import**

Add after the existing `import { cn } from '@/lib/utils'` line near the top:

```tsx
import { toast } from '@/lib/toast'
```

- [ ] **Step 2: Global auto-reprice toggle**

Replace the header toggle `onClick`:

```tsx
              onClick={() =>
                settingsMut.mutate({
                  auto_reprice_enabled: !data.global_auto_reprice_enabled,
                })
              }
```

with:

```tsx
              onClick={() =>
                settingsMut.mutate(
                  { auto_reprice_enabled: !data.global_auto_reprice_enabled },
                  {
                    onSuccess: () =>
                      toast.success(
                        `Auto-reprice turned ${!data.global_auto_reprice_enabled ? 'on' : 'off'}`,
                      ),
                  },
                )
              }
```

- [ ] **Step 3: Per-SKU Save button (in `SKURow`)**

Replace the Save button `onClick`:

```tsx
          onClick={() =>
            onSave({
              id: sku.id,
              floor_price: floor ? Number(floor) : undefined,
              ceiling_price: ceiling ? Number(ceiling) : undefined,
            })
          }
```

with:

```tsx
          onClick={async () => {
            try {
              await onSave({
                id: sku.id,
                floor_price: floor ? Number(floor) : undefined,
                ceiling_price: ceiling ? Number(ceiling) : undefined,
              })
              toast.success('Guardrails saved')
            } catch {
              /* error toast handled by the global mutation net */
            }
          }}
```

- [ ] **Step 4: Per-SKU auto toggle (in `SKURow`)**

Replace the per-SKU auto toggle `onClick`:

```tsx
            onClick={() => onSave({ id: sku.id, auto_reprice_enabled: !sku.auto_reprice_enabled })}
```

with:

```tsx
            onClick={async () => {
              try {
                await onSave({ id: sku.id, auto_reprice_enabled: !sku.auto_reprice_enabled })
                toast.success(
                  `Auto-reprice ${!sku.auto_reprice_enabled ? 'enabled' : 'disabled'} for this product`,
                )
              } catch {
                /* error toast handled by the global mutation net */
              }
            }}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/repricing/page.tsx"
git commit -m "feat(toast): success toasts on repricing actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Success toast on Alerts silence

**Files:**
- Modify: `app/(dashboard)/alerts/page.tsx`

- [ ] **Step 1: Add the import**

Add after the existing `import { cn } from '@/lib/utils'` line:

```tsx
import { toast } from '@/lib/toast'
```

- [ ] **Step 2: Silence toggle**

Replace the silence button `onClick`:

```tsx
                  onClick={() =>
                    silenceMut.mutate({ alertId: a.id, silenced: !a.silenced })
                  }
```

with:

```tsx
                  onClick={() =>
                    silenceMut.mutate(
                      { alertId: a.id, silenced: !a.silenced },
                      {
                        onSuccess: () =>
                          toast.success(
                            `Alerts ${!a.silenced ? 'silenced' : 'unsilenced'} for ${a.competitor_domain}`,
                          ),
                      },
                    )
                  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/alerts/page.tsx"
git commit -m "feat(toast): success toast on alert silence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Success toasts on Products / Competitors mutations

**Files:**
- Modify: `components/dashboard/add-product-form.tsx`
- Modify: `components/dashboard/link-competitor-inline.tsx`
- Modify: `components/dashboard/competitor-row-menu.tsx`

`link-competitor-inline.tsx` and `competitor-row-menu.tsx` keep their existing inline error UI (the inline copy is more specific, e.g. plan-limit guidance); the global net will also toast on error — this is acceptable (toasts are additive per the spec). Add success toasts only.

- [ ] **Step 1: add-product-form.tsx**

Add after the `import { useCreateSKU } from '@/lib/api'` line:

```tsx
import { toast } from '@/lib/toast'
```

Replace the `submit` function:

```tsx
  async function submit() {
    if (!title.trim()) return
    await create.mutateAsync({ title: title.trim(), current_price: price || undefined })
    setTitle(''); setPrice(''); setOpen(false)
  }
```

with:

```tsx
  async function submit() {
    if (!title.trim()) return
    try {
      await create.mutateAsync({ title: title.trim(), current_price: price || undefined })
      toast.success('Product added')
      setTitle(''); setPrice(''); setOpen(false)
    } catch {
      /* error toast handled by the global mutation net */
    }
  }
```

- [ ] **Step 2: link-competitor-inline.tsx**

Add `toast` to the imports. Change:

```tsx
import { useAddCompetitor, ApiError } from '@/lib/api'
```

to:

```tsx
import { useAddCompetitor, ApiError } from '@/lib/api'
import { toast } from '@/lib/toast'
```

In the `submit` function, add the success toast right after the successful `mutateAsync`:

```tsx
      await add.mutateAsync({ url: url.trim(), own_product_id: productId })
      setUrl(''); setOpen(false)
```

becomes:

```tsx
      await add.mutateAsync({ url: url.trim(), own_product_id: productId })
      toast.success('Competitor added')
      setUrl(''); setOpen(false)
```

(Leave the existing `catch (e)` / `setErr(...)` block unchanged.)

- [ ] **Step 3: competitor-row-menu.tsx**

Add after the `import { useSilenceOOS, useDeleteCompetitor } from '@/lib/api'` line:

```tsx
import { toast } from '@/lib/toast'
```

Replace the silence button `onClick`:

```tsx
            onClick={() => silence.mutate({ trackingId, silenced: !silenced }, { onSuccess: () => setOpen(false) })}
```

with:

```tsx
            onClick={() =>
              silence.mutate(
                { trackingId, silenced: !silenced },
                {
                  onSuccess: () => {
                    setOpen(false)
                    toast.success(`OOS alerts ${!silenced ? 'silenced' : 'unsilenced'}`)
                  },
                },
              )
            }
```

Replace the remove button `onClick`:

```tsx
            onClick={() => remove.mutate(trackingId, { onSuccess: () => setOpen(false) })}
```

with:

```tsx
            onClick={() =>
              remove.mutate(trackingId, {
                onSuccess: () => {
                  setOpen(false)
                  toast.success('Competitor removed')
                },
              })
            }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/add-product-form.tsx components/dashboard/link-competitor-inline.tsx components/dashboard/competitor-row-menu.tsx
git commit -m "feat(toast): success toasts on product/competitor mutations

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Replace Attribution `alert()` with toasts

**Files:**
- Modify: `app/(dashboard)/attribution/page.tsx`

`downloadAttributionCsv()` returns a `boolean` (resolves `false` on failure; it does NOT reject), so use a loading→result pattern, not `toast.promise`.

- [ ] **Step 1: Add the import**

Add after the existing `import EmptyState from '@/components/dashboard/empty-state'` line:

```tsx
import { toast } from '@/lib/toast'
```

- [ ] **Step 2: Rewrite `handleExport`**

Replace:

```tsx
  async function handleExport() {
    setDownloading(true)
    try {
      const ok = await downloadAttributionCsv()
      if (!ok) alert('Export failed. Your plan may not include attribution exports.')
    } finally {
      setDownloading(false)
    }
  }
```

with:

```tsx
  async function handleExport() {
    setDownloading(true)
    const id = toast.loading('Preparing export…')
    try {
      const ok = await downloadAttributionCsv()
      if (ok) {
        toast.success('Export ready', { id })
      } else {
        toast.error('Export failed — your plan may not include attribution exports.', { id })
      }
    } finally {
      setDownloading(false)
    }
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/attribution/page.tsx"
git commit -m "feat(toast): replace attribution export alert() with toasts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: all suites pass — the previous 218 tests plus the 4 new `formatApiError` tests (222 total).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no type or lint errors; all dashboard routes compile.

- [ ] **Step 3: Manual smoke (preview mode)**

With `NEXT_PUBLIC_PREVIEW=1` and the dev server running, confirm at least one success toast (e.g. toggle notifications in `/settings`) and one error toast (e.g. trigger the export on a gated plan, or any failing mutation) appear and visually match the dark surface cards. No `window.alert` should appear from the Attribution export.

---

## Notes for the executor

- Tasks 3–7 are pure call-site edits with no new pure logic, so they are verified by `npx tsc --noEmit` (and the final `npm run build`), not unit tests — this matches the CLAUDE.md rule (test pure logic only; no component/page tests).
- The global error net (Task 2) means call sites add **success** toasts only. Do NOT add per-site `onError` toasts (that would double-fire). Existing inline error messages are left in place (additive).
- Toggle-style success copy reads the *new* value being set (`!current`), so the message matches the state after the mutation succeeds.

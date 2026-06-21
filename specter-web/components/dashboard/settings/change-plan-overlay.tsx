'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Zap, Check } from 'lucide-react'
import { useUpgrade, useDowngrade, type SelfServePlan } from '@/lib/api'
import { openCheckout } from '@/lib/billing/checkout'
import { planChangeOptions, type PlanAction } from '@/lib/dashboard/plan-change'
import { planMeta } from '@/lib/dashboard/plan-meta'
import { toast, formatApiError } from '@/lib/toast'
import { cn } from '@/lib/utils'

const CONTACT_HREF = 'mailto:sales@specterapp.io'

/**
 * In-dashboard "Change plan" overlay. Replaces the old `<a href="/pricing">` that
 * hard-navigated out of the authed dashboard to the marketing pricing page (which
 * looked like a logout). Renders a blurred backdrop over the dashboard and only the
 * plan cards; switching tiers reuses the real Razorpay upgrade / API downgrade flow
 * (same as settings/billing-card), so nothing leaves the app.
 */
export default function ChangePlanOverlay({
  open,
  onClose,
  currentPlan,
}: {
  open: boolean
  onClose: () => void
  currentPlan: string
}) {
  const upgrade = useUpgrade()
  const downgrade = useDowngrade()
  const busy = upgrade.isPending || downgrade.isPending

  // Esc to close + lock background scroll while open.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, busy, onClose])

  if (!open || typeof document === 'undefined') return null

  async function apply(target: string, action: PlanAction) {
    if (busy) return
    try {
      if (action === 'upgrade') {
        const sub = await upgrade.mutateAsync({ plan: target as SelfServePlan, cadence: 'monthly' })
        await openCheckout({
          subscriptionId: sub.subscription_id,
          shortUrl: sub.short_url,
          plan: target as SelfServePlan,
        })
        // Embedded/hosted checkout takes over (modal or redirect); close behind it.
        onClose()
      } else if (action === 'downgrade') {
        await downgrade.mutateAsync({ plan: target })
        toast.success(`Downgraded to ${target.toUpperCase()}.`)
        onClose()
      }
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  const options = planChangeOptions(currentPlan)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-plan-title"
    >
      {/* Blurred dashboard backdrop */}
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-md"
        onClick={() => !busy && onClose()}
      />

      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-2xl p-6 sm:p-8">
        <button
          type="button"
          onClick={() => !busy && onClose()}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-text hover:bg-border/40 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mb-6">
          <h2 id="change-plan-title" className="font-display text-xl font-bold text-text">
            Change plan
          </h2>
          <p className="font-body text-sm text-muted mt-1">
            Pick a tier — upgrades open secure checkout, downgrades apply at your next renewal.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {options.map(({ plan, action }) => {
            const meta = planMeta(plan)
            const isCurrent = action === 'current'
            return (
              <div
                key={plan}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border p-4 transition-colors',
                  isCurrent ? 'border-primary/50 bg-primary/5' : 'border-border bg-bg',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-bold tracking-wide text-text">
                    {meta.label}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-primary font-body text-xs font-semibold">
                      <Check size={13} /> Current
                    </span>
                  )}
                </div>

                <div className="font-body text-sm text-text">
                  {meta.priceLabel || 'Custom pricing'}
                </div>

                <ul className="flex flex-col gap-1.5 font-body text-xs text-muted">
                  <li>Refresh {meta.refreshLabel}</li>
                  {meta.priorityLabel && (
                    <li className="inline-flex items-center gap-1">
                      <Zap size={11} className="text-primary" /> {meta.priorityLabel}
                    </li>
                  )}
                </ul>

                <div className="mt-auto pt-2">
                  {action === 'current' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full px-3 py-2 rounded-lg font-body text-sm text-muted bg-border/30 cursor-default"
                    >
                      Your plan
                    </button>
                  ) : action === 'contact' ? (
                    <a
                      href={CONTACT_HREF}
                      className="block text-center w-full px-3 py-2 rounded-lg font-body text-sm text-text border border-border hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      Contact sales
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => apply(plan, action)}
                      disabled={busy}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg font-body text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none',
                        action === 'upgrade'
                          ? 'gradient-primary-cta'
                          : 'border border-border text-muted hover:text-text hover:border-primary/40',
                      )}
                    >
                      {busy ? 'Working…' : action === 'upgrade' ? 'Upgrade' : 'Downgrade'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

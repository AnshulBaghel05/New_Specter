'use client'

/**
 * Self-serve subscription management for paid self-serve plans
 * (RECON/CIPHER/PHANTOM). Shows the next renewal date or a scheduled cancel
 * date, lets the user upgrade/downgrade among self-serve plans, cancel at
 * period end, and remove add-ons. PREDATOR/ECLIPSE are sales-led — this card
 * routes them to contact instead.
 */
import { useState } from 'react'
import {
  useUpgrade,
  useDowngrade,
  useCancelSubscription,
  useAddons,
  useRemoveAddon,
  type Merchant,
  type SelfServePlan,
} from '@/lib/api'
import { openCheckout } from '@/lib/billing/checkout'
import { toast, formatApiError } from '@/lib/toast'
import SettingsCard from './settings-card'

const SELF_SERVE: SelfServePlan[] = ['recon', 'cipher', 'phantom']
const ORDER = ['free', 'recon', 'cipher', 'phantom', 'predator', 'eclipse']

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

export default function BillingCard({ merchant }: { merchant: Merchant }) {
  const upgrade = useUpgrade()
  const downgrade = useDowngrade()
  const cancel = useCancelSubscription()
  const { data: addons } = useAddons()
  const removeAddon = useRemoveAddon()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const plan = merchant.plan
  const renewal = fmtDate(merchant.subscription_current_end)
  const cancelAt = fmtDate(merchant.subscription_cancel_at)
  const idx = ORDER.indexOf(plan)

  async function changePlan(target: SelfServePlan) {
    const targetIdx = ORDER.indexOf(target)
    try {
      if (targetIdx > idx) {
        const sub = await upgrade.mutateAsync({ plan: target, cadence: 'monthly' })
        await openCheckout({ subscriptionId: sub.subscription_id, shortUrl: sub.short_url, plan: target })
      } else {
        await downgrade.mutateAsync({ plan: target })
        toast.success(`Downgraded to ${target.toUpperCase()}.`)
      }
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  async function doCancel() {
    try {
      const res = await cancel.mutateAsync()
      const when = fmtDate(res.cancel_at)
      toast.success(when ? `Cancellation scheduled for ${when}.` : 'Cancellation scheduled for the end of your billing period.')
      setConfirmCancel(false)
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  async function doRemoveAddon(addonId: string) {
    try {
      await removeAddon.mutateAsync(addonId)
      toast.success('Add-on removed.')
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  // Disable the money-path controls while any subscription mutation is in flight
  // so a double-click can't create two subscriptions or fire duplicate requests.
  const changing = upgrade.isPending || downgrade.isPending

  return (
    <SettingsCard title="Billing">
      <div className="flex flex-col gap-4">
        <div>
          {cancelAt ? (
            <p className="font-body text-sm text-amber-400">
              Cancels on {cancelAt} — you retain {plan.toUpperCase()} access until then.
            </p>
          ) : renewal ? (
            <p className="font-body text-sm text-muted">Next renewal: {renewal}</p>
          ) : (
            <p className="font-body text-sm text-muted">No active subscription billing date on file.</p>
          )}
        </div>

        {/* Change plan among self-serve tiers */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-xs text-muted">Change plan:</span>
          {SELF_SERVE.filter((p) => p !== plan).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => changePlan(p)}
              disabled={changing}
              className="border border-border text-muted hover:text-text hover:border-primary/40 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {ORDER.indexOf(p) > idx ? 'Upgrade to' : 'Downgrade to'} {p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Add-ons */}
        {addons && addons.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-body text-xs text-muted">Add-ons</span>
            {addons.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
                <span className="font-mono text-xs text-text">{a.addon_type}</span>
                <button
                  type="button"
                  onClick={() => doRemoveAddon(a.id)}
                  disabled={removeAddon.isPending}
                  className="font-body text-xs text-rose-300 hover:underline disabled:opacity-50 disabled:pointer-events-none"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Cancel at period end */}
        {!cancelAt && merchant.subscription_current_end !== null && (
          confirmCancel ? (
            <div className="flex items-center gap-3">
              <button type="button" onClick={doCancel} disabled={cancel.isPending} className="font-body text-sm text-rose-300 hover:underline disabled:opacity-50 disabled:pointer-events-none">
                Confirm cancellation
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="font-body text-sm text-muted hover:text-text">
                Keep my plan
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="self-start font-body text-sm text-muted hover:text-rose-300 transition-colors"
            >
              Cancel subscription
            </button>
          )
        )}
      </div>
    </SettingsCard>
  )
}

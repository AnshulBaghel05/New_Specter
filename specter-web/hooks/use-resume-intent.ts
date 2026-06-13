'use client'

/**
 * One-shot billing-intent resume. On the first authenticated dashboard mount,
 * if a fresh intent exists (saved on /pricing before the signup round-trip), we
 * act on it exactly once and clear it:
 *   - trial → start the RECON trial, then route to the dashboard
 *   - buy   → create the subscription and open checkout
 * Stale or absent intents are ignored (and cleared if stale).
 */
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { readIntent, clearIntent, isFresh } from '@/lib/billing/intent'
import { useStartTrial, useSubscribe, type SelfServePlan, type BillingCadence } from '@/lib/api'
import { openCheckout } from '@/lib/billing/checkout'
import { toast, formatApiError } from '@/lib/toast'

export function useResumeIntent(): void {
  const ran = useRef(false)
  const router = useRouter()
  const startTrial = useStartTrial()
  const subscribe = useSubscribe()

  useEffect(() => {
    if (ran.current) return
    const intent = readIntent()
    if (!intent) return
    ran.current = true
    clearIntent()
    if (!isFresh(intent)) return

    void (async () => {
      try {
        if (intent.action === 'trial') {
          await startTrial.mutateAsync()
          toast.success('Your 14-day RECON trial is active.')
          router.push('/dashboard')
        } else {
          const sub = await subscribe.mutateAsync({
            plan: intent.plan as SelfServePlan,
            cadence: intent.cadence as BillingCadence,
          })
          await openCheckout({ subscriptionId: sub.subscription_id, shortUrl: sub.short_url, plan: intent.plan })
        }
      } catch (err) {
        toast.error(formatApiError(err))
      }
    })()
    // run-once; mutations are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

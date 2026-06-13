'use client'

/**
 * Checkout return route. Plan elevation is webhook-driven, so completing
 * checkout does NOT mean the plan is live yet — we poll /merchants/me until the
 * plan leaves `free` (or a short timeout), then route to the dashboard.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useMerchant, queryKeys } from '@/lib/api'
import { toast } from '@/lib/toast'

const MAX_POLLS = 15
const INTERVAL_MS = 2000

export default function BillingSuccessPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: merchant } = useMerchant()
  const [finalizing, setFinalizing] = useState(true)
  const polls = useRef(0)
  // The plan being purchased, passed via ?plan= (see lib/billing/checkout
  // buildSuccessPath). On an upgrade or trial→buy the merchant is ALREADY
  // non-free at return time, so "left free" can't tell us the new plan landed —
  // we must wait for this specific plan. Absent (e.g. hosted fallback) → fall
  // back to "left free", which is correct for the primary free→paid flow.
  const [target, setTarget] = useState<string | null>(null)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('plan')
    if (p && p.toLowerCase() !== 'free') setTarget(p.toLowerCase())
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      polls.current += 1
      void qc.invalidateQueries({ queryKey: queryKeys.merchant })
      if (polls.current >= MAX_POLLS) {
        clearInterval(id)
        setFinalizing(false)
      }
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [qc])

  useEffect(() => {
    if (!merchant) return
    const arrived = target ? merchant.plan === target : merchant.plan !== 'free'
    if (arrived) {
      toast.success(`You're on ${merchant.plan.toUpperCase()}.`)
      router.replace('/dashboard')
    }
  }, [merchant, router, target])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      {finalizing ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-text">Finalizing your plan…</h1>
          <p className="font-body text-sm text-muted max-w-sm">
            Payment received. We&apos;re activating your subscription — this usually takes a few seconds.
          </p>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-text">Payment received</h1>
          <p className="font-body text-sm text-muted max-w-sm">
            Your plan is being activated. Refresh in a minute or head to your dashboard.
          </p>
          <a href="/dashboard" className="gradient-primary-cta btn-ripple px-5 py-2.5 rounded-xl font-semibold text-sm">
            Go to dashboard
          </a>
        </>
      )}
    </div>
  )
}

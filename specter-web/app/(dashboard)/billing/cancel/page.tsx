'use client'

/** Checkout-abandoned return route. No charge was made. */
import { XCircle } from 'lucide-react'

export default function BillingCancelPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <XCircle className="h-8 w-8 text-muted" aria-hidden="true" />
      <h1 className="font-display text-xl font-bold text-text">Checkout cancelled</h1>
      <p className="font-body text-sm text-muted max-w-sm">
        No charge was made. You can pick a plan whenever you&apos;re ready.
      </p>
      <a href="/pricing" className="gradient-primary-cta btn-ripple px-5 py-2.5 rounded-xl font-semibold text-sm">
        Back to pricing
      </a>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SPECTER] Route error:', error)
  }, [error])

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
        Something went wrong
      </p>
      <h1 className="font-display text-3xl font-bold text-text mb-3">
        Page failed to load
      </h1>
      <p className="font-body text-sm text-muted max-w-sm mb-8">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="gradient-primary-cta btn-ripple px-6 py-2.5 rounded-lg font-semibold text-sm"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border border-border text-muted hover:text-text px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          Go home
        </Link>
      </div>
    </main>
  )
}

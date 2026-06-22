'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MailX, Check, Loader2 } from 'lucide-react'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'

function UnsubscribeInner() {
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setState('error')
      return
    }
    setState('loading')
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center max-w-md">
        <div className="grid place-items-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 mx-auto">
          <Check size={22} className="text-primary" aria-hidden="true" />
        </div>
        <h1 className="font-display text-xl font-bold text-text mt-4">You&rsquo;re unsubscribed</h1>
        <p className="font-body text-sm text-muted mt-2">
          {email} will no longer receive SPECTER newsletter emails. Account and security emails
          (if you have an account) are not affected.
        </p>
        <Link href="/" className="gradient-primary-cta btn-ripple inline-block mt-5 px-5 py-2.5 rounded-xl font-semibold text-sm">
          Back to SPECTER
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-8 max-w-md">
      <div className="grid place-items-center w-11 h-11 rounded-xl bg-rose-400/10 border border-rose-400/20">
        <MailX size={22} className="text-rose-400" aria-hidden="true" />
      </div>
      <h1 className="font-display text-xl font-bold text-text mt-4">Unsubscribe</h1>
      <p className="font-body text-sm text-muted mt-2">
        Confirm the email address to remove from the SPECTER newsletter.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle') }}
          placeholder="you@yourstore.com"
          aria-label="Email address"
          className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="inline-flex items-center justify-center gap-2 border border-border text-text hover:border-rose-400/40 hover:text-rose-300 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {state === 'loading' && <Loader2 size={14} className="animate-spin" />}
          Unsubscribe
        </button>
        {state === 'error' && (
          <p className="font-body text-xs text-rose-400">
            Something went wrong. Check the address and try again, or email{' '}
            <a href="mailto:unsubscribe@specterapp.io" className="text-primary hover:underline">unsubscribe@specterapp.io</a>.
          </p>
        )}
      </form>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg pt-28 pb-24 px-6 flex justify-center">
        <Suspense fallback={<div className="h-64" />}>
          <UnsubscribeInner />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Newsletter signup for the blog. Consent-gated marketing opt-in via /api/newsletter/subscribe. */
export default function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Enter a valid email address and try again.')
      setState('error')
      return
    }
    if (!consent) {
      setError('Please tick the box to agree to receive emails.')
      setState('error')
      return
    }
    setState('loading')
    setError('')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: true, source: 'blog' }),
      })
      if (res.ok) {
        setState('done')
      } else {
        setError('Something went wrong. Please try again.')
        setState('error')
      }
    } catch {
      setError('Network error. Please try again.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 font-body text-sm text-primary">
        <Check size={16} /> You’re in. Watch your inbox for the next pricing playbook.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={cn('w-full', compact ? '' : 'max-w-md')}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle') }}
            placeholder="you@yourstore.com"
            aria-label="Email address"
            className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-5 py-2.5 rounded-lg text-sm transition-all duration-300 disabled:opacity-70 whitespace-nowrap"
        >
          {state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : null}
          Subscribe
        </button>
      </div>
      {state === 'error' && (
        <p className="font-body text-xs text-rose-400 mt-1.5">{error || 'Enter a valid email address and try again.'}</p>
      )}
      <label className="flex items-start gap-2 mt-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => { setConsent(e.target.checked); if (state === 'error') setState('idle') }}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border bg-surface accent-primary"
          aria-label="Consent to receive marketing emails"
        />
        <span className="font-body text-[11px] text-muted/80 leading-snug">
          I agree to receive pricing &amp; margin playbooks. No spam, unsubscribe anytime. See our{' '}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </span>
      </label>
    </form>
  )
}

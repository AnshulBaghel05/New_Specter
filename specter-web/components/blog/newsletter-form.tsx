'use client'

import { useState } from 'react'
import { Mail, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Email capture for the blog. Reuses the existing /api/email-capture route. */
export default function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setState('error')
      return
    }
    setState('loading')
    try {
      const res = await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tool: 'blog-newsletter' }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
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
        <p className="font-body text-xs text-rose-400 mt-1.5">Enter a valid email address and try again.</p>
      )}
      <p className="font-body text-[11px] text-muted/70 mt-2">
        Pricing &amp; margin playbooks for ecommerce operators. No spam, unsubscribe anytime.
      </p>
    </form>
  )
}

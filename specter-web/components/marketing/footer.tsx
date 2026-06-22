'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = {
  Product: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Integrations', href: '/#integrations' },
    { label: 'Changelog', href: '/changelog' },
  ],
  'Free Tools': [
    { label: 'Amazon FBA Calculator', href: '/tools/amazon-fba-calculator' },
    { label: 'Shopify Profit Calculator', href: '/tools/shopify-profit-calculator' },
    { label: 'Shipping Estimator', href: '/tools/shipping-calculator' },
    { label: 'Price Position Analyzer', href: '/tools/price-position-analyzer' },
    { label: 'Ad ROAS Calculator', href: '/tools/roas-calculator' },
    { label: 'Inventory Reorder Calculator', href: '/tools/inventory-reorder-calculator' },
  ],
  Company: [
    { label: 'Blog', href: '/blog' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: 'mailto:hello@specterapp.io' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [error, setError] = useState('')

  function validateEmail(val: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!consent) {
      setError('Please tick the box to agree to receive emails.')
      return
    }
    setSubmitState('loading')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: true, source: 'footer' }),
      })
      if (res.ok) {
        setSubmitState('success')
      } else {
        setSubmitState('error')
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setSubmitState('error')
      setError('Network error. Please try again.')
    }
  }

  return (
    <footer className="bg-bg border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
          {/* Brand + Newsletter */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="font-display text-xl font-bold text-text mb-4 block">
              SPECTER<span className="text-primary">.</span>
            </Link>
            <p className="font-body text-xs text-muted leading-relaxed max-w-[180px] mb-4">
              AI-powered competitor pricing intelligence for Shopify and WooCommerce merchants.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3 mb-6">
              <a
                href="https://linkedin.com/company/specterapp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SPECTER on LinkedIn"
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted hover:text-primary hover:border-primary/40 transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              <a
                href="https://x.com/specterapp_io"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SPECTER on X"
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted hover:text-primary hover:border-primary/40 transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://github.com/specterapp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SPECTER on GitHub"
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted hover:text-primary hover:border-primary/40 transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>

            {/* Newsletter */}
            {submitState === 'success' ? (
              <div className="flex items-center gap-2 text-primary font-mono text-xs">
                <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-primary">✓</span>
                You&apos;re in. Welcome.
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate aria-label="Newsletter signup">
                <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">Stay sharp</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@store.com"
                    aria-label="Email address"
                    aria-invalid={!!error}
                    aria-describedby={error ? 'footer-email-error' : undefined}
                    className={cn(
                      'flex-1 min-w-0 bg-surface border rounded-lg px-3 py-2 font-body text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary/60 transition-colors duration-200',
                      error ? 'border-rose-400/60' : 'border-border'
                    )}
                    disabled={submitState === 'loading'}
                  />
                  <button
                    type="submit"
                    disabled={submitState === 'loading'}
                    aria-label="Subscribe to newsletter"
                    className="w-9 h-9 flex items-center justify-center bg-primary/10 border border-primary/30 rounded-lg text-primary hover:bg-primary/20 transition-all duration-200 shrink-0 disabled:opacity-50"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
                {error && (
                  <p id="footer-email-error" className="font-body text-xs text-rose-400 mt-1.5">
                    {error}
                  </p>
                )}
                <label className="flex items-start gap-2 mt-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => { setConsent(e.target.checked); if (error) setError('') }}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border bg-surface accent-primary"
                    aria-label="Consent to receive marketing emails"
                  />
                  <span className="font-body text-[11px] text-muted leading-snug">
                    I agree to receive occasional product &amp; pricing emails. Unsubscribe anytime. See our{' '}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                  </span>
                </label>
              </form>
            )}
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <p className="font-display font-bold text-xs text-text uppercase tracking-widest mb-4">
                {group}
              </p>
              <ul className="flex flex-col gap-2.5">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="font-body text-xs text-muted hover:text-text transition-colors duration-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-muted" suppressHydrationWarning>
            © {new Date().getFullYear()} SPECTER. All rights reserved.
          </p>
          <p className="font-mono text-xs text-muted">
            Built for merchants who want to know first.
          </p>
        </div>
      </div>
    </footer>
  )
}

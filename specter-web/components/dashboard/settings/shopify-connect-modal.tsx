'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Store, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'
import { shopifyOAuthUrl } from '@/lib/api'
import { toast } from '@/lib/toast'

/**
 * Shopify connect modal. Shopify OAuth is per-store: the authorize URL is
 * `https://{shop}.myshopify.com/admin/oauth/authorize`, so — unlike Google — we
 * must know the store before redirecting. This collects ONLY the store handle
 * (with `.myshopify.com` shown for the user) and hands off to Shopify's real
 * consent screen via the existing signed-token OAuth begin flow. No password
 * ever touches SPECTER; the server still validates the domain (anti-SSRF) and
 * encrypts the returned token at rest.
 *
 * `title` is reused for both the first connect and a reconnect.
 */
export default function ShopifyConnectModal({
  open,
  onClose,
  title = 'Connect your Shopify store',
}: {
  open: boolean
  onClose: () => void
  title?: string
}) {
  const [raw, setRaw] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  // Esc to close + lock background scroll while open (matches change-plan-overlay).
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !redirecting) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, redirecting, onClose])

  // Reset the field whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setRaw('')
      setRedirecting(false)
    }
  }, [open])

  // Forgiving normalisation: accept "my-store", "my-store.myshopify.com",
  // "https://my-store.myshopify.com/", etc. — reduce all to the bare handle.
  const handle = useMemo(() => {
    return (raw || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.myshopify\.com$/, '')
      .replace(/[^a-z0-9-]/g, '')
  }, [raw])

  // Mirror the server's `<handle>.myshopify.com` rule on the handle segment.
  const valid = /^[a-z0-9][a-z0-9-]*$/.test(handle)

  async function connect() {
    if (!valid || redirecting) return
    setRedirecting(true)
    const url = await shopifyOAuthUrl(`${handle}.myshopify.com`)
    if (url) {
      window.location.href = url // full-page handoff to Shopify's consent screen
    } else {
      setRedirecting(false)
      toast.error('Your session expired — sign in again to connect Shopify.')
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopify-connect-title"
    >
      {/* Blurred dashboard backdrop */}
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-md"
        onClick={() => !redirecting && onClose()}
      />

      <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 sm:p-7">
        <button
          type="button"
          onClick={() => !redirecting && onClose()}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-text hover:bg-border/40 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
            <Store size={20} className="text-primary" aria-hidden="true" />
          </div>
          <h2 id="shopify-connect-title" className="font-display text-lg font-bold text-text">
            {title}
          </h2>
        </div>

        <p className="font-body text-sm text-muted mt-3">
          Enter your store name — we&rsquo;ll take you to Shopify to securely approve access.
        </p>

        <label htmlFor="shopify-store-name" className="sr-only">Shopify store name</label>
        <div className="mt-4 flex items-stretch rounded-xl border border-border bg-bg focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden">
          <input
            id="shopify-store-name"
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connect()}
            placeholder="your-store"
            className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 font-mono text-sm text-text placeholder:text-muted/70 focus:outline-none"
          />
          <span className="grid place-items-center px-3 font-mono text-sm text-muted bg-border/20 border-l border-border select-none shrink-0">
            .myshopify.com
          </span>
        </div>

        <button
          type="button"
          onClick={connect}
          disabled={!valid || redirecting}
          className="gradient-primary-cta btn-ripple w-full mt-4 px-5 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition-all duration-200"
        >
          {redirecting ? (
            <><Loader2 size={15} className="animate-spin" /> Redirecting to Shopify…</>
          ) : (
            <>Continue to Shopify <ArrowRight size={15} /></>
          )}
        </button>

        <p className="font-body text-xs text-muted mt-3 inline-flex items-start gap-1.5">
          <ShieldCheck size={13} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
          You&rsquo;ll approve access on Shopify. We never see your password, and your access token is encrypted.
        </p>
      </div>
    </div>,
    document.body,
  )
}

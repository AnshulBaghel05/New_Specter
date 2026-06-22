'use client'

import { useState } from 'react'
import { Send, Loader2, Check, KeyRound, Eye } from 'lucide-react'

/**
 * Operator newsletter composer. Enter the admin key (NEWSLETTER_ADMIN_KEY), a
 * subject, and the body, then send to the whole Resend audience. The server
 * wraps the body in the brand shell and adds the per-recipient unsubscribe link.
 * The key is held only in component state and sent as the x-newsletter-key header.
 */
export default function NewsletterComposer() {
  const [key, setKey] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [from, setFrom] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const canSend = key.trim() && subject.trim() && body.trim() && state !== 'sending'

  async function send() {
    if (!canSend) return
    setState('sending')
    setMessage('')
    try {
      const res = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-newsletter-key': key.trim() },
        body: JSON.stringify({ subject: subject.trim(), body, from: from.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setState('sent')
        setMessage(`Sent. Broadcast id: ${json.broadcastId ?? 'unknown'}`)
      } else {
        setState('error')
        setMessage(json.error === 'unauthorized' ? 'Invalid admin key.' : (json.detail || json.error || 'Send failed.'))
      }
    } catch {
      setState('error')
      setMessage('Network error — try again.')
    }
  }

  return (
    <main className="min-h-screen bg-bg px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="font-mono text-primary text-xs uppercase tracking-widest mb-3">Admin · Newsletter</p>
        <h1 className="font-display text-3xl font-bold text-text mb-2">Compose & send</h1>
        <p className="font-body text-sm text-muted mb-8">
          This sends to every subscribed contact in your Resend audience. Each email gets the SPECTER
          shell and a one-click unsubscribe link automatically.
        </p>

        <div className="flex flex-col gap-4">
          <Field label="Admin key" icon={<KeyRound size={14} />}>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="NEWSLETTER_ADMIN_KEY"
              className={inputCls}
            />
          </Field>

          <Field label="From (optional — must be a verified Resend sender)">
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="SPECTER <news@specterapp.io>"
              className={inputCls}
            />
          </Field>

          <Field label="Subject">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What&rsquo;s new in SPECTER this week"
              className={inputCls}
            />
          </Field>

          <Field label="Body (plain text or HTML)">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder={'Write your update here.\n\nDouble line breaks become paragraphs. You can also paste HTML.'}
              className={`${inputCls} font-mono resize-y`}
            />
          </Field>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="gradient-primary-cta btn-ripple inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:pointer-events-none"
            >
              {state === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Send to all subscribers
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-2 border border-border text-muted hover:text-text px-4 py-2.5 rounded-xl font-body text-sm transition-colors"
            >
              <Eye size={15} /> {showPreview ? 'Hide' : 'Preview'}
            </button>
          </div>

          {message && (
            <div
              className={`flex items-start gap-2 rounded-xl px-4 py-3 font-body text-sm ${
                state === 'sent'
                  ? 'bg-primary/10 border border-primary/30 text-primary'
                  : 'bg-rose-400/10 border border-rose-400/30 text-rose-300'
              }`}
            >
              {state === 'sent' && <Check size={16} className="mt-0.5 shrink-0" />}
              <span>{message}</span>
            </div>
          )}

          {showPreview && (
            <div className="rounded-xl border border-border bg-[#06070D] p-4">
              <p className="font-mono text-[11px] text-muted mb-3">Approximate preview</p>
              <div className="rounded-lg bg-[#0D0F1A] p-5 text-text">
                <div className="font-display font-bold mb-3">SPECTER<span className="text-primary">.</span></div>
                <p className="font-body text-sm font-semibold mb-2">{subject || '(subject)'}</p>
                <div className="font-body text-sm text-muted whitespace-pre-wrap leading-relaxed">
                  {body || '(body)'}
                </div>
                <hr className="border-border my-4" />
                <p className="font-body text-xs text-muted">Unsubscribe link is added automatically per recipient.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

const inputCls =
  'w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60'

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-body text-xs text-muted inline-flex items-center gap-1.5">{icon}{label}</span>
      {children}
    </label>
  )
}

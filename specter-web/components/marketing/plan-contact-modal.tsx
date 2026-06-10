'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type ContactPlanConfig,
  type FieldDef,
  buildSchema,
  initialValues,
} from '@/lib/marketing/contact-plans'

type FormValues = Record<string, string | string[]>

/* ─── Field renderer ───────────────────────────────────────────────── */

function inputClasses(invalid: boolean) {
  return cn(
    'w-full bg-bg border rounded-lg px-3.5 py-2.5 font-body text-sm text-text placeholder:text-muted/60',
    'transition-colors duration-200 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30',
    invalid ? 'border-rose-500/60' : 'border-border',
  )
}

function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef
  value: string | string[]
  error?: string
  onChange: (name: string, value: string | string[]) => void
}) {
  const id = `pcf-${field.name}`
  const invalid = Boolean(error)

  return (
    <div className={cn('flex flex-col gap-1.5', field.half ? 'sm:col-span-1' : 'sm:col-span-2')}>
      <label htmlFor={id} className="font-mono text-xs text-muted">
        {field.label}
        {field.required && <span className="text-primary"> *</span>}
      </label>

      {field.type === 'select' ? (
        <select
          id={id}
          value={value as string}
          onChange={(e) => onChange(field.name, e.target.value)}
          aria-invalid={invalid}
          className={cn(inputClasses(invalid), value === '' && 'text-muted/60')}
        >
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt} className="text-text bg-bg">
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          id={id}
          rows={3}
          value={value as string}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
          aria-invalid={invalid}
          className={cn(inputClasses(invalid), 'resize-none')}
        />
      ) : field.type === 'multiselect' ? (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {field.options?.map((opt) => {
            const selected = (value as string[]).includes(opt)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const set = new Set(value as string[])
                  if (set.has(opt)) set.delete(opt)
                  else set.add(opt)
                  onChange(field.name, Array.from(set))
                }}
                aria-pressed={selected}
                className={cn(
                  'font-body text-xs px-3 py-1.5 rounded-full border transition-all duration-200',
                  selected
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-border text-muted hover:text-text hover:border-primary/30',
                )}
              >
                {opt}
              </button>
            )
          })}
        </div>
      ) : (
        <input
          id={id}
          type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
          value={value as string}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
          aria-invalid={invalid}
          className={inputClasses(invalid)}
        />
      )}

      {error && <p className="font-body text-xs text-rose-400">{error}</p>}
    </div>
  )
}

/* ─── Modal ─────────────────────────────────────────────────────────── */

export default function PlanContactModal({
  config,
  onClose,
}: {
  config: ContactPlanConfig | null
  onClose: () => void
}) {
  const [values, setValues] = useState<FormValues>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Reset whenever a new plan opens the modal.
  useEffect(() => {
    if (!config) return
    setValues(initialValues(config.fields))
    setErrors({})
    setDone(false)
    setSubmitting(false)
  }, [config])

  // Lock body scroll + Esc-to-close while open.
  useEffect(() => {
    if (!config) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [config, onClose])

  if (!config) return null

  const setField = (name: string, value: string | string[]) => {
    setValues((v) => ({ ...v, [name]: value }))
    if (errors[name]) setErrors((e) => ({ ...e, [name]: '' }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const schema = buildSchema(config.fields)
    const result = schema.safeParse(values)
    if (!result.success) {
      const next: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0])
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      // Focus the first invalid field.
      const firstKey = config.fields.find((f) => next[f.name])?.name
      if (firstKey) panelRef.current?.querySelector<HTMLElement>(`#pcf-${firstKey}`)?.focus()
      return
    }
    // Submission backend is not live yet — show the "coming soon" confirmation.
    setErrors({})
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setDone(true)
    }, 600)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Contact form for the ${config.plan} plan`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-bg/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-2xl my-8 sm:my-0 bg-surface border border-border rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-7 pt-7 pb-5 border-b border-border">
          <div>
            <p className={cn('font-display font-bold text-xs tracking-widest uppercase mb-1.5', config.accent)}>
              {config.plan} · {config.priceLabel}
            </p>
            <h2 className="font-display font-bold text-text text-xl mb-1">{config.title}</h2>
            <p className="font-body text-xs text-muted leading-relaxed max-w-md">{config.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-muted hover:text-text transition-colors rounded-lg p-1 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          /* Confirmation state */
          <div className="px-7 py-14 text-center">
            <div className="mx-auto mb-5 w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Check size={22} className="text-primary" />
            </div>
            <h3 className="font-display font-bold text-text text-lg mb-2">Coming soon</h3>
            <p className="font-body text-sm text-muted leading-relaxed max-w-sm mx-auto mb-7">
              Online {config.plan} requests aren’t live just yet — but we’ve noted your interest. In the
              meantime, email us at{' '}
              <a href="mailto:sales@specterapp.io" className="text-primary hover:underline">
                sales@specterapp.io
              </a>{' '}
              and we’ll get you started.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="border border-border text-muted hover:text-text hover:border-primary/40 text-sm font-semibold px-6 py-2.5 rounded-lg transition-all duration-200"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-7 py-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {config.fields.map((f) => (
                  <Field key={f.name} field={f} value={values[f.name] ?? (f.type === 'multiselect' ? [] : '')} error={errors[f.name]} onChange={setField} />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-7 py-5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="font-body text-xs text-muted order-2 sm:order-1">
                We’ll only use these details to set up your plan. No spam.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="order-1 sm:order-2 w-full sm:w-auto gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-7 py-3 rounded-lg text-sm transition-all duration-300 disabled:opacity-70"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                Coming Soon
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { ArrowRight, ArrowLeft, ChevronDown, Sparkles, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import CurrencySelector from '@/components/tools/currency-selector'
import RelatedTools from '@/components/tools/related-tools'
import HeroCoachmark from '@/components/tools/hero-coachmark'
import type { ToolInsight, InsightTone } from '@/lib/tools/insights'

interface ToolLayoutProps {
  badge: string
  title: string
  description: string
  children: React.ReactNode
  className?: string
  toolId?: string
  toolHref?: string
  headerRight?: React.ReactNode
}

export default function ToolLayout({
  badge,
  title,
  description,
  children,
  className,
  toolId: _toolId,
  toolHref = '',
  headerRight,
}: ToolLayoutProps) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="pt-28 pb-10 text-center px-6">
        <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full animate-border-glow">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            {badge}
          </div>
          <CurrencySelector />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-text mb-4 max-w-3xl mx-auto leading-tight tracking-tight">
          {title}
        </h1>
        <p className="font-body text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-muted hover:text-text text-xs font-mono transition-colors"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Back to SPECTER
          </Link>
          <span className="text-border" aria-hidden="true">·</span>
          <span className="text-xs font-mono text-muted">Free · No sign-up · Client-side only</span>
        </div>
        {headerRight && (
          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            {headerRight}
          </div>
        )}
      </section>

      {/* Calculator content */}
      <div className={cn('max-w-5xl mx-auto px-6 pb-10', className)}>
        {children}
        {toolHref && <RelatedTools currentHref={toolHref} />}
      </div>

      {/* SPECTER CTA */}
      <section className="py-20 bg-surface/40 border-t border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full mb-6">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            Want this automated?
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-text mb-4 tracking-tight">
            Stop calculating manually.{' '}
            <span className="text-primary">Start winning.</span>
          </h2>
          <p className="font-body text-muted mb-8 leading-relaxed max-w-xl mx-auto">
            SPECTER monitors competitor prices in real time and sends AI-powered{' '}
            <span className="text-text font-semibold">RAISE / LOWER / HOLD</span> signals
            directly to your Shopify dashboard — no spreadsheets required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-8 py-3.5 rounded-lg text-base transition-all duration-300"
            >
              Start free trial — 14 days
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/pricing"
              className="border border-border text-muted hover:text-text hover:border-border/80 px-8 py-3.5 rounded-lg transition-colors text-base text-center"
            >
              See pricing →
            </Link>
          </div>
          <p className="font-body text-xs text-muted mt-6">
            No credit card required · Set up in 10 minutes · Cancel any time
          </p>
        </div>
      </section>
    </div>
  )
}

// ── Shared input/result card shells ────────────────────────────────────────

export function CalcCard({
  title,
  headerRight,
  children,
  className,
}: {
  title?: string
  headerRight?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-surface border border-border rounded-2xl p-6', className)}>
      {(title || headerRight) && (
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
          {title && (
            <h2 className="font-display text-base font-semibold text-text">{title}</h2>
          )}
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block font-body text-xs font-medium text-text/70 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="font-body text-xs text-muted mt-1">{hint}</p>}
    </div>
  )
}

export function Input({
  value,
  onChange,
  type = 'number',
  prefix,
  suffix,
  min,
  max,
  step,
  placeholder,
}: {
  value: string | number
  onChange: (v: string) => void
  type?: string
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 font-mono text-sm text-muted pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={
          type === 'number'
            ? (e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }
            : undefined
        }
        className={cn(
          'w-full bg-bg border border-border rounded-lg py-2.5 font-mono text-sm text-text',
          'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
          'transition-colors placeholder:text-muted/50',
          prefix ? 'pl-8 pr-3' : 'px-3',
          suffix ? 'pr-10' : '',
        )}
      />
      {suffix && (
        <span className="absolute right-3 font-mono text-sm text-muted pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 font-body text-sm text-text focus:outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
    >
      {children}
    </select>
  )
}

export function Metric({
  label,
  value,
  variant = 'default',
  sub,
}: {
  label: string
  value: string
  variant?: 'default' | 'positive' | 'negative' | 'warning' | 'highlight'
  sub?: string
}) {
  const colors = {
    default:   'text-text',
    positive:  'text-emerald-400',
    negative:  'text-rose-400',
    warning:   'text-amber-400',
    highlight: 'text-primary',
  }
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-body text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className={cn('font-mono text-xl font-bold', colors[variant])}>{value}</p>
      {sub && <p className="font-body text-xs text-muted">{sub}</p>}
    </div>
  )
}

export function SignalBadge({ signal }: { signal: 'RAISE' | 'LOWER' | 'HOLD' }) {
  const styles = {
    RAISE: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400',
    LOWER: 'bg-rose-400/10 border-rose-400/30 text-rose-400',
    HOLD:  'bg-amber-400/10 border-amber-400/30 text-amber-400',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-lg px-3 py-1.5 font-mono text-sm font-bold',
        styles[signal],
      )}
    >
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" aria-hidden="true" />
      {signal}
    </span>
  )
}

// ── THE ANSWER slot: hero number + "what this means" + "do this next" ────────

export function ResultVerdict({
  hero,
  heroLabel,
  variant = 'highlight',
  whatThisMeans,
  doThisNext,
}: {
  /** The single hero value, already formatted (e.g. "$12.40" or "RAISE"). */
  hero: React.ReactNode
  /** Small label above the hero (e.g. "Net profit per unit"). */
  heroLabel: string
  variant?: 'default' | 'positive' | 'negative' | 'warning' | 'highlight'
  /** One plain-English sentence interpreting the hero. */
  whatThisMeans: string
  /** One concrete next action sentence. */
  doThisNext: string
}) {
  const colors = {
    default:   'text-text',
    positive:  'text-emerald-400',
    negative:  'text-rose-400',
    warning:   'text-amber-400',
    highlight: 'text-primary',
  }
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 text-center">
      <HeroCoachmark />
      <p className="font-body text-xs text-muted uppercase tracking-widest mb-2">{heroLabel}</p>
      <div className={cn('font-mono text-4xl md:text-5xl font-bold mb-4', colors[variant])}>
        {hero}
      </div>
      <div className="max-w-md mx-auto space-y-2 text-left">
        <p className="font-body text-sm text-text">
          <span className="text-muted font-semibold uppercase text-xs tracking-wide mr-2">What this means</span>
          {whatThisMeans}
        </p>
        <p className="font-body text-sm text-text">
          <span className="text-primary font-semibold uppercase text-xs tracking-wide mr-2">Do this next</span>
          {doThisNext}
        </p>
      </div>
    </div>
  )
}

// ── SUPPORTING slot: ≤3 secondary metrics under the hero ─────────────────────

export function SupportingMetrics({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface border border-border rounded-2xl p-6">
      {children}
    </div>
  )
}

// ── AI SUMMARY slot: deterministic insight + next-tool loop ───────────────────

const TONE_ICON: Record<InsightTone, typeof CheckCircle2> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  opportunity: TrendingUp,
}
const TONE_COLOR: Record<InsightTone, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  opportunity: 'text-primary',
}

export function ToolInsightCard({ insight }: { insight: ToolInsight }) {
  if (insight.findings.length === 0) return null
  return (
    <div className="bg-surface border border-primary/20 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={15} className="text-primary" aria-hidden="true" />
        <h3 className="font-display text-sm font-semibold text-text uppercase tracking-wide">AI Summary</h3>
      </div>
      <ul className="space-y-2.5">
        {insight.findings.map((f, i) => {
          const Icon = TONE_ICON[f.tone]
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Icon size={15} className={cn('shrink-0 mt-0.5', TONE_COLOR[f.tone])} aria-hidden="true" />
              <span className="font-body text-sm text-text leading-relaxed">{f.text}</span>
            </li>
          )
        })}
      </ul>
      {insight.nextTool && (
        <Link
          href={insight.nextTool.href}
          className="group mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 transition-all p-4"
        >
          <span className="min-w-0">
            <span className="block font-body text-xs text-muted uppercase tracking-wide">Recommended next step</span>
            <span className="block font-body text-sm font-semibold text-text group-hover:text-primary transition-colors mt-0.5">
              {insight.nextTool.label}
            </span>
            <span className="block font-body text-xs text-muted mt-0.5">{insight.nextTool.reason}</span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-muted group-hover:text-primary transition-colors" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

// ── Collapsible section that stays in the DOM (SEO-safe) ──────────────────────
// Uses native <details> so collapsed content is still rendered + crawlable.

export function ToolSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group bg-surface border border-border rounded-2xl overflow-hidden">
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none p-6 select-none">
        <span className="min-w-0">
          <span className="block font-display text-base font-semibold text-text">{title}</span>
          {subtitle && <span className="block font-body text-xs text-muted mt-0.5">{subtitle}</span>}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-6 pb-6 pt-0">{children}</div>
    </details>
  )
}

/** "See full breakdown" — the collapsed detail drawer for the depth we strip
 *  off the hero. Content stays in the DOM (crawlable), just visually hidden. */
export function FullBreakdown({
  label = 'See full breakdown',
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return <ToolSection title={label}>{children}</ToolSection>
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'

interface StatConfig {
  end: number
  prefix: string
  suffix: string
  label: string
  decimals?: number
}

const STATS: StatConfig[] = [
  { end: 12400, prefix: '',  suffix: '+',  label: 'SKUs monitored daily',   decimals: 0 },
  { end: 2.1,   prefix: '$', suffix: 'M',  label: 'Revenue recovered MTD',  decimals: 1 },
  { end: 99.3,  prefix: '',  suffix: '%',  label: 'Scrape uptime',           decimals: 1 },
  { end: 15,    prefix: '< ',suffix: ' min',label: 'Avg signal latency',    decimals: 0 },
]

const PLATFORMS = ['Shopify', 'WooCommerce', 'Klaviyo', 'Slack', 'Stripe']

function CountStat({ end, prefix, suffix, label, decimals = 0 }: StatConfig) {
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const startTime = useRef<number | null>(null)
  const duration = 2000

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true) },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    function tick(ts: number) {
      if (!startTime.current) startTime.current = ts
      const elapsed = ts - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      setValue(parseFloat((easeOut(progress) * end).toFixed(decimals)))
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else setValue(end)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [started, end, decimals])

  const display = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <div ref={ref} className="stat-card text-center group">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span
          className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"
          aria-hidden="true"
        />
        <p
          className="font-display text-3xl md:text-4xl font-bold text-primary tabular-nums"
          aria-label={`${prefix}${end}${suffix}`}
        >
          {prefix}{display}{suffix}
        </p>
      </div>
      <p className="font-body text-sm text-muted">{label}</p>
    </div>
  )
}

export default function SocialProof() {
  const pillsRef = useScrollReveal<HTMLDivElement>({ y: 12 })

  return (
    <section className="py-16 border-y border-border bg-surface/40" aria-label="Key statistics">
      <div className="max-w-7xl mx-auto px-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {STATS.map((s) => (
            <CountStat key={s.label} {...s} />
          ))}
        </div>

        {/* Platform pills */}
        <div ref={pillsRef} className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs text-muted font-body mr-3">Integrates with</span>
          {PLATFORMS.map((p) => (
            <span
              key={p}
              className="px-4 py-1.5 rounded-full border border-border text-muted text-xs font-mono tracking-wide hover:border-primary/30 hover:text-text transition-colors duration-200 cursor-default"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

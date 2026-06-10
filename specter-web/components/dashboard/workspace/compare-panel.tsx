'use client'

import { GitCompare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Calculation } from '@/lib/calculations-api'

const PRETTY: Record<string, string> = {
  net_profit: 'Net profit',
  margin_pct: 'Margin %',
  roi_pct: 'ROI %',
  total_fees: 'Total fees',
  break_even_price: 'Break-even price',
  roas: 'ROAS',
  troas: 'True ROAS',
  break_even_roas: 'Break-even ROAS',
  true_profit: 'True profit',
  true_margin_pct: 'True margin %',
  eoq: 'EOQ',
  reorder_point: 'Reorder point',
  safety_stock: 'Safety stock',
  total_annual_cost: 'Total annual cost',
  inventory_turns: 'Inventory turns',
}

function pretty(key: string): string {
  return PRETTY[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function numericKeys(calcs: Calculation[]): string[] {
  const keys = new Set<string>()
  for (const c of calcs) {
    for (const [k, v] of Object.entries(c.results)) {
      if (typeof v === 'number' && Number.isFinite(v)) keys.add(k)
    }
  }
  return Array.from(keys)
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}

export default function ComparePanel({
  calcs,
  onClear,
}: {
  calcs: Calculation[]
  onClear: () => void
}) {
  if (calcs.length < 2) return null

  const keys = numericKeys(calcs)
  const baseline = calcs[0]

  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-primary" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-text">Compare reports</h2>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-text transition-colors"
        >
          <X size={13} aria-hidden="true" />
          Clear
        </button>
      </div>

      <p className="font-body text-xs text-muted mb-3">
        Deltas are shown against <span className="text-text">{baseline.name}</span> (the first selected).
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-body font-medium text-muted">Metric</th>
              {calcs.map((c) => (
                <th key={c.id} className="pb-2 px-3 font-body font-medium text-text text-right whitespace-nowrap">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const base = baseline.results[key]
              const baseNum = typeof base === 'number' ? base : null
              return (
                <tr key={key} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4 font-body text-muted whitespace-nowrap">{pretty(key)}</td>
                  {calcs.map((c, ci) => {
                    const v = c.results[key]
                    if (typeof v !== 'number' || !Number.isFinite(v)) {
                      return <td key={c.id} className="py-2 px-3 text-right font-mono text-muted">—</td>
                    }
                    const delta = ci > 0 && baseNum !== null ? v - baseNum : null
                    return (
                      <td key={c.id} className="py-2 px-3 text-right font-mono text-text whitespace-nowrap">
                        {fmt(v)}
                        {delta !== null && Math.abs(delta) > 1e-9 && (
                          <span
                            className={cn(
                              'ml-1.5 text-xs',
                              delta > 0 ? 'text-emerald-400' : 'text-rose-400',
                            )}
                          >
                            {delta > 0 ? '+' : '−'}
                            {fmt(Math.abs(delta))}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

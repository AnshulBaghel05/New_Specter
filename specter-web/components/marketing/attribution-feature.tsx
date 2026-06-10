'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { TrendingUp } from 'lucide-react'

const DATA = [
  { month: 'Dec', revenue: 4200,  growth: null },
  { month: 'Jan', revenue: 6800,  growth: '+62%' },
  { month: 'Feb', revenue: 9100,  growth: '+34%' },
  { month: 'Mar', revenue: 12400, growth: '+36%' },
  { month: 'Apr', revenue: 18900, growth: '+52%' },
  { month: 'May', revenue: 26300, growth: '+39%' },
]

interface TooltipPayload {
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = DATA.find(d => d.month === label)
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl shadow-black/40">
      <p className="font-mono text-xs text-muted mb-1">{label} 2025</p>
      <p className="font-display text-xl font-bold text-primary">
        ${payload[0].value.toLocaleString()}
      </p>
      <p className="font-body text-xs text-muted mb-2">revenue recovered</p>
      {entry?.growth && (
        <div className="flex items-center gap-1 border-t border-border pt-2">
          <TrendingUp size={11} className="text-emerald-400" />
          <span className="font-mono text-xs text-emerald-400">{entry.growth} MoM</span>
        </div>
      )}
    </div>
  )
}

export default function AttributionFeature() {
  const ref = useScrollReveal<HTMLDivElement>({ y: 20 })
  const copyRef = useScrollReveal<HTMLDivElement>({ y: 24 })
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <section id="attribution" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Chart */}
          <div ref={ref} className="bg-surface border border-border rounded-2xl p-6 hover:border-primary/20 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-mono text-xs text-muted uppercase tracking-widest">
                  Revenue Recovered
                </p>
                <p className="font-display text-3xl font-bold text-primary mt-1">
                  $26,300
                </p>
                <p className="font-body text-xs text-muted">This month · auto reprice</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="bg-primary/10 border border-primary/20 text-primary font-mono text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <TrendingUp size={12} aria-hidden="true" />
                  +38% MoM
                </div>
                <p className="font-mono text-xs text-muted">6-month trend</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={DATA}
                barSize={28}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1D2E" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(0,232,122,0.04)', radius: 4 }}
                />
                <Bar
                  dataKey="revenue"
                  radius={[4, 4, 0, 0]}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  isAnimationActive
                  animationDuration={1200}
                  animationEasing="ease-out"
                >
                  {DATA.map((_, index) => {
                    const isLast = index === DATA.length - 1
                    const isActive = activeIndex === index
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          isLast
                            ? 'url(#barGradient)'
                            : isActive
                            ? '#2a3040'
                            : '#1A1D2E'
                        }
                        opacity={activeIndex !== null && !isLast && activeIndex !== index ? 0.6 : 1}
                      />
                    )
                  })}
                </Bar>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00FF94" />
                    <stop offset="100%" stopColor="#00CC76" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Copy */}
          <div ref={copyRef}>
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
              Revenue Attribution
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-6 leading-tight" style={{ letterSpacing: '-0.025em' }}>
              See exactly how much{' '}
              <span className="text-primary">SPECTER earns you.</span>
            </h2>
            <p className="font-body text-muted text-lg leading-relaxed mb-8">
              Every auto-repriced price change is tracked end-to-end. SPECTER
              calculates the exact revenue delta attributable to its signals
              — so your ROI is never a guess.
            </p>
            <div className="flex flex-col gap-4">
              {[
                { metric: 'Avg ROI', value: '14× in 90 days' },
                { metric: 'Payback period', value: '< 3 weeks' },
                { metric: 'Revenue per signal', value: '$47 avg' },
              ].map(({ metric, value }) => (
                <div
                  key={metric}
                  className="flex items-center justify-between border-b border-border pb-4 group"
                >
                  <span className="font-body text-muted text-sm group-hover:text-text transition-colors duration-200">{metric}</span>
                  <span className="font-display font-bold text-text">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

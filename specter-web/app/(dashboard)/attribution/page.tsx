'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { TrendingUp, TrendingDown, Download, Sigma, Hash } from 'lucide-react'
import { useAttribution, usePriceChanges, downloadAttributionCsv } from '@/lib/api'
import LockedValueCard from '@/components/dashboard/locked-value-card'
import StatCard from '@/components/dashboard/stat-card'
import EmptyState from '@/components/dashboard/empty-state'
import AttributionInsightLine from '@/components/dashboard/attribution-insight-line'
import AttributionDayPanel from '@/components/dashboard/attribution-day-panel'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseDays, parseBreakdownSort, parseDay } from '@/lib/dashboard/url-params'
import {
  attributionAccountedChanges,
  skuBreakdown,
  sortSkuBreakdown,
  totalChangeCount,
  isBreakdownPartial,
  formatSignedUsd,
} from '@/lib/dashboard/attribution-breakdown'
import { attributionInsight } from '@/lib/dashboard/attribution-insight'
import { changesOnDay } from '@/lib/dashboard/attribution-day'

const RANGES = [7, 30, 90] as const
const SORTS = [
  { value: 'net', label: 'Net' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'lost', label: 'Lost' },
  { value: 'count', label: 'Changes' },
] as const

function usd(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

export default function AttributionPage() {
  const { get, set } = useQueryParams()
  const days = parseDays(get('days'))
  const sort = parseBreakdownSort(get('sku_sort'))
  const selectedDay = parseDay(get('day'))
  const { data, isLoading, error } = useAttribution(days)
  const { data: rawChanges } = usePriceChanges()
  const [downloading, setDownloading] = useState(false)

  // 403 → render the upgrade gate (backend is the real gate).
  if (error?.status === 403) {
    return (
      <LockedValueCard
        surface="platform_attribution"
        title="Revenue attribution"
        requiredPlan={error.body?.required_plan ?? 'phantom'}
        dismissible={false}
        problem="You can see prices change — but not what those changes actually did to your revenue."
        value={[
          'Day-by-day revenue recovered vs lost from each price move',
          'One clear net number you can take straight to your P&L',
          'CSV export for your bookkeeping',
        ]}
        why="Attribution is how you prove SPECTER paid for itself."
        preview={
          <div className="rounded-xl border border-border bg-bg p-3 font-mono text-xs flex items-center justify-between">
            <span className="text-muted">Net recovered (example)</span>
            <span className="text-emerald-400">+$1,240 / 30 days</span>
          </div>
        }
      />
    )
  }

  async function handleExport() {
    setDownloading(true)
    const id = toast.loading('Preparing export…')
    try {
      const ok = await downloadAttributionCsv()
      if (ok) {
        toast.success('Export ready', { id })
      } else {
        toast.error('Export failed — your plan may not include attribution exports.', { id })
      }
    } finally {
      setDownloading(false)
    }
  }

  const hasData = !!data && data.series.length > 0
  const changes = rawChanges ?? []
  const accounted = attributionAccountedChanges(changes, days)
  const breakdownRaw = skuBreakdown(accounted)
  const breakdown = sortSkuBreakdown(breakdownRaw, sort)
  const insight = data ? attributionInsight(data, breakdownRaw, days) : null
  const showDayPanel = !!selectedDay && !!data && data.series.some((p) => p.date === selectedDay)
  const dayChanges = selectedDay ? changesOnDay(accounted, selectedDay) : []

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Attribution</h1>
          <p className="font-body text-sm text-muted mt-1">
            Revenue impact of every automatic price change, attributed over the 24 hours
            after the change applied.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={downloading || !hasData}
          className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-xl bg-surface border border-border font-body text-sm text-text hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={15} aria-hidden="true" />
          {downloading ? 'Exporting…' : 'Export CSV'}
        </button>
      </header>

      {hasData && insight && <AttributionInsightLine insight={insight} />}

      {/* Summary stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Recovered"
          value={data ? usd(data.total_recovered) : '—'}
          icon={TrendingUp}
          accent="primary"
        />
        <StatCard
          label="Lost"
          value={data ? usd(-Math.abs(data.total_lost)) : '—'}
          icon={TrendingDown}
          accent="rose"
        />
        <StatCard
          label="Net impact"
          value={data ? usd(data.net) : '—'}
          icon={Sigma}
          accent={data && data.net < 0 ? 'rose' : 'primary'}
        />
        <StatCard
          label="Changes"
          value={totalChangeCount(breakdownRaw)}
          icon={Hash}
          accent="muted"
        />
      </section>

      {/* Range selector */}
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => set({ days: r === 30 ? null : String(r) })}
            className={
              'px-3 py-1.5 rounded-lg font-body text-xs font-medium transition-colors ' +
              (days === r
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-text hover:bg-border/40')
            }
          >
            {r}d
          </button>
        ))}
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-72 rounded-2xl bg-surface border border-border animate-pulse" />
      ) : !hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="No attributed changes yet"
          description="Once auto-reprice applies a price change and 24 hours of sales data come in, the revenue impact shows up here."
          cta={{ label: 'Configure repricing', href: '/repricing' }}
        />
      ) : (
        <section className="bg-surface border border-border rounded-2xl p-5">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={{ stroke: '#1A1D2E' }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v}`}
                width={48}
              />
              <Tooltip
                cursor={{ fill: '#1A1D2E55' }}
                contentStyle={{
                  background: '#0D0F1A',
                  border: '1px solid #1A1D2E',
                  borderRadius: 12,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#E8EAF0' }}
                formatter={(value: number) => [usd(value), 'Revenue Δ']}
              />
              <Bar
                dataKey="revenue_delta"
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(d: any) =>
                  d?.date && set({ day: d.date === selectedDay ? null : d.date })
                }
              >
                {data.series.map((point, i) => (
                  <Cell
                    key={i}
                    fill={point.revenue_delta >= 0 ? '#00E87A' : '#FB7185'}
                    fillOpacity={selectedDay && point.date !== selectedDay ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Day drill-down */}
      {showDayPanel && (
        <AttributionDayPanel
          day={selectedDay!}
          changes={dayChanges}
          onDismiss={() => set({ day: null })}
        />
      )}

      {/* Top movers leaderboard */}
      {hasData && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-text">Top movers</h2>
            <label className="flex items-center gap-2">
              <span className="font-body text-xs text-muted">Sort</span>
              <select
                value={sort}
                onChange={(e) => set({ sku_sort: e.target.value === 'net' ? null : e.target.value })}
                className="bg-surface border border-border rounded-lg px-2 py-1 font-body text-xs text-text"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isBreakdownPartial(changes.length) && (
            <p className="font-body text-xs text-muted">
              Breakdown is based on the most recent available changes and may not include
              older changes in this range.
            </p>
          )}

          {breakdown.length === 0 ? (
            <p className="font-body text-sm text-muted">
              No auto-reprice changes in this range to break down.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem_5rem_3.5rem] gap-4 px-4 font-body text-xs text-muted">
                <span>Product</span>
                <span className="text-right">Recovered</span>
                <span className="text-right">Lost</span>
                <span className="text-right">Net</span>
                <span className="text-right">Changes</span>
              </div>
              {breakdown.map((row) => (
                <div
                  key={row.sku_id}
                  className="grid grid-cols-[1fr_5rem_5rem_5rem_3.5rem] items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm text-text truncate">{row.sku_title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <Link
                        href={`/repricing?sku=${row.sku_id}`}
                        className="font-body text-xs text-primary hover:underline"
                      >
                        Review &amp; act
                      </Link>
                      <Link
                        href={`/products?q=${encodeURIComponent(row.sku_title)}`}
                        className="font-body text-xs text-muted hover:text-text transition-colors"
                      >
                        View product
                      </Link>
                    </div>
                  </div>
                  <span className="text-right font-mono text-xs tabular-nums text-primary">
                    {usd(row.recovered)}
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums text-rose-400">
                    {usd(row.lost)}
                  </span>
                  <span
                    className={cn(
                      'text-right font-mono text-xs tabular-nums',
                      row.net >= 0 ? 'text-primary' : 'text-rose-400',
                    )}
                  >
                    {formatSignedUsd(row.net)}
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums text-muted">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

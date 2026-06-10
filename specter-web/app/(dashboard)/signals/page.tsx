'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Radio, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSignals, useMerchant, type SignalType, type Signal } from '@/lib/api'
import SignalBadge from '@/components/dashboard/signal-badge'
import ConfidenceMeter from '@/components/dashboard/confidence-meter'
import SignalProvenance from '@/components/dashboard/signal-provenance'
import EmptyState from '@/components/dashboard/empty-state'
import DateRangePicker from '@/components/dashboard/date-range-picker'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseSignalType, parsePage, parseSignalSort, parseMinConfidence } from '@/lib/dashboard/url-params'
import { repricingHref } from '@/lib/dashboard/deep-links'
import { formatPriceDelta } from '@/lib/dashboard/price-delta'
import { groupSignalsByDay } from '@/lib/dashboard/group-signals'
import {
  parseRangeDays,
  presetAllowed,
  dateFromForDays,
  DEFAULT_RANGE_DAYS,
} from '@/lib/dashboard/date-range'

const PAGE_SIZE = 20

const SORTS: Array<{ label: string; value: 'recent' | 'confidence' }> = [
  { label: 'Newest', value: 'recent' },
  { label: 'Highest confidence', value: 'confidence' },
]

const THRESHOLDS: Array<{ label: string; value: number }> = [
  { label: 'All', value: 0 },
  { label: '50%+', value: 0.5 },
  { label: '70%+', value: 0.7 },
  { label: '90%+', value: 0.9 },
]

export default function SignalsPage() {
  const { get, set } = useQueryParams()
  const filter = parseSignalType(get('type'))
  const page = parsePage(get('page'))
  const sort = parseSignalSort(get('sort'))
  const minConfidence = parseMinConfidence(get('min'))

  const { data: merchant } = useMerchant()
  const plan = merchant?.plan
  // A hand-edited range the plan can't query falls back to the 30-day default,
  // so the picker never sends a request the backend would reject (400).
  const requestedDays = parseRangeDays(get('range'))
  const rangeDays = presetAllowed(requestedDays, plan) ? requestedDays : DEFAULT_RANGE_DAYS
  const dateFrom = rangeDays === DEFAULT_RANGE_DAYS ? undefined : dateFromForDays(rangeDays, new Date())

  const { data, isLoading } = useSignals({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    type: filter,
    sort,
    minConfidence,
    dateFrom,
  })

  const signals = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const counts = data?.counts

  const FILTERS: Array<{ label: string; value: SignalType | undefined; count?: number }> = [
    { label: 'All', value: undefined, count: counts ? counts.raise + counts.lower + counts.hold : undefined },
    { label: 'Raise', value: 'RAISE', count: counts?.raise },
    { label: 'Lower', value: 'LOWER', count: counts?.lower },
    { label: 'Hold', value: 'HOLD', count: counts?.hold },
  ]

  // Clamp a deep-linked / hand-edited page past the end once data loads.
  useEffect(() => {
    if (data && page > totalPages - 1) {
      const last = totalPages - 1
      set({ page: last > 0 ? String(last) : null })
    }
  }, [data, page, totalPages, set])

  function renderRow(sig: Signal) {
    const delta = formatPriceDelta(sig.current_price, sig.price_suggestion)
    return (
      <li
        key={sig.id}
        className="flex items-start gap-4 bg-surface border border-border rounded-xl px-4 py-3.5"
      >
        <SignalBadge type={sig.type} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-body text-sm font-medium text-text truncate">{sig.sku_title}</p>
            <SignalProvenance source={sig.source} aiFallback={sig.ai_fallback} />
          </div>
          {sig.reasoning && (
            <p className="font-body text-xs text-muted mt-0.5">{sig.reasoning}</p>
          )}
          {sig.price_suggestion !== null && (
            <p className="font-mono text-xs text-primary mt-1">
              Suggested: ${sig.price_suggestion.toFixed(2)}
              {delta && <span className="text-muted"> ({delta})</span>}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ConfidenceMeter confidence={sig.confidence} />
          <span className="font-body text-xs text-muted">{timeAgo(sig.created_at)}</span>
        </div>
        <Link
          href={repricingHref(sig.sku_id, 'signals')}
          className="font-body text-xs text-primary hover:underline shrink-0 self-center whitespace-nowrap"
        >
          Review &amp; act →
        </Link>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">Signals</h1>
        <p className="font-body text-sm text-muted mt-1">
          AI-powered RAISE / LOWER / HOLD recommendations across your tracked products.
        </p>
      </header>

      {/* Filter tabs with per-type counts */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => set({ type: f.value ?? null, page: null })}
            className={cn(
              'px-3.5 py-1.5 rounded-lg font-body text-sm transition-colors',
              filter === f.value
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-text hover:bg-border/40',
            )}
          >
            {f.label}
            {f.count !== undefined && (
              <span className="ml-1.5 font-mono text-xs opacity-70">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sort + min-confidence controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-body text-xs text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => set({ sort: e.target.value === 'recent' ? null : e.target.value, page: null })}
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-body text-xs text-muted">
          Min confidence
          <select
            value={String(minConfidence)}
            onChange={(e) => {
              const v = Number(e.target.value)
              set({ min: v === 0 ? null : String(v), page: null })
            }}
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
          >
            {THRESHOLDS.map((t) => (
              <option key={t.value} value={String(t.value)}>{t.label}</option>
            ))}
          </select>
        </label>
        <DateRangePicker
          plan={plan}
          selectedDays={rangeDays}
          onSelect={(days) =>
            set({ range: days === DEFAULT_RANGE_DAYS ? null : String(days), page: null })
          }
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[60px] rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No signals to show"
          description="Signals are generated after each scrape cycle once you're tracking competitors. Check back shortly, or adjust your filter."
          cta={{ label: 'Manage competitors', href: '/competitors' }}
        />
      ) : (
        <>
          {sort === 'recent' ? (
            <div className="flex flex-col gap-5">
              {groupSignalsByDay(signals, new Date()).map((group) => (
                <div key={group.label} className="flex flex-col gap-2">
                  <h2 className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    {group.label}
                  </h2>
                  <ul className="flex flex-col gap-2">{group.items.map(renderRow)}</ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">{signals.map(renderRow)}</ul>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="font-body text-xs text-muted">
              {total} signal{total === 1 ? '' : 's'} · page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => set({ page: page > 1 ? String(page - 1) : null })}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border font-body text-sm text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} />
                Prev
              </button>
              <button
                onClick={() => set({ page: String(page + 1) })}
                disabled={page + 1 >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border font-body text-sm text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

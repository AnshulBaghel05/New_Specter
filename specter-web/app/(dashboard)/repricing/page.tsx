'use client'

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Sparkles, History, Search } from 'lucide-react'
import {
  useRepricing,
  usePriceChanges,
  useUpdateRepriceSettings,
  useUpdateRepriceSKU,
  useApplyManualPrice,
  type RepriceSKU,
} from '@/lib/api'
import LockedValueCard from '@/components/dashboard/locked-value-card'
import SignalBadge from '@/components/dashboard/signal-badge'
import ConfidenceMeter from '@/components/dashboard/confidence-meter'
import RepricePreviewChip from '@/components/dashboard/reprice-preview-chip'
import RepriceCoverage from '@/components/dashboard/reprice-coverage'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/currency'
import { toast, formatApiError } from '@/lib/toast'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseRepriceFilter, parseRepriceSort, parseSearchQuery } from '@/lib/dashboard/url-params'
import { repricePrefill, formatLandingToast } from '@/lib/dashboard/reprice-prefill'
import { repricePreview } from '@/lib/dashboard/reprice-preview'
import { coverageSummary } from '@/lib/dashboard/guardrail-coverage'
import { validateBounds } from '@/lib/dashboard/bounds-validation'
import { changeLogSummary } from '@/lib/dashboard/change-log-summary'
import {
  searchRepriceSKUs,
  filterRepriceSKUs,
  sortRepriceSKUs,
} from '@/lib/dashboard/reprice-filter'

const FILTERS = [
  { label: 'All', value: 'all' as const },
  { label: 'Needs Attention', value: 'needs-attention' as const },
  { label: 'Needs Guardrails', value: 'needs-guardrails' as const },
  { label: 'Auto On', value: 'auto-on' as const },
  { label: 'Would Clamp', value: 'would-clamp' as const },
]

const SORTS = [
  { label: 'Default', value: 'default' as const },
  { label: 'Needs Attention First', value: 'attention' as const },
  { label: 'Impact', value: 'impact' as const },
]

export default function RepricingPage() {
  const { data, isLoading, error } = useRepricing()
  const { data: changes } = usePriceChanges()
  const settingsMut = useUpdateRepriceSettings()
  const skuMut = useUpdateRepriceSKU()

  const { get, set } = useQueryParams()
  const query = parseSearchQuery(get('q'))
  const filter = parseRepriceFilter(get('filter'))
  const sort = parseRepriceSort(get('sort'))

  const [focusedSkuId, setFocusedSkuId] = useState<string | null>(null)
  const handledSkuRef = useRef<string | null>(null)

  // Handle a ?sku deep-link once data has resolved, then strip the params.
  useEffect(() => {
    const skuId = get('sku')
    if (!skuId || !data) return // wait for the repricing list
    if (handledSkuRef.current === skuId) return // one-time per id
    handledSkuRef.current = skuId

    const match = data.skus.find((s) => s.id === skuId)
    if (match) {
      setFocusedSkuId(skuId)
      const t = formatLandingToast(match)
      toast(t.title, t.description ? { description: t.description } : undefined)
    } else {
      toast.error("That product isn't in your repricing list.")
    }
    set({ sku: null, source: null })
  }, [get, data, set])

  // 403 → render the upgrade gate (backend is the real gate).
  if (error?.status === 403) {
    return (
      <LockedValueCard
        surface="platform_repricing"
        title="Auto-repricing"
        requiredPlan={error.body?.required_plan ?? 'cipher'}
        dismissible={false}
        problem="Right now you adjust prices by hand — and every signal you act on late is margin left on the table."
        value={[
          'Floor & ceiling guardrails you set once',
          'SPECTER applies the price change to Shopify the moment a signal fires',
          'A full change log of every move it makes for you',
        ]}
        why="Repricing is the step that turns SPECTER's signals into automatic action — no spreadsheet, no manual edits."
        preview={
          <div className="rounded-xl border border-border bg-bg p-3 font-mono text-xs flex items-center justify-between">
            <span className="text-text">Acme Tee — $24.00</span>
            <span className="inline-flex items-center gap-2 text-emerald-400">
              RAISE → <span className="text-text">$26.50</span>
            </span>
          </div>
        }
      />
    )
  }

  const allSkus = data?.skus ?? []
  const displayed = sortRepriceSKUs(
    filterRepriceSKUs(searchRepriceSKUs(allSkus, query), filter),
    sort,
  )
  const logSummary = changeLogSummary(changes ?? [])

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Repricing</h1>
          <p className="font-body text-sm text-muted mt-1">
            Set guardrails per product. SPECTER applies changes to Shopify within 5 minutes
            of a signal.
          </p>
          {data && data.skus.length > 0 && (
            <div className="mt-2">
              <RepriceCoverage
                summary={coverageSummary(data.skus)}
                onFilter={(f) => set({ filter: f === 'all' ? null : f })}
              />
            </div>
          )}
        </div>
        {data && (
          <label className="flex items-center gap-2.5 shrink-0 mt-1">
            <span className="font-body text-sm text-muted">Auto-reprice</span>
            <button
              role="switch"
              aria-checked={data.global_auto_reprice_enabled}
              onClick={() =>
                settingsMut.mutate(
                  { auto_reprice_enabled: !data.global_auto_reprice_enabled },
                  {
                    onSuccess: () =>
                      toast.success(
                        `Auto-reprice turned ${!data.global_auto_reprice_enabled ? 'on' : 'off'}`,
                      ),
                  },
                )
              }
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                data.global_auto_reprice_enabled ? 'bg-primary' : 'bg-border',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-bg transition-transform',
                  data.global_auto_reprice_enabled && 'translate-x-5',
                )}
              />
            </button>
          </label>
        )}
      </header>

      {/* Search + filter + sort controls */}
      {data && data.skus.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => set({ q: e.target.value || null })}
              placeholder="Search products…"
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 font-body text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary/40"
            />
          </div>
          <label className="flex items-center gap-2 font-body text-xs text-muted">
            Filter
            <select
              value={filter}
              onChange={(e) => set({ filter: e.target.value === 'all' ? null : e.target.value })}
              className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 font-body text-xs text-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => set({ sort: e.target.value === 'default' ? null : e.target.value })}
              className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* SKU guardrail table */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : !data || data.skus.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No products to reprice yet"
          description="Connect your Shopify store to import products, then set floor and ceiling guardrails here."
          cta={{ label: 'Go to settings', href: '/settings' }}
        />
      ) : displayed.length === 0 ? (
        <p className="font-body text-sm text-muted">No products match the current search or filter.</p>
      ) : (
        <section className="flex flex-col gap-3">
          {displayed.map((sku) => (
            <SKURow
              key={sku.id}
              sku={sku}
              onSave={skuMut.mutateAsync}
              saving={skuMut.isPending}
              focused={sku.id === focusedSkuId}
            />
          ))}
        </section>
      )}

      {/* Price change log */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History size={16} className="text-muted" />
            <h2 className="font-display text-lg font-semibold text-text">Price change log</h2>
          </div>
          {logSummary.count > 0 && (
            <span className="font-mono text-xs text-muted">
              {logSummary.netRevenueDelta !== null ? (
                <span className={cn(logSummary.netRevenueDelta >= 0 ? 'text-primary' : 'text-rose-400')}>
                  net {logSummary.netRevenueDelta >= 0 ? '+' : '−'}${Math.abs(logSummary.netRevenueDelta).toFixed(2)}
                </span>
              ) : (
                <span>net —</span>
              )}
              {' '}over {logSummary.count} change{logSummary.count === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {!changes || changes.length === 0 ? (
          <p className="font-body text-sm text-muted">
            No automatic price changes yet. They&apos;ll appear here once auto-reprice fires.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {changes.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-text truncate">{c.sku_title}</p>
                  <p className="font-mono text-xs text-muted mt-0.5">
                    ${c.old_price.toFixed(2)} → ${c.new_price.toFixed(2)}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted shrink-0">
                  {c.source}
                </span>
                {c.revenue_delta !== null && (
                  <span
                    className={cn(
                      'font-mono text-xs tabular-nums shrink-0',
                      c.revenue_delta >= 0 ? 'text-primary' : 'text-rose-400',
                    )}
                  >
                    {c.revenue_delta >= 0 ? '+' : ''}${c.revenue_delta.toFixed(2)}
                  </span>
                )}
                <span className="font-body text-xs text-muted shrink-0 w-16 text-right">
                  {timeAgo(c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SKURow({
  sku,
  onSave,
  saving,
  focused,
}: {
  sku: RepriceSKU
  onSave: (input: { id: string; floor_price?: number; ceiling_price?: number; auto_reprice_enabled?: boolean }) => Promise<unknown>
  saving: boolean
  focused: boolean
}) {
  const [floor, setFloor] = useState(sku.floor_price?.toString() ?? '')
  const [ceiling, setCeiling] = useState(sku.ceiling_price?.toString() ?? '')
  const rowRef = useRef<HTMLDivElement>(null)
  const floorRef = useRef<HTMLInputElement>(null)
  const ceilingRef = useRef<HTMLInputElement>(null)
  const handledRef = useRef(false)
  const [highlight, setHighlight] = useState(false)

  const dirty =
    floor !== (sku.floor_price?.toString() ?? '') ||
    ceiling !== (sku.ceiling_price?.toString() ?? '')
  const boundsError = validateBounds(floor, ceiling)
  const preview = repricePreview(sku)

  // When this row becomes the deep-link target: scroll to it, highlight (fades),
  // and prefill the suggested bound IF that bound is empty. Runs once.
  useEffect(() => {
    if (!focused || handledRef.current) return
    handledRef.current = true
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlight(true)
    const timer = setTimeout(() => setHighlight(false), 4000)

    const { bound, value } = repricePrefill(sku)
    if (bound === 'ceiling' && value && sku.ceiling_price === null) {
      setCeiling(value)
      ceilingRef.current?.focus()
    } else if (bound === 'floor' && value && sku.floor_price === null) {
      setFloor(value)
      floorRef.current?.focus()
    }
    return () => clearTimeout(timer)
    // Run only when the row becomes focused; sku is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused])

  return (
    <div
      ref={rowRef}
      className={cn(
        'bg-surface border rounded-xl px-4 py-3.5 flex flex-col gap-3 transition-all',
        highlight ? 'border-primary/60 ring-2 ring-primary/40' : 'border-border',
      )}
    >
      <div className="flex items-center gap-3">
        <p className="font-body text-sm font-medium text-text flex-1 truncate">{sku.title}</p>
        {sku.latest_suggestion && (
          <span className="flex items-center gap-2 shrink-0">
            <SignalBadge type={sku.latest_suggestion.type} />
            {sku.latest_suggestion.price_suggestion !== null && (
              <span className="flex items-center gap-1 font-mono text-xs text-primary">
                <Sparkles size={11} />
                {formatMoney(sku.latest_suggestion.price_suggestion, sku.currency)}
              </span>
            )}
            <ConfidenceMeter confidence={sku.latest_suggestion.confidence} />
          </span>
        )}
      </div>

      {/* One-click apply — the suggestion is shown above; this writes it to the
          live Shopify store after an explicit confirm. Never auto-pushes. */}
      {sku.latest_suggestion?.price_suggestion != null && (
        <ApplySuggestion
          skuId={sku.id}
          suggested={sku.latest_suggestion.price_suggestion}
          currency={sku.currency}
        />
      )}

      {/* Projected price preview */}
      <RepricePreviewChip preview={preview} currentPrice={sku.current_price} currency={sku.currency} />

      <div className="flex items-end gap-3 flex-wrap">
        <span className="font-mono text-xs text-muted">
          Current: {formatMoney(sku.current_price, sku.currency)}
        </span>
        <Bound label="Floor" value={floor} onChange={setFloor} inputRef={floorRef} />
        <Bound label="Ceiling" value={ceiling} onChange={setCeiling} inputRef={ceilingRef} />

        <button
          onClick={async () => {
            try {
              await onSave({
                id: sku.id,
                floor_price: floor ? Number(floor) : undefined,
                ceiling_price: ceiling ? Number(ceiling) : undefined,
              })
              toast.success('Guardrails saved')
            } catch {
              /* error toast handled by the global mutation net */
            }
          }}
          disabled={!dirty || saving || boundsError !== null}
          className="px-4 py-1.5 rounded-lg bg-primary/10 text-primary font-body text-sm font-medium hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>

        <label className="flex items-center gap-2 ml-auto">
          <span className="font-body text-xs text-muted">Auto</span>
          <button
            role="switch"
            aria-checked={sku.auto_reprice_enabled}
            onClick={async () => {
              try {
                await onSave({ id: sku.id, auto_reprice_enabled: !sku.auto_reprice_enabled })
                toast.success(
                  `Auto-reprice ${!sku.auto_reprice_enabled ? 'enabled' : 'disabled'} for this product`,
                )
              } catch {
                /* error toast handled by the global mutation net */
              }
            }}
            className={cn(
              'relative w-9 h-5 rounded-full transition-colors',
              sku.auto_reprice_enabled ? 'bg-primary' : 'bg-border',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-bg transition-transform',
                sku.auto_reprice_enabled && 'translate-x-4',
              )}
            />
          </button>
        </label>
      </div>

      {boundsError && (
        <p className="font-body text-xs text-rose-400">{boundsError}</p>
      )}
    </div>
  )
}

function Bound({
  label,
  value,
  onChange,
  inputRef,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-body text-xs text-muted">{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">$</span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-24 bg-bg border border-border rounded-lg pl-5 pr-2 py-1.5 font-mono text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>
    </div>
  )
}

/**
 * One-click "Apply price" with an inline confirm step. The suggested price is
 * already shown on the row; clicking Apply reveals a confirm/cancel, and only the
 * explicit confirm writes to the live Shopify store. Errors (reconnect / write
 * failure) surface as toasts; the dashboard refreshes via cache invalidation.
 */
function ApplySuggestion({
  skuId,
  suggested,
  currency,
}: {
  skuId: string
  suggested: number
  currency: string
}) {
  const [confirming, setConfirming] = useState(false)
  const apply = useApplyManualPrice()

  function doApply() {
    apply.mutate(
      { id: skuId, new_price: suggested },
      {
        onSuccess: (r) => {
          setConfirming(false)
          toast.success(`Price updated to ${formatMoney(r.new_price, currency)} on Shopify`)
        },
        onError: (e) => {
          setConfirming(false)
          toast.error(formatApiError(e))
        },
      },
    )
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="self-start inline-flex items-center gap-1.5 border border-primary/40 text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg font-body text-xs font-semibold transition-colors"
      >
        Apply {formatMoney(suggested, currency)} to Shopify
      </button>
    )
  }

  return (
    <div className="self-start flex items-center gap-2">
      <span className="font-body text-xs text-muted">
        Write {formatMoney(suggested, currency)} to your live store?
      </span>
      <button
        type="button"
        onClick={doApply}
        disabled={apply.isPending}
        className="gradient-primary-cta px-3 py-1.5 rounded-lg font-body text-xs font-semibold disabled:opacity-50"
      >
        {apply.isPending ? 'Applying…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={apply.isPending}
        className="font-body text-xs text-muted hover:text-text"
      >
        Cancel
      </button>
    </div>
  )
}

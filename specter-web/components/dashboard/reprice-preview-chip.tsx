import type { RepricePreview, RepriceState } from '@/lib/dashboard/reprice-preview'
import { formatPriceDelta } from '@/lib/dashboard/price-delta'
import { cn } from '@/lib/utils'

const LABEL: Record<RepriceState, string> = {
  within: 'Within bounds',
  'floor-clamped': 'Floor-clamped',
  'ceiling-clamped': 'Ceiling-clamped',
  'no-guardrails': 'No guardrails',
  'no-action': '—',
}

const STYLE: Record<RepriceState, string> = {
  within: 'border-primary/25 bg-primary/10 text-primary',
  'floor-clamped': 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  'ceiling-clamped': 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  'no-guardrails': 'border-amber-400/30 text-muted',
  'no-action': 'border-border text-muted',
}

export default function RepricePreviewChip({
  preview,
  currentPrice,
}: {
  preview: RepricePreview
  currentPrice: number | null
}) {
  const { state, effectivePrice } = preview
  if (state === 'no-action') {
    return <span className="font-mono text-xs text-muted">—</span>
  }
  const delta = formatPriceDelta(currentPrice, effectivePrice)
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs',
          STYLE[state],
        )}
      >
        {LABEL[state]}
      </span>
      {effectivePrice !== null && (
        <span className="font-mono text-xs text-text tabular-nums">
          → ${effectivePrice.toFixed(2)}
          {delta && <span className="text-muted"> ({delta})</span>}
        </span>
      )}
    </span>
  )
}

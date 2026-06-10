import type { CoverageSummary } from '@/lib/dashboard/guardrail-coverage'
import type { RepriceFilter } from '@/lib/dashboard/reprice-filter'
import { cn } from '@/lib/utils'

export default function RepriceCoverage({
  summary,
  onFilter,
}: {
  summary: CoverageSummary
  onFilter: (f: RepriceFilter) => void
}) {
  const { total, withGuardrails, autoOn, needsAttention } = summary
  if (total === 0) return null
  return (
    <p className="font-mono text-xs text-muted flex items-center gap-2 flex-wrap">
      <span>
        <span className="text-text">{withGuardrails}/{total}</span> guardrails
      </span>
      <span className="text-muted/40">·</span>
      <button
        type="button"
        onClick={() => onFilter('auto-on')}
        className="hover:text-text transition-colors underline-offset-2 hover:underline"
      >
        {autoOn} auto-on
      </button>
      <span className="text-muted/40">·</span>
      <button
        type="button"
        onClick={() => onFilter('needs-attention')}
        className={cn(
          'transition-colors underline-offset-2 hover:underline',
          needsAttention > 0 ? 'text-rose-400 hover:text-rose-300' : 'text-muted hover:text-text',
        )}
      >
        {needsAttention} need attention
      </button>
    </p>
  )
}

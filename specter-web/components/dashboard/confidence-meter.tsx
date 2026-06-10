import { confidenceTier, type ConfidenceTier } from '@/lib/dashboard/confidence'
import { cn } from '@/lib/utils'

const BAR: Record<ConfidenceTier, string> = {
  high: 'bg-primary',
  medium: 'bg-amber-400',
  low: 'bg-muted',
}

const TEXT: Record<ConfidenceTier, string> = {
  high: 'text-primary',
  medium: 'text-amber-400',
  low: 'text-muted',
}

const LABEL: Record<ConfidenceTier, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
}

export default function ConfidenceMeter({ confidence }: { confidence: number }) {
  const tier = confidenceTier(confidence)
  const pct = Math.round(confidence * 100)
  return (
    <div className="flex flex-col items-end gap-1 w-20">
      <span className={cn('font-mono text-xs tabular-nums', TEXT[tier])}>
        {pct}% · {LABEL[tier]}
      </span>
      <div className="h-1 w-full rounded-full bg-border overflow-hidden">
        <div className={cn('h-full rounded-full', BAR[tier])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

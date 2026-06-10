import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SignalProvenance({
  source,
  aiFallback,
}: {
  source: 'ai' | 'rule'
  aiFallback: boolean
}) {
  if (source === 'ai' && !aiFallback) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
        <Sparkles size={10} aria-hidden="true" />
        AI
      </span>
    )
  }
  if (source === 'ai' && aiFallback) {
    return (
      <span
        title="The AI call failed; this signal fell back to rule-based logic."
        className="inline-flex items-center rounded-md border border-amber-400/25 bg-amber-400/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-400"
      >
        AI·fallback
      </span>
    )
  }
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border border-muted/30 bg-muted/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted',
    )}>
      Rule
    </span>
  )
}

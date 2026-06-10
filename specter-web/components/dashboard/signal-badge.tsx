import { cn } from '@/lib/utils'
import type { SignalType } from '@/lib/api'

const STYLES: Record<SignalType, string> = {
  RAISE: 'bg-primary/12 text-primary border-primary/25',
  LOWER: 'bg-rose-400/12 text-rose-400 border-rose-400/25',
  HOLD: 'bg-muted/15 text-muted border-muted/30',
}

export default function SignalBadge({
  type,
  className,
}: {
  type: SignalType
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide',
        STYLES[type],
        className,
      )}
    >
      {type}
    </span>
  )
}

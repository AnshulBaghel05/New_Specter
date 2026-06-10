'use client'

import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type GateLevel, getGateLabel } from '@/lib/feature-gates'

interface PreviewBadgeProps {
  level: GateLevel
  className?: string
}

export default function PreviewBadge({ level, className }: PreviewBadgeProps) {
  if (level === 'free') return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase tracking-wider',
        'bg-primary/10 border border-primary/20 text-primary',
        className,
      )}
      aria-label={`Requires ${getGateLabel(level)}`}
    >
      <Lock size={8} aria-hidden="true" />
      {getGateLabel(level)}
    </span>
  )
}

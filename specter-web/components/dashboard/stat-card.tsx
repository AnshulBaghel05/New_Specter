import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
  loading,
  href,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  accent?: 'primary' | 'rose' | 'muted'
  hint?: string
  loading?: boolean
  href?: string
}) {
  const accentColor =
    accent === 'primary'
      ? 'text-primary'
      : accent === 'rose'
        ? 'text-rose-400'
        : 'text-text'

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-body text-sm text-muted">{label}</span>
        {Icon && <Icon size={16} className="text-muted" aria-hidden="true" />}
      </div>
      {loading ? (
        <div className="h-8 w-20 rounded-md bg-border/60 animate-pulse" />
      ) : (
        <span className={cn('font-display text-3xl font-bold tabular-nums', accentColor)}>
          {value}
        </span>
      )}
      {hint && <span className="font-body text-xs text-muted">{hint}</span>}
    </>
  )

  const base = 'bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3'

  if (href) {
    return (
      <Link href={href} className={cn(base, 'hover:border-primary/40 transition-colors')}>
        {inner}
      </Link>
    )
  }

  return <div className={base}>{inner}</div>
}

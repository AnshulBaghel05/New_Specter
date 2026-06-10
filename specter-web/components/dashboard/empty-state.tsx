import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: LucideIcon
  title: string
  description: string
  cta?: { label: string; href: string }
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-surface border border-border border-dashed rounded-2xl">
      <div className="w-12 h-12 rounded-xl bg-border/40 flex items-center justify-center mb-4">
        <Icon size={22} className="text-muted" aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-semibold text-text mb-1.5">{title}</h3>
      <p className="font-body text-sm text-muted max-w-sm mb-5">{description}</p>
      {cta && (
        <Link
          href={cta.href}
          className="gradient-primary-cta btn-ripple px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
        >
          {cta.label}
        </Link>
      )}
    </div>
  )
}

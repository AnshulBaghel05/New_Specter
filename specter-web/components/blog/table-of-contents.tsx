import { List } from 'lucide-react'

/** In-article table of contents — anchor links to each H2 section. */
export default function TableOfContents({ items }: { items: { id: string; label: string }[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Table of contents" className="bg-surface border border-border rounded-2xl p-5">
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted mb-3">
        <List size={13} className="text-primary" /> On this page
      </p>
      <ol className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={item.id} className="flex gap-2.5">
            <span className="font-mono text-[11px] text-primary/60 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
            <a href={`#${item.id}`} className="font-body text-sm text-muted hover:text-primary transition-colors leading-snug">
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

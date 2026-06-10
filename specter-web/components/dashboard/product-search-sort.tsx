'use client'

import { Search } from 'lucide-react'
import type { ProductSort } from '@/lib/dashboard/sort-products'

export default function ProductSearchSort({
  query, onQuery, sort, onSort,
}: { query: string; onQuery: (v: string) => void; sort: ProductSort; onSort: (s: ProductSort) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="relative flex-1 min-w-48 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>
      <label className="flex items-center gap-2 font-mono text-xs text-muted">
        Sort:
        <select
          value={sort}
          onChange={e => onSort(e.target.value as ProductSort)}
          className="bg-surface border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-primary/60"
        >
          <option value="signals">Signals first</option>
          <option value="updated">Recently updated</option>
          <option value="name">Name A–Z</option>
        </select>
      </label>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'

export interface SearchIndexItem {
  slug: string
  title: string
  excerpt: string
  category: string
  categoryLabel: string
  tags: string[]
  keyword: string
}

/** Client-side blog search. Operates on a lightweight index (no article bodies
 * shipped to the client). Results appear only while a query is active. */
export default function BlogSearch({ items }: { items: SearchIndexItem[] }) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items
      .filter((it) => [it.title, it.excerpt, it.keyword, it.categoryLabel, ...it.tags].join(' ').toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, items])

  return (
    <div className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles — pricing, competitors, margins…"
          aria-label="Search the blog"
          className="w-full bg-surface border border-border rounded-xl pl-10 pr-10 py-3 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {query.trim() && (
        <div className="absolute z-20 mt-2 w-full bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
          {results.length === 0 ? (
            <p className="px-4 py-4 font-body text-sm text-muted">No articles match “{query}”.</p>
          ) : (
            <ul>
              {results.map((it) => (
                <li key={it.slug}>
                  <Link
                    href={`/blog/${it.slug}`}
                    className="block px-4 py-3 hover:bg-primary/[0.05] transition-colors border-b border-border last:border-b-0"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{it.categoryLabel}</span>
                    <p className="font-body text-sm text-text leading-snug mt-0.5">{it.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

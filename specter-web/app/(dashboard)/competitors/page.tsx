'use client'

import { useEffect, useMemo, useState } from 'react'
import { Globe, Search } from 'lucide-react'
import Link from 'next/link'
import { useProducts } from '@/lib/api'
import { groupByDomain, type DomainGroup } from '@/lib/dashboard/group-by-domain'
import CompetitorDomainGroup from '@/components/dashboard/competitor-domain-group'
import EmptyState from '@/components/dashboard/empty-state'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseDomainSort } from '@/lib/dashboard/url-params'

export default function CompetitorsPage() {
  const { data, isLoading, error } = useProducts()
  const { get, set } = useQueryParams()
  const sort = parseDomainSort(get('sort'))
  const [query, setQuery] = useState(() => get('q') ?? '')

  // Keep typing responsive (local state); sync to the URL after a 300ms pause.
  useEffect(() => {
    const current = get('q') ?? ''
    if (query === current) return
    const id = setTimeout(() => set({ q: query.trim() || null }), 300)
    return () => clearTimeout(id)
  }, [query, get, set])

  const allGroups = useMemo<DomainGroup[]>(() => groupByDomain(data?.items ?? []), [data?.items])
  const groups = useMemo<DomainGroup[]>(() => {
    const q = query.trim().toLowerCase()
    const g = q ? allGroups.filter(x => x.domain.includes(q)) : allGroups
    return [...g].sort((a, b) =>
      sort === 'name' ? a.domain.localeCompare(b.domain)
      : sort === 'oos' ? b.oos - a.oos
      : b.productCount - a.productCount)
  }, [allGroups, query, sort])

  const rivals = allGroups.length
  const skus = (data?.items ?? []).reduce((n, p) => n + p.competitor_count, 0)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">Competitors</h1>
        <p className="font-body text-sm text-muted mt-1">
          Your rivals, grouped by domain. Link competitors from the{' '}
          <Link href="/products" className="text-primary hover:underline">Products page →</Link>
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-2">{[0,1,2].map(i => <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 font-body text-sm text-rose-300">Couldn&rsquo;t load competitors. Refresh to try again.</div>
      ) : allGroups.length === 0 ? (
        <EmptyState icon={Globe} title="No competitors tracked yet" description="Go to the Products page, pick a product, and link a competitor URL to start monitoring." />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-mono text-xs text-muted">tracking {rivals} rivals across {skus} SKUs</p>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search domains…" aria-label="Search domains"
                  className="bg-bg border border-border rounded-xl pl-9 pr-3 py-2 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60" />
              </div>
              <label className="flex items-center gap-2 font-mono text-xs text-muted">
                Sort:
                <select value={sort} onChange={e => set({ sort: e.target.value === 'products' ? null : e.target.value })} className="bg-surface border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-primary/60">
                  <option value="products">Most products</option>
                  <option value="oos">Most OOS</option>
                  <option value="name">Domain A–Z</option>
                </select>
              </label>
            </div>
          </div>
          {groups.length === 0 ? (
            <p className="font-body text-sm text-muted px-1 py-6 text-center">No domains match &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {groups.map(g => <CompetitorDomainGroup key={g.domain} group={g} />)}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

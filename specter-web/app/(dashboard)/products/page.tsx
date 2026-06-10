'use client'

import { useEffect, useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import { useProducts } from '@/lib/api'
import SkuMeter from '@/components/dashboard/sku-meter'
import EmptyState from '@/components/dashboard/empty-state'
import ProductSearchSort from '@/components/dashboard/product-search-sort'
import ProductRow from '@/components/dashboard/product-row'
import AddProductForm from '@/components/dashboard/add-product-form'
import { sortProducts } from '@/lib/dashboard/sort-products'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseProductSort } from '@/lib/dashboard/url-params'

export default function ProductsPage() {
  const { data, isLoading, error } = useProducts()

  const atSkuLimit = data?.sku_limit != null && data.sku_used >= data.sku_limit

  const { get, set } = useQueryParams()
  const sort = parseProductSort(get('sort'))
  const [query, setQuery] = useState(() => get('q') ?? '')

  // Keep typing responsive (local state); sync to the URL after a 300ms pause.
  useEffect(() => {
    const current = get('q') ?? ''
    if (query === current) return
    const id = setTimeout(() => set({ q: query.trim() || null }), 300)
    return () => clearTimeout(id)
  }, [query, get, set])

  const visible = useMemo(() => {
    const items = data?.items ?? []
    const filtered = query.trim()
      ? items.filter(p => p.title.toLowerCase().includes(query.trim().toLowerCase()))
      : items
    return sortProducts(filtered, sort)
  }, [data?.items, query, sort])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Products</h1>
          <p className="font-body text-sm text-muted mt-1">
            Add a product, link the competitors you want to track, and watch its signal.
          </p>
        </div>
        {data && (
          <SkuMeter used={data.sku_used} limit={data.sku_limit} maxCompetitors={data.max_competitors_per_sku} />
        )}
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 font-body text-sm text-rose-300">
          Couldn&rsquo;t load products. Refresh to try again.
        </div>
      ) : !data || data.items.length === 0 ? (
        <>
          <EmptyState
            icon={Boxes}
            title="No products yet"
            description="Add a product manually, or connect your store in Settings to import them — then link competitors to start getting signals."
          />
          <div className="flex justify-center">
            <AddProductForm />
          </div>
        </>
      ) : (
        <>
          {atSkuLimit ? (
            <a href="/pricing" className="font-body text-sm text-amber-400 hover:underline w-fit">SKU limit reached — upgrade to track more →</a>
          ) : (
            <AddProductForm />
          )}
          <ProductSearchSort
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={(s) => set({ sort: s === 'signals' ? null : s })}
          />
          <ul className="flex flex-col gap-2">
            {visible.map(p => <ProductRow key={p.id} product={p} maxCompetitors={data!.max_competitors_per_sku} />)}
          </ul>
        </>
      )}
    </div>
  )
}

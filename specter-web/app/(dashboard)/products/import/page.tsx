'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Boxes, Search, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import {
  useMerchant,
  useShopifyProducts,
  useImportShopifyProducts,
  type ShopifyVariant,
} from '@/lib/api'
import { toast, formatApiError } from '@/lib/toast'
import { cn } from '@/lib/utils'

/**
 * Guided Shopify product import. Connected merchants browse their live catalog,
 * search, pick specific variants (or "import all"), and see a clear result. The
 * server enforces the product ceiling and skips already-imported variants.
 */
export default function ImportProductsPage() {
  const router = useRouter()
  const { data: merchant } = useMerchant()
  const connected = merchant?.shopify_connected && !merchant?.shopify_reconnect_required

  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Debounce the search box → server fetch.
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 350)
    return () => clearTimeout(id)
  }, [query])

  const { data, isLoading, error } = useShopifyProducts({
    search,
    enabled: Boolean(connected),
  })
  const importMut = useImportShopifyProducts()

  const products = useMemo(() => data?.products ?? [], [data?.products])
  const selectableCount = useMemo(
    () => products.reduce((n, p) => n + p.variants.filter(v => !v.imported).length, 0),
    [products],
  )

  function toggle(v: ShopifyVariant) {
    if (v.imported) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(v.variant_id)) next.delete(v.variant_id)
      else next.add(v.variant_id)
      return next
    })
  }

  function importSelected() {
    if (selected.size === 0) return
    importMut.mutate(
      { variant_ids: Array.from(selected) },
      {
        onSuccess: (r) => {
          toast.success(`Imported ${r.imported} product${r.imported === 1 ? '' : 's'}` +
            (r.skipped ? ` · ${r.skipped} already imported` : ''))
          router.push('/products')
        },
        onError: (e) => toast.error(formatApiError(e)),
      },
    )
  }

  function importAll() {
    importMut.mutate(
      { import_all: true },
      {
        onSuccess: (r) => {
          toast.success(`Imported ${r.imported} product${r.imported === 1 ? '' : 's'}` +
            (r.skipped ? ` · ${r.skipped} already imported` : ''))
          router.push('/products')
        },
        onError: (e) => toast.error(formatApiError(e)),
      },
    )
  }

  // Not connected → guide them to Settings first.
  if (merchant && !connected) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <BackLink />
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <Boxes size={28} className="mx-auto text-muted/60" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-text mt-3">Connect Shopify to import</h1>
          <p className="font-body text-sm text-muted mt-2">
            {merchant.shopify_reconnect_required
              ? 'Your Shopify connection needs to be re-authorized before you can import products.'
              : 'Link your Shopify store, then come back here to choose which products to monitor.'}
          </p>
          <Link href="/settings" className="gradient-primary-cta btn-ripple inline-block mt-5 px-5 py-2.5 rounded-xl font-semibold text-sm">
            Go to Settings →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Import products</h1>
          <p className="font-body text-sm text-muted mt-1">
            Pick the products you want to monitor — you don&rsquo;t have to import your whole catalog.
          </p>
        </div>
        <button
          type="button"
          onClick={importAll}
          disabled={importMut.isPending}
          className="border border-border text-muted hover:text-text hover:border-primary/40 px-4 py-2 rounded-xl font-body text-sm transition-colors disabled:opacity-50"
        >
          {importMut.isPending ? 'Importing…' : 'Import all'}
        </button>
      </header>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your products…"
          className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2.5 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-surface border border-border animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 font-body text-sm text-rose-300">
          {formatApiError(error)}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center font-body text-sm text-muted">
          No products found{search ? ` for “${search}”` : ''}.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map(p => (
            <li key={p.product_id} className="bg-surface border border-border rounded-xl p-3">
              <p className="font-body text-sm text-text mb-2">{p.title}</p>
              <div className="flex flex-col gap-1.5">
                {p.variants.map(v => (
                  <button
                    key={v.variant_id}
                    type="button"
                    onClick={() => toggle(v)}
                    disabled={v.imported}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                      v.imported
                        ? 'bg-border/20 cursor-default'
                        : selected.has(v.variant_id)
                          ? 'bg-primary/10 border border-primary/40'
                          : 'border border-border hover:border-primary/30',
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                        v.imported || selected.has(v.variant_id) ? 'bg-primary/20 border-primary/50' : 'border-border',
                      )}>
                        {(v.imported || selected.has(v.variant_id)) && <CheckCircle2 size={11} className="text-primary" />}
                      </span>
                      <span className="font-mono text-xs text-muted truncate">{v.title}</span>
                    </span>
                    <span className="font-mono text-xs text-muted shrink-0">
                      {v.imported ? 'Imported' : v.price != null ? `$${Number(v.price).toFixed(2)}` : '—'}
                    </span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Sticky action bar */}
      {selectableCount > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-surface border border-border rounded-2xl px-4 py-3 shadow-xl">
          <span className="font-body text-sm text-muted">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={importSelected}
            disabled={selected.size === 0 || importMut.isPending}
            className="gradient-primary-cta btn-ripple px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
          >
            {importMut.isPending && <Loader2 size={14} className="animate-spin" />}
            Import {selected.size > 0 ? selected.size : ''} selected
          </button>
        </div>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link href="/products" className="inline-flex items-center gap-1.5 font-body text-sm text-muted hover:text-text transition-colors w-fit">
      <ArrowLeft size={14} /> Back to products
    </Link>
  )
}

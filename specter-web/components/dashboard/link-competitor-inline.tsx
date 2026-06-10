'use client'

import { useState } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { useAddCompetitor, ApiError } from '@/lib/api'
import { toast } from '@/lib/toast'

export default function LinkCompetitorInline({ productId, atProductLimit }: { productId: string; atProductLimit: boolean }) {
  const add = useAddCompetitor()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (atProductLimit) {
    return <p className="font-body text-xs text-muted">Max competitors reached on your plan — <a href="/pricing" className="text-primary hover:underline">upgrade for more</a>.</p>
  }

  async function submit() {
    setErr(null)
    try {
      await add.mutateAsync({ url: url.trim(), own_product_id: productId })
      toast.success('Competitor added')
      setUrl(''); setOpen(false)
    } catch (e) {
      if (e instanceof ApiError) {
        const b = e.body
        setErr(
          b?.error === 'sku_limit_reached' ? `SKU limit reached (${b.used}/${b.limit}). Upgrade to track more.`
          : b?.error === 'competitor_limit_reached' ? `Max ${b.limit} competitors for this product on your plan.`
          : b?.error === 'already_tracking' ? 'This URL is already tracked for this product.'
          : b?.error === 'url_unreachable' ? 'Could not reach that URL — make sure it is public.'
          : b?.message ?? 'Could not link competitor.')
      } else setErr('Could not link competitor.')
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 w-fit">
        <Plus size={12} /> link a competitor
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          autoFocus value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="https://competitor.com/products/their-product"
          className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 font-body text-xs text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60"
        />
        <button onClick={submit} disabled={add.isPending || !url.trim()} className="gradient-primary-cta px-3 rounded-lg font-semibold text-xs disabled:opacity-40">
          {add.isPending ? 'Linking…' : 'Link'}
        </button>
      </div>
      {err && <p className="flex items-center gap-1.5 font-body text-xs text-rose-400"><AlertTriangle size={12} /> {err}</p>}
    </div>
  )
}

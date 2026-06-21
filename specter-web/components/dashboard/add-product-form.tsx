'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCreateSKU } from '@/lib/api'
import { toast } from '@/lib/toast'
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currency'

export default function AddProductForm() {
  const create = useCreateSKU()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)

  async function submit() {
    if (!title.trim()) return
    try {
      await create.mutateAsync({ title: title.trim(), current_price: price || undefined, currency })
      toast.success('Product added')
      setTitle(''); setPrice(''); setCurrency(DEFAULT_CURRENCY); setOpen(false)
    } catch {
      /* error toast handled by the global mutation net */
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="gradient-primary-cta btn-ripple flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm w-fit">
        <Plus size={15} /> Add product
      </button>
    )
  }
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_6rem_7rem] gap-2">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Product title"
          className="bg-bg border border-border rounded-lg px-3 py-2 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60" />
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" step="0.01" min="0"
          className="bg-bg border border-border rounded-lg px-3 py-2 font-mono text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60" />
        <select value={currency} onChange={e => setCurrency(e.target.value)} aria-label="Currency"
          className="bg-bg border border-border rounded-lg px-2 py-2 font-mono text-sm text-text focus:outline-none focus:border-primary/60">
          {SUPPORTED_CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={create.isPending || !title.trim()} className="gradient-primary-cta px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40">
          {create.isPending ? 'Adding…' : 'Add'}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg font-body text-sm text-muted hover:text-text">Cancel</button>
      </div>
    </div>
  )
}

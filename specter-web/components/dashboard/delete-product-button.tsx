'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, AlertTriangle } from 'lucide-react'
import { useDeleteSKU } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

/**
 * Destructive product deletion with a typed-confirmation gate.
 *
 * Deleting a product cascades on the server (every competitor tracking, signal,
 * OOS alert and price-history row for it is removed, and the competitor URLs it
 * tracked are rescheduled). That is irreversible, so — unlike the soft competitor
 * remove — we require the operator to type the product's exact title before the
 * Delete button enables. Accidental clicks can't destroy a catalog.
 */
export default function DeleteProductButton({
  productId,
  title,
  competitorCount,
}: {
  productId: string
  title: string
  competitorCount: number
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const remove = useDeleteSKU()

  // Reset the typed value whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) setConfirm('')
  }, [open])

  // Esc closes; lock background scroll while the modal is up.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const matches = confirm.trim() === title.trim()

  function handleDelete() {
    if (!matches || remove.isPending) return
    remove.mutate(productId, {
      onSuccess: () => {
        setOpen(false)
        toast.success(`Deleted “${title}”`)
      },
      onError: () => toast.error('Delete failed — try again.'),
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-body text-xs text-rose-400 hover:text-rose-300 transition-colors"
      >
        <Trash2 size={13} aria-hidden="true" />
        Delete product
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-rose-400/10 p-2 shrink-0">
                  <AlertTriangle size={18} className="text-rose-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 id="delete-product-title" className="font-display text-lg font-bold text-text">
                    Delete this product?
                  </h2>
                  <p className="font-body text-sm text-muted mt-1">
                    This permanently removes <span className="text-text font-medium">{title}</span>
                    {competitorCount > 0 && (
                      <> and its {competitorCount} competitor {competitorCount === 1 ? 'link' : 'links'}</>
                    )}
                    , along with every signal, alert and price-history record. This can&rsquo;t be undone.
                  </p>
                </div>
              </div>

              <label className="font-body text-xs text-muted flex flex-col gap-1.5">
                Type <span className="font-mono text-text">{title}</span> to confirm
                <input
                  autoFocus
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                  className="bg-bg border border-border rounded-lg px-3 py-2 font-mono text-sm text-text outline-none focus:border-rose-400/60"
                  placeholder={title}
                  aria-label="Confirm product title"
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 font-body text-sm text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!matches || remove.isPending}
                  className={cn(
                    'px-4 py-2 font-body text-sm font-medium rounded-lg transition-colors',
                    matches && !remove.isPending
                      ? 'bg-rose-500 text-white hover:bg-rose-600'
                      : 'bg-border/40 text-muted cursor-not-allowed',
                  )}
                >
                  {remove.isPending ? 'Deleting…' : 'Delete product'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

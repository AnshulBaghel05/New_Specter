'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical } from 'lucide-react'
import { useSilenceOOS, useDeleteCompetitor } from '@/lib/api'
import { toast } from '@/lib/toast'

export default function CompetitorRowMenu({ trackingId, silenced }: { trackingId: string; silenced: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const silence = useSilenceOOS()
  const remove = useDeleteCompetitor()

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(o => !o)} aria-label="Competitor actions" className="p-1 rounded text-muted hover:text-text hover:bg-border/40">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 w-48 bg-surface border border-border rounded-lg shadow-xl py-1">
          <button
            disabled={silence.isPending}
            onClick={() =>
              silence.mutate(
                { trackingId, silenced: !silenced },
                {
                  onSuccess: () => {
                    setOpen(false)
                    toast.success(`OOS alerts ${!silenced ? 'silenced' : 'unsilenced'}`)
                  },
                },
              )
            }
            className="w-full text-left px-3 py-1.5 font-body text-xs text-text hover:bg-border/40 disabled:opacity-50"
          >
            {silenced ? 'Unsilence OOS alerts' : 'Silence OOS alerts'}
          </button>
          <button
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(trackingId, {
                onSuccess: () => {
                  setOpen(false)
                  toast.success('Competitor removed')
                },
              })
            }
            className="w-full text-left px-3 py-1.5 font-body text-xs text-rose-400 hover:bg-rose-400/10 disabled:opacity-50"
          >
            Remove competitor
          </button>
          {(silence.isError || remove.isError) && (
            <p className="px-3 py-1.5 font-body text-[11px] text-rose-400">Action failed — try again.</p>
          )}
        </div>
      )}
    </div>
  )
}

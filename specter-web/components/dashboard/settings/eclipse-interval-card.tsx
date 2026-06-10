'use client'

import { useState } from 'react'
import { Gauge } from 'lucide-react'
import { useUpdateMerchant } from '@/lib/api'
import { toast } from '@/lib/toast'
import SettingsCard from './settings-card'

export default function EclipseIntervalCard({ intervalMs }: { intervalMs: number }) {
  const update = useUpdateMerchant()
  const [minutes, setMinutes] = useState(Math.round(intervalMs / 60_000))

  const clamped = Math.min(15, Math.max(5, Number.isFinite(minutes) ? minutes : 5))
  const dirty = clamped * 60_000 !== intervalMs

  function save() {
    update.mutate(
      { eclipse_interval_ms: clamped * 60_000 },
      { onSuccess: () => toast.success('Refresh interval saved') },
    )
  }

  return (
    <SettingsCard title="Refresh interval">
      <div className="flex items-center gap-3">
        <Gauge size={18} className="text-muted shrink-0" aria-hidden="true" />
        <p className="font-body text-sm text-muted">How often ECLIPSE scrapes your competitors (5–15 minutes).</p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={5}
          max={15}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-20 bg-bg border border-border rounded-xl px-3 py-2 font-mono text-sm text-text focus:outline-none focus:border-primary/60"
        />
        <span className="font-body text-sm text-muted">minutes</span>
        <button
          onClick={save}
          disabled={!dirty || update.isPending}
          className="gradient-primary-cta btn-ripple px-5 py-2 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {update.isError && <p className="font-body text-xs text-rose-400">{"Couldn't save. Try again."}</p>}
    </SettingsCard>
  )
}

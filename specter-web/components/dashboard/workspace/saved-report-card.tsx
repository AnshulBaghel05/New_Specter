'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Trash2, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { heroMetricFor, normalizeToolKey, toolHrefFor, toolLabelFor, type SavedCalc } from '@/lib/tools/workspace'
import type { Calculation } from '@/lib/calculations-api'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SavedReportCard({
  calc,
  selected,
  onToggleSelect,
  onRename,
  onDelete,
}: {
  calc: Calculation
  selected: boolean
  onToggleSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(calc.name)

  const key = normalizeToolKey(calc.tool_name)
  const hero = heroMetricFor(calc as unknown as SavedCalc)
  const href = key ? toolHrefFor(key) : '#'
  const toolLabel = key ? toolLabelFor(key) : calc.tool_name

  function commitRename() {
    const next = draft.trim()
    if (next && next !== calc.name) onRename(calc.id, next)
    setEditing(false)
  }

  return (
    <div
      className={cn(
        'bg-surface border rounded-2xl p-5 flex flex-col gap-3 transition-colors',
        selected ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditing(false)
              }}
              autoFocus
              className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-2 py-1 font-body text-sm text-text focus:outline-none focus:border-primary/50"
            />
            <button onClick={commitRename} aria-label="Save name" className="text-primary hover:text-primary/80">
              <Check size={15} />
            </button>
            <button onClick={() => setEditing(false)} aria-label="Cancel rename" className="text-muted hover:text-text">
              <X size={15} />
            </button>
          </div>
        ) : (
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-text truncate">{calc.name}</h3>
            <p className="font-body text-xs text-muted mt-0.5">
              {toolLabel}
              {calc.created_at && ` · ${formatDate(calc.created_at)}`}
            </p>
          </div>
        )}

        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(calc.id)}
            className="accent-primary"
          />
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted">Compare</span>
        </label>
      </div>

      {hero && (
        <div>
          <p className="font-body text-xs text-muted uppercase tracking-wide">{hero.label}</p>
          <p className="font-mono text-2xl font-bold text-primary">{hero.value}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 mt-auto border-t border-border/60">
        <Link
          href={href}
          className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-primary transition-colors pt-3"
        >
          <ExternalLink size={13} aria-hidden="true" />
          Open in tool
        </Link>
        {!editing && (
          <button
            onClick={() => {
              setDraft(calc.name)
              setEditing(true)
            }}
            className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-text transition-colors pt-3"
          >
            <Pencil size={13} aria-hidden="true" />
            Rename
          </button>
        )}
        <button
          onClick={() => onDelete(calc.id)}
          className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-rose-400 transition-colors pt-3 ml-auto"
        >
          <Trash2 size={13} aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>
  )
}

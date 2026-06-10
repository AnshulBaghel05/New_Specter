'use client'

import { useState } from 'react'
import { BookmarkPlus, ChevronDown, ChevronUp, Trash2, Play, GitCompare, X } from 'lucide-react'
import { useScenarios } from '@/hooks/use-scenarios'
import { fromUSD, fmt as fmtFn } from '@/lib/tools/currency'
import { cn } from '@/lib/utils'
import type { Scenario } from '@/lib/tools/scenarios'

interface ScenarioPanelProps {
  toolId: string
  currentInputs: Record<string, string | boolean>
  currentResults: Record<string, number>
  currency: string
  resultLabels: Record<string, string>
  onLoad: (scenario: Scenario) => void
}

export default function ScenarioPanel({
  toolId,
  currentInputs,
  currentResults,
  currency,
  resultLabels,
  onLoad,
}: ScenarioPanelProps) {
  const { scenarios, saveScenario, deleteScenario, compareIds, setCompareIds } =
    useScenarios(toolId)
  const [expanded, setExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  function handleSave() {
    const name = nameInput.trim() || `Scenario ${scenarios.length + 1}`
    saveScenario(name, currentInputs, currentResults, currency)
    setIsSaving(false)
    setNameInput('')
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < 2
          ? [...prev, id]
          : prev,
    )
  }

  function startCompare() {
    if (selectedIds.length === 2) {
      setCompareIds([selectedIds[0], selectedIds[1]])
      setExpanded(true)
    }
  }

  function exitCompare() {
    setCompareIds(null)
    setSelectedIds([])
  }

  const scenA = compareIds ? scenarios.find((s) => s.id === compareIds[0]) : null
  const scenB = compareIds ? scenarios.find((s) => s.id === compareIds[1]) : null

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs font-mono text-muted hover:text-text transition-colors"
        aria-label="Open scenarios panel"
      >
        <BookmarkPlus size={12} aria-hidden="true" />
        Scenarios{scenarios.length > 0 ? ` (${scenarios.length})` : ''}
        <ChevronDown size={11} aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mt-2 w-full max-w-md mx-auto text-left">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-text font-semibold">Saved Scenarios</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-muted hover:text-text transition-colors"
          aria-label="Close scenarios panel"
        >
          <ChevronUp size={14} aria-hidden="true" />
        </button>
      </div>

      {scenarios.length === 0 ? (
        <p className="font-body text-xs text-muted mb-3">No scenarios saved yet.</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border transition-colors',
                selectedIds.includes(s.id)
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border',
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(s.id)}
                onChange={() => toggleSelect(s.id)}
                className="accent-primary shrink-0"
                aria-label={`Select ${s.name} for comparison`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-text font-medium truncate">{s.name}</p>
                <p className="font-mono text-xs text-muted">
                  {s.currency} · {new Date(s.savedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => { onLoad(s); setExpanded(false) }}
                className="text-muted hover:text-primary transition-colors p-1"
                title={`Load ${s.name}`}
                aria-label={`Load ${s.name}`}
              >
                <Play size={12} aria-hidden="true" />
              </button>
              <button
                onClick={() => deleteScenario(s.id)}
                className="text-muted hover:text-rose-400 transition-colors p-1"
                title={`Delete ${s.name}`}
                aria-label={`Delete ${s.name}`}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedIds.length === 2 && !compareIds && (
        <button
          onClick={startCompare}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-semibold mb-2 hover:bg-primary/15 transition-colors"
        >
          <GitCompare size={12} aria-hidden="true" />
          Compare selected
        </button>
      )}

      {isSaving ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setIsSaving(false)
            }}
            placeholder={`Scenario ${scenarios.length + 1}`}
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 font-body text-xs text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg bg-primary text-bg font-mono text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setIsSaving(false)}
            className="px-2 py-1.5 text-muted hover:text-text transition-colors"
            aria-label="Cancel"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsSaving(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-border/80 font-mono text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={scenarios.length >= 5}
        >
          <BookmarkPlus size={12} aria-hidden="true" />
          {scenarios.length >= 5 ? 'Max 5 scenarios reached' : 'Save current scenario'}
        </button>
      )}

      {compareIds && scenA && scenB && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-text font-semibold">Comparison</span>
            <button
              onClick={exitCompare}
              className="font-mono text-xs text-muted hover:text-text transition-colors"
            >
              Exit
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left font-mono text-xs text-muted pb-2 pr-2">Metric</th>
                  <th className="text-right font-mono text-xs text-primary pb-2 pr-2 max-w-20 truncate">
                    {scenA.name}
                  </th>
                  <th className="text-right font-mono text-xs text-blue-400 pb-2 pr-2 max-w-20 truncate">
                    {scenB.name}
                  </th>
                  <th className="text-right font-mono text-xs text-muted pb-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(resultLabels).map((key) => {
                  const valA = fromUSD(scenA.results[key] ?? 0, scenA.currency)
                  const valB = fromUSD(scenB.results[key] ?? 0, scenB.currency)
                  const diff = valB - valA
                  return (
                    <tr key={key} className="border-t border-border/50">
                      <td className="py-1.5 font-body text-xs text-muted pr-2">
                        {resultLabels[key]}
                      </td>
                      <td className="py-1.5 font-mono text-xs text-right text-text pr-2">
                        {fmtFn(valA, scenA.currency)}
                      </td>
                      <td className="py-1.5 font-mono text-xs text-right text-text pr-2">
                        {fmtFn(valB, scenB.currency)}
                      </td>
                      <td
                        className={cn(
                          'py-1.5 font-mono text-xs text-right',
                          diff > 0.005
                            ? 'text-emerald-400'
                            : diff < -0.005
                              ? 'text-rose-400'
                              : 'text-muted',
                        )}
                      >
                        {diff > 0.005 ? '+' : ''}
                        {diff.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

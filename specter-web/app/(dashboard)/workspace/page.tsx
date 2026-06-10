'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import EmptyState from '@/components/dashboard/empty-state'
import LockedValueCard from '@/components/dashboard/locked-value-card'
import PqlUpgradeModal from '@/components/dashboard/pql-upgrade-modal'
import OpportunityFeed from '@/components/dashboard/workspace/opportunity-feed'
import SavedReportCard from '@/components/dashboard/workspace/saved-report-card'
import ComparePanel from '@/components/dashboard/workspace/compare-panel'
import ToolGallery from '@/components/dashboard/workspace/tool-gallery'
import {
  useCalculations,
  useDeleteCalculation,
  useUpdateCalculation,
} from '@/lib/calculations-api'
import { useMerchant } from '@/lib/api'
import { useMigrateScenarios } from '@/lib/use-migrate-scenarios'
import {
  trackWorkspaceViewed,
  trackPqlOnce,
  PQL_SAVE_THRESHOLD,
} from '@/lib/analytics'

export default function WorkspacePage() {
  const { data: merchant } = useMerchant()
  const { migrating } = useMigrateScenarios(!!merchant)

  const { data: calcs, isLoading } = useCalculations()
  const del = useDeleteCalculation()
  const update = useUpdateCalculation()

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const reports = useMemo(() => calcs ?? [], [calcs])
  const selected = useMemo(
    () => reports.filter((c) => selectedIds.includes(c.id)),
    [reports, selectedIds],
  )

  // Analytics: fire workspace_viewed once data has loaded, and mark the user a
  // PQL (product-qualified lead) the first time they cross the save threshold.
  const viewedFired = useRef(false)
  useEffect(() => {
    if (!merchant || isLoading || viewedFired.current) return
    viewedFired.current = true
    trackWorkspaceViewed(merchant.plan, reports.length)
    if (reports.length >= PQL_SAVE_THRESHOLD) {
      trackPqlOnce('saves', reports.length)
    }
  }, [merchant, isLoading, reports.length])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleDelete(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
    del.mutate(id)
  }

  function handleRename(id: string, name: string) {
    update.mutate({ id, name })
  }

  const isFree = merchant?.plan === 'free'

  return (
    <div className="space-y-8">
      {/* PQL: one-time contextual upgrade modal once a free user crosses the
          save threshold (result-first — they already have N saved reports). */}
      <PqlUpgradeModal savedCount={reports.length} threshold={PQL_SAVE_THRESHOLD} active={!!isFree && !isLoading} />

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text tracking-tight">Workspace</h1>
        <p className="font-body text-sm text-muted mt-1">
          {isFree
            ? 'Save any tool result, compare scenarios, and let SPECTER show you where the money is.'
            : 'Your saved analyses, side-by-side comparisons, and quantified opportunities.'}
          {migrating && <span className="text-primary"> · importing your saved scenarios…</span>}
        </p>
      </div>

      {/* Opportunity Feed — the differentiator, up top */}
      <OpportunityFeed />

      {/* Compare (only when 2+ selected) */}
      <ComparePanel calcs={selected} onClear={() => setSelectedIds([])} />

      {/* Saved Reports */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-text">Saved reports</h2>
          {reports.length > 0 && (
            <span className="font-mono text-xs text-muted">
              {reports.length} saved
              {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No saved reports yet"
            description="Run any free tool, hit Save, and it lands here — cross-device, ready to compare and act on."
            cta={{ label: 'Browse the tools', href: '/tools' }}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((calc) => (
              <SavedReportCard
                key={calc.id}
                calc={calc}
                selected={selectedIds.includes(calc.id)}
                onToggleSelect={toggleSelect}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* Tool gallery */}
      <ToolGallery />

      {/* Intermediate → Paid bridge: honest value card for live monitoring */}
      {isFree && (
        <LockedValueCard
          surface="workspace_live_monitoring"
          title="Live competitor monitoring"
          requiredPlan="recon"
          problem="Your saved reports are snapshots. The prices they're based on move every day — and you only find out when a sale slips."
          value={[
            'Real competitor prices, refreshed automatically',
            'RAISE / LOWER / HOLD signals the moment a rival moves',
            'Out-of-stock alerts so you can capture the demand',
          ]}
          why="Everything in this Workspace stays free. RECON adds the live data and monitoring that turns a one-time calculation into an always-on edge."
          ctaLabel="Start a 14-day RECON trial"
          ctaHref="/pricing"
          preview={
            <div className="rounded-xl border border-border bg-bg p-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text">competitor-store.com</span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-400">
                  RAISE
                </span>
              </div>
              <p className="text-muted mt-1.5">Example: rival raised to $42.00 — you have room to follow.</p>
            </div>
          }
        />
      )}
    </div>
  )
}

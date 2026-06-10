'use client'

import { Download, Printer } from 'lucide-react'
import { useExport } from '@/hooks/use-export'
import type { ExportRow } from '@/lib/tools/export'

interface ExportBarProps {
  toolId: string
  inputs: ExportRow[]
  results: ExportRow[]
  currency: string
}

export default function ExportBar({ toolId, inputs, results, currency }: ExportBarProps) {
  const { exportCsv, exportPdf } = useExport(toolId, inputs, results, currency)

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={exportCsv}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-muted hover:text-text hover:border-border/80 transition-colors font-mono text-xs"
        title="Download CSV"
        aria-label="Download CSV export"
      >
        <Download size={11} aria-hidden="true" />
        CSV
      </button>
      <button
        onClick={exportPdf}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-muted hover:text-text hover:border-border/80 transition-colors font-mono text-xs"
        title="Print / Save as PDF"
        aria-label="Print PDF report"
      >
        <Printer size={11} aria-hidden="true" />
        PDF
      </button>
    </div>
  )
}

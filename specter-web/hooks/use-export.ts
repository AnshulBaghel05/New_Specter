'use client'

import { useCallback } from 'react'
import { exportCsv as exportCsvFn, exportPdf as exportPdfFn, ExportRow } from '@/lib/tools/export'

export function useExport(
  toolId: string,
  inputs: ExportRow[],
  results: ExportRow[],
  currency: string,
) {
  const exportCsv = useCallback(() => {
    exportCsvFn(toolId, inputs, results, currency)
  }, [toolId, inputs, results, currency])

  const exportPdf = useCallback(() => {
    exportPdfFn()
  }, [])

  return { exportCsv, exportPdf }
}

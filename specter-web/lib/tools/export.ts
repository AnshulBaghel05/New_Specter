export interface ExportRow {
  label: string
  value: string
}

function csvField(v: string | undefined): string {
  if (!v) return ''
  return `"${v.replace(/"/g, '""')}"`
}

export function buildCsvString(
  toolId: string,
  inputs: ExportRow[],
  results: ExportRow[],
  currency: string,
): string {
  const date = new Date().toISOString().split('T')[0]
  const rows: (string | undefined)[][] = [
    ['SPECTER Tool Export', toolId, date, `Currency: ${currency}`],
    [],
    ['--- INPUTS ---'],
    ...inputs.map(({ label, value }) => [label, value]),
    [],
    ['--- RESULTS ---'],
    ...results.map(({ label, value }) => [label, value]),
  ]
  return rows.map((r) => r.map(csvField).join(',')).join('\n')
}

export function exportCsv(
  toolId: string,
  inputs: ExportRow[],
  results: ExportRow[],
  currency: string,
): void {
  const csv = buildCsvString(toolId, inputs, results, currency)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `specter-${toolId}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportPdf(): void {
  window.print()
}

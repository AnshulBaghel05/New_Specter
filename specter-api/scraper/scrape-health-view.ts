/**
 * Scrape-health ops view — the operator dashboard surface for the specter-api
 * `GET /admin/scrape/health` report. Pure + dependency-free so it unit-tests
 * without a server: `fetchScrapeHealth` pulls the JSON (admin-keyed), and
 * `renderScrapeHealthHtml` turns it into a standalone HTML page. The Bull Board
 * Express app mounts these behind the same Basic-Auth guard (bull-board.ts).
 */

export interface ScrapeHealthEnv {
  SPECTER_API_URL?: string
  ADMIN_API_KEY?: string
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

/** Fetch the scrape-health report from specter-api with the operator admin key. */
export async function fetchScrapeHealth(
  env: ScrapeHealthEnv,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<unknown> {
  const base = (env.SPECTER_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
  const resp = await fetchImpl(`${base}/admin/scrape/health`, {
    headers: { 'X-Admin-Key': env.ADMIN_API_KEY ?? '' },
  })
  if (!resp.ok) {
    throw new Error(`scrape-health fetch failed: ${resp.status}`)
  }
  return resp.json()
}

// ── Rendering ──────────────────────────────────────────────────────────────────

interface Rates {
  total?: number
  parser_success_rate?: number | null
  crawl_success_rate?: number | null
  blocked_rate?: number | null
  failed_rate?: number | null
  excluded_rate?: number | null
  domain?: string
}
interface WindowSummary extends Rates {
  domains?: Rates[]
}
interface HealthReport {
  generated_at?: string
  windows?: Record<string, WindowSummary>
}

const WINDOW_ORDER = ['24h', '7d', '30d'] as const

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Format a 0..1 rate as a percentage; null/undefined → "—" (no data). */
export function pct(r: number | null | undefined): string {
  return r === null || r === undefined ? '—' : `${(r * 100).toFixed(1)}%`
}

function metricCards(w: WindowSummary): string {
  const cards: Array<[string, string]> = [
    ['Parser success', pct(w.parser_success_rate)],
    ['Crawl success', pct(w.crawl_success_rate)],
    ['Blocked', pct(w.blocked_rate)],
    ['Failed', pct(w.failed_rate)],
    ['Excluded', pct(w.excluded_rate)],
    ['Total fetches', String(w.total ?? 0)],
  ]
  return cards
    .map(([label, value]) => `<div class="card"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`)
    .join('')
}

function domainRows(domains: Rates[]): string {
  if (domains.length === 0) {
    return '<tr><td colspan="6" class="empty">No fetches in this window.</td></tr>'
  }
  return domains
    .map(d => `<tr>
      <td class="dom">${esc(d.domain)}</td>
      <td>${esc(d.total ?? 0)}</td>
      <td>${esc(pct(d.parser_success_rate))}</td>
      <td>${esc(pct(d.crawl_success_rate))}</td>
      <td class="warn">${esc(pct(d.blocked_rate))}</td>
      <td class="warn">${esc(pct(d.failed_rate))}</td>
    </tr>`)
    .join('')
}

function windowSection(label: string, w: WindowSummary): string {
  return `<section>
    <h2>Last ${esc(label)}</h2>
    <div class="cards">${metricCards(w)}</div>
    <table>
      <thead><tr>
        <th>Domain</th><th>Fetches</th><th>Parser&nbsp;OK</th>
        <th>Crawl&nbsp;OK</th><th>Blocked</th><th>Failed</th>
      </tr></thead>
      <tbody>${domainRows(w.domains ?? [])}</tbody>
    </table>
  </section>`
}

/** Render the full scrape-health report as a standalone HTML page. */
export function renderScrapeHealthHtml(report: HealthReport): string {
  const windows = report.windows ?? {}
  // Render in the canonical 24h/7d/30d order, then any extra windows the API adds.
  const labels = [
    ...WINDOW_ORDER.filter(l => l in windows),
    ...Object.keys(windows).filter(l => !WINDOW_ORDER.includes(l as typeof WINDOW_ORDER[number])),
  ]
  const sections = labels.map(l => windowSection(l, windows[l])).join('\n')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>SPECTER — Scrape Health</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{--bg:#06070d;--surface:#0d0f1a;--border:#1a1d2e;--primary:#00e87a;--text:#e8eaf0;--muted:#6b7280}
  body{background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;margin:0;padding:24px}
  h1{font-size:20px;margin:0 0 4px} .gen{color:var(--muted);font-size:12px;margin-bottom:24px}
  section{margin-bottom:32px} h2{font-size:15px;border-bottom:1px solid var(--border);padding-bottom:6px}
  .cards{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px;min-width:120px}
  .card .v{font-size:20px;font-weight:600;color:var(--primary)} .card .l{color:var(--muted);font-size:12px}
  table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden}
  th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)} th{color:var(--muted);font-weight:500;font-size:12px}
  td.dom{font-family:ui-monospace,monospace} td.warn{color:#f59e0b} .empty{color:var(--muted);text-align:center}
</style></head>
<body>
  <h1>Scrape Health</h1>
  <div class="gen">Generated ${esc(report.generated_at ?? 'unknown')} · per-domain rows sorted worst-first (blocked + failed)</div>
  ${sections}
</body></html>`
}

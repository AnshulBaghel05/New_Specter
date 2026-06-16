import { describe, it, expect, vi } from 'vitest'
import { fetchScrapeHealth, renderScrapeHealthHtml, pct } from '../scrape-health-view'

// ── pct() formatting ──────────────────────────────────────────────────────────

describe('pct', () => {
  it('formats a 0..1 rate as a percentage', () => {
    expect(pct(0.9)).toBe('90.0%')
    expect(pct(0)).toBe('0.0%')
    expect(pct(0.1234)).toBe('12.3%')
  })
  it('renders null/undefined (no data) as a dash, not 0%', () => {
    expect(pct(null)).toBe('—')
    expect(pct(undefined)).toBe('—')
  })
})

// ── fetchScrapeHealth ──────────────────────────────────────────────────────────

describe('fetchScrapeHealth', () => {
  it('GETs the admin endpoint with the X-Admin-Key header and returns JSON', async () => {
    const payload = { windows: {} }
    const fake = vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }))
    const out = await fetchScrapeHealth(
      { SPECTER_API_URL: 'https://api.example.com/', ADMIN_API_KEY: 'k3y' },
      fake as never,
    )
    expect(out).toBe(payload)
    // Trailing slash trimmed; header present.
    expect(fake).toHaveBeenCalledWith('https://api.example.com/admin/scrape/health', {
      headers: { 'X-Admin-Key': 'k3y' },
    })
  })

  it('throws on a non-ok response (so the page shows an error, not stale data)', async () => {
    const fake = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    await expect(
      fetchScrapeHealth({ ADMIN_API_KEY: 'bad' }, fake as never),
    ).rejects.toThrow('scrape-health fetch failed: 401')
  })
})

// ── renderScrapeHealthHtml ─────────────────────────────────────────────────────

describe('renderScrapeHealthHtml', () => {
  const report = {
    generated_at: '2026-06-15T12:00:00+00:00',
    windows: {
      '24h': {
        total: 100, parser_success_rate: 0.95, crawl_success_rate: 0.9,
        blocked_rate: 0.05, failed_rate: 0.05, excluded_rate: 0,
        domains: [
          { domain: 'bad.com', total: 10, parser_success_rate: 0.2,
            crawl_success_rate: 0.2, blocked_rate: 0.8, failed_rate: 0 },
          { domain: 'good.com', total: 90, parser_success_rate: 1,
            crawl_success_rate: 1, blocked_rate: 0, failed_rate: 0 },
        ],
      },
      '7d': { total: 0, parser_success_rate: null, crawl_success_rate: null,
              blocked_rate: null, failed_rate: null, excluded_rate: null, domains: [] },
      '30d': { total: 0, parser_success_rate: null, domains: [] },
    },
  }

  it('renders every window label and the headline rates', () => {
    const html = renderScrapeHealthHtml(report)
    expect(html).toContain('Last 24h')
    expect(html).toContain('Last 7d')
    expect(html).toContain('Last 30d')
    expect(html).toContain('95.0%')        // parser success 24h
    expect(html).toContain('bad.com')
    expect(html).toContain('good.com')
    expect(html).toContain('2026-06-15T12:00:00+00:00')
  })

  it('shows a dash for empty windows and an empty-state row', () => {
    const html = renderScrapeHealthHtml(report)
    expect(html).toContain('No fetches in this window.')
    expect(html).toContain('—')
  })

  it('escapes HTML in domain names (no injection from scraped data)', () => {
    const html = renderScrapeHealthHtml({
      generated_at: 'now',
      windows: { '24h': { total: 1, domains: [{ domain: '<script>x</script>', total: 1,
        parser_success_rate: 1, crawl_success_rate: 1, blocked_rate: 0, failed_rate: 0 }] } },
    })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('does not crash on a malformed/empty report', () => {
    expect(() => renderScrapeHealthHtml({})).not.toThrow()
    expect(renderScrapeHealthHtml({})).toContain('Scrape Health')
  })
})

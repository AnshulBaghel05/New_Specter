import { NextRequest, NextResponse } from 'next/server'

// Deterministic hash — same product always returns the same count & domains
function hashStr(s: string): number {
  let h = 0
  for (const ch of s) {
    h = Math.imul(31, h) + ch.charCodeAt(0) | 0
  }
  return Math.abs(h)
}

const DOMAIN_SUFFIXES = [
  'store.com', 'shop.co', 'direct.com', 'deals.com', 'outlet.com',
  'hub.com', 'world.com', 'pro.co', 'market.com', 'warehouse.com',
  'depot.com', 'central.com', 'source.com', 'club.com', 'zone.com',
  'zone.co', 'express.com', 'supply.com', 'prime.co', 'value.com',
]

function extractKeyword(product: string): string {
  return (
    product
      .toLowerCase()
      .replace(/https?:\/\/[^\s/]+\/?/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 2)
      .join('')
    || 'product'
  )
}

function generateDomains(keyword: string, count: number, seed: number): string[] {
  const shuffled = [...DOMAIN_SUFFIXES].sort(
    (a, b) => hashStr(a + seed) - hashStr(b + seed),
  )
  return shuffled.slice(0, count).map(suffix => `${keyword}-${suffix}`)
}

export async function GET(req: NextRequest) {
  const product = req.nextUrl.searchParams.get('product')?.trim() ?? ''

  if (!product) {
    return NextResponse.json({ error: 'product parameter is required' }, { status: 400 })
  }

  const seed = hashStr(product.toLowerCase())

  // 5–18 competitors, consistent per product
  const count = 5 + (seed % 14)

  const keyword = extractKeyword(product)
  const sample_domains = generateDomains(keyword, Math.min(count, 8), seed)

  // Simulate realistic response time (exposed for UI to show it)
  const response_time_ms = 800 + (seed % 1400)

  return NextResponse.json(
    {
      count,
      sample_domains,
      response_time_ms,
      scanned_at: new Date().toISOString(),
      product,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  )
}

import { describe, it, expect } from 'vitest'
import { attributionInsight, formatInsight } from './attribution-insight'
import type { AttributionChart } from '@/lib/api'
import type { SkuBreakdown } from './attribution-breakdown'

function chart(p: Partial<AttributionChart> = {}): AttributionChart {
  return {
    series: [
      { date: '2026-05-26', revenue_delta: 100 },
      { date: '2026-05-27', revenue_delta: -40 },
      { date: '2026-05-28', revenue_delta: 412 },
    ],
    total_recovered: 512,
    total_lost: -40,
    net: 472,
    ...p,
  }
}

function row(p: Partial<SkuBreakdown> = {}): SkuBreakdown {
  return { sku_id: 's', sku_title: 'A', recovered: 0, lost: 0, net: 0, count: 0, ...p }
}

describe('attributionInsight', () => {
  it('computes bestDay, positiveDays, totalDays, topProduct', () => {
    const out = attributionInsight(chart(), [row({ sku_title: 'Aurora', net: 300 }), row({ sku_title: 'Drift', net: -10 })], 30)
    expect(out).toMatchObject({
      net: 472,
      days: 30,
      bestDay: { date: '2026-05-28', value: 412 },
      positiveDays: 2,
      totalDays: 3,
      topProduct: { sku_title: 'Aurora', net: 300 },
    })
  })

  it('bestDay null when no positive day; topProduct null when none > 0', () => {
    const out = attributionInsight(
      chart({ series: [{ date: '2026-05-26', revenue_delta: -5 }], net: -5, total_recovered: 0, total_lost: -5 }),
      [row({ sku_title: 'Drift', net: -10 })],
      7,
    )
    expect(out.bestDay).toBeNull()
    expect(out.topProduct).toBeNull()
    expect(out.positiveDays).toBe(0)
  })
})

describe('formatInsight', () => {
  it('full headline with all clauses', () => {
    const insight = attributionInsight(chart(), [row({ sku_title: 'Aurora', net: 300 })], 30)
    expect(formatInsight(insight)).toBe(
      'Net +$472 over 30d · best +$412 on May 28 · 2/3 days positive · top: Aurora',
    )
  })

  it('omits bestDay and topProduct clauses when null; thousands separator on net', () => {
    const insight = attributionInsight(
      chart({ series: [{ date: '2026-05-26', revenue_delta: -5 }], net: -3240, total_recovered: 0, total_lost: -3240 }),
      [],
      7,
    )
    expect(formatInsight(insight)).toBe('Net −$3,240 over 7d · 0/1 days positive')
  })
})

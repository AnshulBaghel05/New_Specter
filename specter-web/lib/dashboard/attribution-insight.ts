// Plain-English headline above the chart. Pure derivation + formatting.

import type { AttributionChart } from '@/lib/api'
import type { SkuBreakdown } from '@/lib/dashboard/attribution-breakdown'
import { formatDayLabel } from '@/lib/dashboard/attribution-day'

export interface AttributionInsight {
  net: number
  days: number
  bestDay: { date: string; value: number } | null
  positiveDays: number
  totalDays: number
  topProduct: { sku_title: string; net: number } | null
}

export function attributionInsight(
  chart: AttributionChart,
  breakdown: SkuBreakdown[],
  days: number,
): AttributionInsight {
  let bestDay: { date: string; value: number } | null = null
  let positiveDays = 0
  for (const p of chart.series) {
    if (p.revenue_delta > 0) {
      positiveDays += 1
      if (bestDay === null || p.revenue_delta > bestDay.value) {
        bestDay = { date: p.date, value: p.revenue_delta }
      }
    }
  }

  let topProduct: { sku_title: string; net: number } | null = null
  for (const r of breakdown) {
    if (r.net > 0 && (topProduct === null || r.net > topProduct.net)) {
      topProduct = { sku_title: r.sku_title, net: r.net }
    }
  }

  return {
    net: chart.net,
    days,
    bestDay,
    positiveDays,
    totalDays: chart.series.length,
    topProduct,
  }
}

// "+$3,240" / "−$100" — whole dollars, thousands-grouped, unicode minus.
function money(n: number): string {
  const sign = n < 0 ? '−' : '+'
  const whole = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}$${whole}`
}

export function formatInsight(insight: AttributionInsight): string {
  const parts = [`Net ${money(insight.net)} over ${insight.days}d`]
  if (insight.bestDay) {
    parts.push(`best ${money(insight.bestDay.value)} on ${formatDayLabel(insight.bestDay.date)}`)
  }
  parts.push(`${insight.positiveDays}/${insight.totalDays} days positive`)
  if (insight.topProduct) {
    parts.push(`top: ${insight.topProduct.sku_title}`)
  }
  return parts.join(' · ')
}

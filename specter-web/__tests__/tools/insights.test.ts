import { describe, it, expect } from 'vitest'
import { calcShipping } from '@/lib/tools/shipping'
import {
  shippingInsights, roasInsights, shopifyProfitInsights, fbaInsights, inventoryInsights,
  nextToolFor,
} from '@/lib/tools/insights'
import type { ShippingResult, CarrierRate } from '@/lib/tools/shipping'
import { calcRoas } from '@/lib/tools/roas'
import { calcShopifyProfit } from '@/lib/tools/shopify-profit'
import { calcFbaFees } from '@/lib/tools/fba'
import { calcInventory } from '@/lib/tools/inventory'

// ── next-tool routing ─────────────────────────────────────────────────────────

describe('nextToolFor', () => {
  it('routes shipping → shopify-profit (margin impact)', () => {
    const rec = nextToolFor('shipping')
    expect(rec?.href).toBe('/tools/shopify-profit-calculator')
    expect(rec?.reason.length).toBeGreaterThan(0)
  })

  it('returns a known tool for every public tool id', () => {
    for (const id of ['shipping', 'shopify-profit', 'fba', 'roas', 'inventory']) {
      const rec = nextToolFor(id)
      expect(rec, `no next tool for ${id}`).not.toBeNull()
      expect(rec!.href.startsWith('/tools/')).toBe(true)
    }
  })

  it('returns null for an unknown tool id', () => {
    expect(nextToolFor('does-not-exist')).toBeNull()
  })
})

// ── shipping insight rules ──────────────────────────────────────────────────

function makeRate(over: Partial<CarrierRate> & Pick<CarrierRate, 'carrier' | 'service' | 'rate'>): CarrierRate {
  return { est_days: '2–3 days', ...over }
}

function makeResult(over: Partial<ShippingResult> = {}): ShippingResult {
  const rates: CarrierRate[] = over.rates ?? [
    makeRate({ carrier: 'USPS', service: 'Ground Advantage', rate: 8.10 }),
    makeRate({ carrier: 'UPS', service: 'UPS Ground', rate: 11.30 }),
    makeRate({ carrier: 'FedEx', service: 'FedEx Ground', rate: 12.00 }),
  ]
  const cheapest = rates[0]
  return {
    actual_weight_lb: 2,
    ups_dim_weight_lb: 2,
    usps_dim_weight_lb: 0,
    billable_weight_ups_lb: 2,
    billable_weight_usps_lb: 2,
    rates,
    cheapest,
    recommended: cheapest,
    ...over,
  }
}

describe('shippingInsights', () => {
  it('names the cheapest carrier as a good finding', () => {
    const ins = shippingInsights(makeResult())
    const good = ins.findings.find(f => f.tone === 'good')
    expect(good).toBeDefined()
    expect(good!.text).toContain('USPS')
  })

  it('quantifies the savings vs the next-cheapest carrier', () => {
    const ins = shippingInsights(makeResult())
    const opp = ins.findings.find(f => f.tone === 'opportunity')
    expect(opp).toBeDefined()
    // 11.30 - 8.10 = 3.20 per order
    expect(opp!.value).toBeCloseTo(3.20, 2)
    expect(opp!.unit).toBe('per_order')
    expect(opp!.text).toContain('3.20')
  })

  it('warns when dimensional weight exceeds actual weight', () => {
    const ins = shippingInsights(makeResult({
      actual_weight_lb: 2,
      billable_weight_ups_lb: 6,   // DIM penalty
    }))
    const warn = ins.findings.find(f => f.tone === 'warn')
    expect(warn).toBeDefined()
    expect(warn!.text.toLowerCase()).toContain('dimensional')
  })

  it('does NOT warn about dim weight when billable ≈ actual', () => {
    const ins = shippingInsights(makeResult({
      actual_weight_lb: 2,
      billable_weight_ups_lb: 2,
    }))
    expect(ins.findings.find(f => f.tone === 'warn')).toBeUndefined()
  })

  it('recommends the next tool (shopify-profit)', () => {
    const ins = shippingInsights(makeResult())
    expect(ins.nextTool?.href).toBe('/tools/shopify-profit-calculator')
  })

  it('handles a single-rate result without crashing (no savings finding)', () => {
    const only = makeRate({ carrier: 'USPS', service: 'Ground Advantage', rate: 8.10 })
    const ins = shippingInsights(makeResult({ rates: [only], cheapest: only, recommended: only }))
    expect(ins.findings.find(f => f.tone === 'opportunity')).toBeUndefined()
    expect(ins.findings.find(f => f.tone === 'good')).toBeDefined()
  })
})

// ── ROAS insights ────────────────────────────────────────────────────────────

describe('roasInsights', () => {
  it('flags a profitable campaign as good with headroom opportunity', () => {
    // 50% margin, strong ROAS → profitable
    const r = calcRoas({ ad_spend: 1000, revenue: 10000, cogs: 4000, fulfillment_and_shipping: 1000 })
    const ins = roasInsights(r)
    expect(r.is_profitable).toBe(true)
    expect(ins.findings.find(f => f.tone === 'good')).toBeDefined()
    expect(ins.findings.find(f => f.tone === 'opportunity')?.text).toContain('break-even ROAS')
    expect(ins.nextTool?.href).toBe('/tools/shopify-profit-calculator')
  })

  it('warns when the campaign is unprofitable and names the break-even ROAS', () => {
    // thin margin, heavy spend → unprofitable
    const r = calcRoas({ ad_spend: 5000, revenue: 6000, cogs: 5000, fulfillment_and_shipping: 500 })
    const ins = roasInsights(r)
    expect(r.is_profitable).toBe(false)
    expect(ins.findings.find(f => f.tone === 'warn')).toBeDefined()
    expect(ins.findings.find(f => f.tone === 'opportunity')?.text).toContain('break even')
  })
})

// ── Shopify profit insights ──────────────────────────────────────────────────

describe('shopifyProfitInsights', () => {
  const base = {
    plan: 'basic' as const, monthly_revenue: 20000, cogs: 8000, monthly_orders: 400,
    app_spend: 200, avg_return_rate_pct: 5, return_restocking_pct: 20,
    monthly_shipping_cost: 1500, monthly_ad_spend: 3000, uses_shopify_payments: true,
  }

  it('reports the true margin and quantifies platform fees', () => {
    const r = calcShopifyProfit(base)
    const ins = shopifyProfitInsights(r)
    expect(ins.findings[0].text).toContain('true margin')
    const opp = ins.findings.find(f => f.tone === 'opportunity')
    expect(opp?.text).toContain('payment processing')
    expect(opp?.unit).toBe('per_month')
    expect(ins.nextTool?.href).toBe('/tools/roas-calculator')
  })

  it('flags a thin margin as a warning', () => {
    const r = calcShopifyProfit({ ...base, cogs: 17000 })  // almost no gross profit
    const ins = shopifyProfitInsights(r)
    expect(ins.findings[0].tone).toBe('warn')
  })
})

// ── FBA insights ──────────────────────────────────────────────────────────────

describe('fbaInsights', () => {
  const base = {
    selling_price: 29.99, product_cost: 8, weight_oz: 12,
    length_in: 9, width_in: 6, height_in: 3, category: 'most_products' as const,
    avg_monthly_units_stored: 100, is_peak_season: false,
  }

  it('reports per-unit profit and quantifies Amazon fees', () => {
    const r = calcFbaFees(base)
    const ins = fbaInsights(r)
    expect(ins.findings[0].text).toContain('per unit')
    expect(ins.findings.find(f => f.tone === 'opportunity')?.text).toContain('Amazon fees')
    expect(ins.nextTool?.href).toBe('/tools/shipping-calculator')
  })

  it('warns when below break-even', () => {
    const r = calcFbaFees({ ...base, selling_price: 9 })  // priced below cost+fees
    const ins = fbaInsights(r)
    expect(r.net_profit).toBeLessThanOrEqual(0)
    expect(ins.findings.some(f => f.tone === 'warn' && f.text.includes('break-even'))).toBe(true)
  })
})

// ── Inventory insights ─────────────────────────────────────────────────────────

describe('inventoryInsights', () => {
  it('reports the reorder point + EOQ and quantifies working capital', () => {
    const r = calcInventory({
      avg_daily_demand: 50, demand_std_dev: 10, lead_time_days: 7,
      order_cost: 75, unit_cost: 12, holding_cost_pct: 25, service_level: '95',
      selling_price: 30,
    })
    const ins = inventoryInsights(r)
    expect(ins.findings[0].text).toContain('Reorder when stock hits')
    expect(ins.findings.find(f => f.tone === 'opportunity')?.text).toContain('average inventory')
    expect(ins.findings.find(f => f.tone === 'warn')?.text).toContain('stockout risk')
    expect(ins.nextTool?.href).toBe('/tools/shopify-profit-calculator')
  })
})

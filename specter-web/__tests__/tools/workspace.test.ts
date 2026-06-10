import { describe, it, expect } from 'vitest'
import { calcRoas } from '@/lib/tools/roas'
import { calcFbaFees } from '@/lib/tools/fba'
import { calcInventory } from '@/lib/tools/inventory'
import { calcShopifyProfit } from '@/lib/tools/shopify-profit'
import {
  normalizeToolKey,
  heroMetricFor,
  opportunityFor,
  buildOpportunityFeed,
  type SavedCalc,
} from '@/lib/tools/workspace'

// ── tool-key normalization ────────────────────────────────────────────────────

describe('normalizeToolKey', () => {
  it('maps ScenarioPanel toolId variants to a canonical workspace key', () => {
    expect(normalizeToolKey('roas-basic')).toBe('roas')
    expect(normalizeToolKey('roas')).toBe('roas')
    expect(normalizeToolKey('inventory-eoq')).toBe('inventory')
    expect(normalizeToolKey('shipping-domestic')).toBe('shipping')
    expect(normalizeToolKey('fba')).toBe('fba')
    expect(normalizeToolKey('shopify')).toBe('shopify-profit')
    expect(normalizeToolKey('shopify-profit')).toBe('shopify-profit')
  })

  it('returns null for an unknown tool name', () => {
    expect(normalizeToolKey('price-position')).toBeNull()
    expect(normalizeToolKey('nonsense')).toBeNull()
  })
})

// ── helpers to build realistic saved-result blobs ─────────────────────────────

function roasCalc(over: Partial<SavedCalc> = {}): SavedCalc {
  const r = calcRoas({ ad_spend: 1000, revenue: 10000, cogs: 4000, fulfillment_and_shipping: 1000 })
  return { id: 'c1', name: 'May Ads', tool_name: 'roas', results: r as unknown as Record<string, unknown>, ...over }
}

function fbaCalc(over: Partial<SavedCalc> = {}): SavedCalc {
  const r = calcFbaFees({
    selling_price: 29.99, product_cost: 8, weight_oz: 12,
    length_in: 9, width_in: 6, height_in: 3, category: 'most_products',
    avg_monthly_units_stored: 100, is_peak_season: false,
  })
  return { id: 'c2', name: 'Product A', tool_name: 'fba', results: r as unknown as Record<string, unknown>, ...over }
}

function inventoryCalc(over: Partial<SavedCalc> = {}): SavedCalc {
  const r = calcInventory({
    avg_daily_demand: 50, demand_std_dev: 10, lead_time_days: 7,
    order_cost: 75, unit_cost: 12, holding_cost_pct: 25, service_level: '95',
    selling_price: 30,
  })
  return { id: 'c3', name: 'Widget restock', tool_name: 'inventory-eoq', results: r as unknown as Record<string, unknown>, ...over }
}

function shopifyCalc(over: Partial<SavedCalc> = {}): SavedCalc {
  const r = calcShopifyProfit({
    plan: 'basic', monthly_revenue: 20000, cogs: 8000, monthly_orders: 400,
    app_spend: 200, avg_return_rate_pct: 5, return_restocking_pct: 20,
    monthly_shipping_cost: 1500, monthly_ad_spend: 3000, uses_shopify_payments: true,
  })
  return { id: 'c4', name: 'Store P&L', tool_name: 'shopify', results: r as unknown as Record<string, unknown>, ...over }
}

// ── hero metric (card face) ───────────────────────────────────────────────────

describe('heroMetricFor', () => {
  it('returns a labelled hero metric for each known tool', () => {
    expect(heroMetricFor(roasCalc())?.label).toMatch(/roas/i)
    expect(heroMetricFor(fbaCalc())?.label).toMatch(/profit/i)
    expect(heroMetricFor(inventoryCalc())?.label).toMatch(/reorder/i)
    expect(heroMetricFor(shopifyCalc())?.label).toMatch(/profit/i)
  })

  it('returns a non-empty display value', () => {
    const hero = heroMetricFor(fbaCalc())
    expect(hero).not.toBeNull()
    expect(hero!.value.length).toBeGreaterThan(0)
  })

  it('returns null for an unknown tool', () => {
    expect(heroMetricFor({ id: 'x', name: 'x', tool_name: 'price-position', results: {} })).toBeNull()
  })
})

// ── opportunity derivation ────────────────────────────────────────────────────

describe('opportunityFor', () => {
  it('derives a quantified opportunity item with a tool link', () => {
    const item = opportunityFor(fbaCalc())
    expect(item).not.toBeNull()
    expect(item!.calcName).toBe('Product A')
    expect(item!.toolKey).toBe('fba')
    expect(item!.href.startsWith('/tools/')).toBe(true)
    expect(item!.text.length).toBeGreaterThan(0)
  })

  it('returns null for an unknown tool', () => {
    expect(opportunityFor({ id: 'x', name: 'x', tool_name: 'price-position', results: {} })).toBeNull()
  })

  it('does not throw on a malformed result blob (returns null)', () => {
    expect(opportunityFor({ id: 'x', name: 'x', tool_name: 'fba', results: {} })).toBeNull()
  })
})

describe('buildOpportunityFeed', () => {
  it('skips unknown tools and ranks quantified opportunities first', () => {
    const feed = buildOpportunityFeed([
      roasCalc(),
      { id: 'bad', name: 'Pricing', tool_name: 'price-position', results: {} },
      shopifyCalc(),
    ])
    // price-position dropped
    expect(feed.every(f => f.toolKey !== undefined)).toBe(true)
    expect(feed.length).toBe(2)
    // items carrying a numeric value sort ahead of value-less ones
    const valued = feed.filter(f => f.value != null)
    const idx = feed.findIndex(f => f.value == null)
    if (idx >= 0) {
      expect(feed.slice(0, valued.length).every(f => f.value != null)).toBe(true)
    }
  })

  it('returns an empty feed for no saved calcs', () => {
    expect(buildOpportunityFeed([])).toEqual([])
  })
})

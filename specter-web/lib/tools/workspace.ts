/**
 * SPECTER Workspace — derive product surfaces from saved tool calculations.
 *
 * Pure + client-side. Two jobs:
 *   1. `heroMetricFor`  — the single headline metric shown on a Saved Report card.
 *   2. `opportunityFor` / `buildOpportunityFeed` — turn each saved result into a
 *      quantified, ranked action item (reusing the deterministic insight engine),
 *      which is what makes the Workspace feel like SPECTER and not a list of files.
 *
 * The saved `results` blob is whatever a tool stored (ideally its full Result).
 * Readers are defensive: a missing/garbled blob yields `null`, never a throw.
 */
import {
  shippingInsights,
  roasInsights,
  shopifyProfitInsights,
  fbaInsights,
  inventoryInsights,
  type ToolInsight,
  type InsightFinding,
} from './insights'
import type { ShippingResult } from './shipping'
import type { RoasResult } from './roas'
import type { ShopifyProfitResult } from './shopify-profit'
import type { FbaResult } from './fba'
import type { InventoryResult } from './inventory'

export type WorkspaceToolKey = 'shipping' | 'shopify-profit' | 'fba' | 'roas' | 'inventory'

/** A saved calculation as the Workspace consumes it (subset of the API shape). */
export interface SavedCalc {
  id: string
  name: string
  tool_name: string
  results: Record<string, unknown>
  currency?: string | null
  created_at?: string
}

export interface OpportunityItem {
  calcId: string
  calcName: string
  toolKey: WorkspaceToolKey
  toolLabel: string
  /** Plain-English action, lifted from the insight engine. */
  text: string
  /** Quantified magnitude used for ranking; null when the finding has none. */
  value: number | null
  unit?: InsightFinding['unit']
  /** Where to go to act on it. */
  href: string
}

// ── Tool registry ─────────────────────────────────────────────────────────────

const TOOL_LABEL: Record<WorkspaceToolKey, string> = {
  shipping: 'Shipping Calculator',
  'shopify-profit': 'Shopify Profit Calculator',
  fba: 'Amazon FBA Calculator',
  roas: 'ROAS Calculator',
  inventory: 'Inventory EOQ Calculator',
}

const TOOL_HREF: Record<WorkspaceToolKey, string> = {
  shipping: '/tools/shipping-calculator',
  'shopify-profit': '/tools/shopify-profit-calculator',
  fba: '/tools/amazon-fba-calculator',
  roas: '/tools/roas-calculator',
  inventory: '/tools/inventory-reorder-calculator',
}

// ScenarioPanel toolIds vary per page ("roas-basic", "inventory-eoq", …); map the
// prefix back to the canonical workspace key the insight engine understands.
const KEY_PREFIX: { prefix: string; key: WorkspaceToolKey }[] = [
  { prefix: 'shopify-profit', key: 'shopify-profit' },
  { prefix: 'shopify',        key: 'shopify-profit' },
  { prefix: 'shipping',       key: 'shipping' },
  { prefix: 'inventory',      key: 'inventory' },
  { prefix: 'roas',           key: 'roas' },
  { prefix: 'fba',            key: 'fba' },
]

export function normalizeToolKey(toolName: string): WorkspaceToolKey | null {
  const t = toolName.toLowerCase()
  for (const { prefix, key } of KEY_PREFIX) {
    if (t === prefix || t.startsWith(`${prefix}-`)) return key
  }
  return null
}

export function toolLabelFor(key: WorkspaceToolKey): string {
  return TOOL_LABEL[key]
}

export function toolHrefFor(key: WorkspaceToolKey): string {
  return TOOL_HREF[key]
}

// ── Insight dispatch (defensive) ──────────────────────────────────────────────

const INSIGHT_BY_TOOL: Record<WorkspaceToolKey, (r: Record<string, unknown>) => ToolInsight> = {
  shipping: (r) => shippingInsights(r as unknown as ShippingResult),
  'shopify-profit': (r) => shopifyProfitInsights(r as unknown as ShopifyProfitResult),
  fba: (r) => fbaInsights(r as unknown as FbaResult),
  roas: (r) => roasInsights(r as unknown as RoasResult),
  inventory: (r) => inventoryInsights(r as unknown as InventoryResult),
}

function safeInsight(key: WorkspaceToolKey, results: Record<string, unknown>): ToolInsight | null {
  try {
    const insight = INSIGHT_BY_TOOL[key](results)
    // A valid insight always produces at least one finding with real text.
    if (!insight.findings.length || insight.findings.some((f) => typeof f.text !== 'string')) {
      return null
    }
    // Guard against NaN/undefined leaking into the headline text.
    if (insight.findings[0].text.includes('NaN') || insight.findings[0].text.includes('undefined')) {
      return null
    }
    return insight
  } catch {
    return null
  }
}

// ── Hero metric (card face) ────────────────────────────────────────────────────

function num(results: Record<string, unknown>, field: string): number | null {
  const v = results[field]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function heroMetricFor(calc: SavedCalc): { label: string; value: string } | null {
  const key = normalizeToolKey(calc.tool_name)
  if (!key) return null
  const r = calc.results

  switch (key) {
    case 'fba': {
      const n = num(r, 'net_profit')
      return n === null ? null : { label: 'Net profit / unit', value: usd(n) }
    }
    case 'roas': {
      const n = num(r, 'roas')
      return n === null ? null : { label: 'ROAS', value: `${n}×` }
    }
    case 'shopify-profit': {
      const n = num(r, 'true_profit')
      return n === null ? null : { label: 'True profit / mo', value: usd(n) }
    }
    case 'inventory': {
      const n = num(r, 'reorder_point')
      return n === null ? null : { label: 'Reorder point', value: `${n.toLocaleString()} units` }
    }
    case 'shipping': {
      const cheapest = r['cheapest']
      if (cheapest && typeof cheapest === 'object' && typeof (cheapest as { rate?: unknown }).rate === 'number') {
        return { label: 'Cheapest rate', value: usd((cheapest as { rate: number }).rate) }
      }
      return null
    }
  }
}

// ── Opportunity feed ────────────────────────────────────────────────────────────

/** Pick the most actionable finding: a quantified opportunity, then any
 *  opportunity, then a warning. Returns null if there is nothing to act on. */
function bestFinding(insight: ToolInsight): InsightFinding | null {
  const opps = insight.findings.filter((f) => f.tone === 'opportunity')
  const quantified = opps.find((f) => typeof f.value === 'number')
  return quantified ?? opps[0] ?? insight.findings.find((f) => f.tone === 'warn') ?? null
}

export function opportunityFor(calc: SavedCalc): OpportunityItem | null {
  const key = normalizeToolKey(calc.tool_name)
  if (!key) return null
  const insight = safeInsight(key, calc.results)
  if (!insight) return null
  const finding = bestFinding(insight)
  if (!finding) return null

  return {
    calcId: calc.id,
    calcName: calc.name,
    toolKey: key,
    toolLabel: TOOL_LABEL[key],
    text: finding.text,
    value: typeof finding.value === 'number' ? finding.value : null,
    unit: finding.unit,
    href: TOOL_HREF[key],
  }
}

/** Normalize a finding's value to a comparable monthly-ish magnitude for ranking.
 *  Value-less items sort last (-Infinity). */
function rankValue(item: OpportunityItem): number {
  if (item.value === null) return -Infinity
  switch (item.unit) {
    case 'per_order':
      return item.value * 30 // ≈ a month of orders
    case 'per_month':
    case 'usd':
    case 'pct':
    default:
      return item.value
  }
}

export function buildOpportunityFeed(calcs: SavedCalc[]): OpportunityItem[] {
  return calcs
    .map(opportunityFor)
    .filter((x): x is OpportunityItem => x !== null)
    .sort((a, b) => rankValue(b) - rankValue(a))
}

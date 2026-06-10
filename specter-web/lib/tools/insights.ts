/**
 * Deterministic AI-insight engine for the public calculators.
 *
 * Turns a tool's computed result into a short, plain-English read: a few
 * findings (good / warn / quantified-opportunity) plus a recommended next
 * tool. Pure + client-side + unit-testable — public tools stay zero-API and
 * SEO-safe. The same outputs feed the Workspace "Opportunity Feed" later,
 * aggregated across a user's saved reports (hence the quantified `value`).
 *
 * Optional richer LLM narratives are layered on for logged-in users elsewhere;
 * this deterministic version is always the floor.
 */
import type { ShippingResult } from './shipping'
import type { RoasResult } from './roas'
import type { ShopifyProfitResult } from './shopify-profit'
import type { FbaResult } from './fba'
import type { InventoryResult } from './inventory'

export type InsightTone = 'good' | 'warn' | 'opportunity'

export interface InsightFinding {
  tone: InsightTone
  /** Plain-English sentence; may embed a formatted figure. */
  text: string
  /** Quantified magnitude (in `unit`) — used to rank the Opportunity Feed. */
  value?: number
  unit?: 'per_order' | 'per_month' | 'pct' | 'usd'
}

export interface NextToolRec {
  toolId: string
  label: string
  href: string
  reason: string
}

export interface ToolInsight {
  findings: InsightFinding[]
  nextTool: NextToolRec | null
}

// ── Cross-tool routing (the "next tool" loop) ─────────────────────────────────
// Keep hrefs in sync with components/tools/related-tools.tsx.

const NEXT_TOOL: Record<string, NextToolRec> = {
  shipping: {
    toolId: 'shopify-profit',
    label: 'Shopify Profit Calculator',
    href: '/tools/shopify-profit-calculator',
    reason: 'See how this shipping cost affects your true margin.',
  },
  'shopify-profit': {
    toolId: 'roas',
    label: 'ROAS Calculator',
    href: '/tools/roas-calculator',
    reason: 'Check whether your ad spend is still profitable at this margin.',
  },
  fba: {
    toolId: 'shipping',
    label: 'Shipping Cost Calculator',
    href: '/tools/shipping-calculator',
    reason: 'Compare carrier rates against your FBA fulfilment cost.',
  },
  roas: {
    toolId: 'shopify-profit',
    label: 'Shopify Profit Calculator',
    href: '/tools/shopify-profit-calculator',
    reason: 'Confirm the margin that has to cover this ad spend.',
  },
  inventory: {
    toolId: 'shopify-profit',
    label: 'Shopify Profit Calculator',
    href: '/tools/shopify-profit-calculator',
    reason: 'Tie your holding cost back to per-order profit.',
  },
}

export function nextToolFor(toolId: string): NextToolRec | null {
  return NEXT_TOOL[toolId] ?? null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Shipping ──────────────────────────────────────────────────────────────────

export function shippingInsights(result: ShippingResult): ToolInsight {
  const findings: InsightFinding[] = []
  const { cheapest, rates, actual_weight_lb, billable_weight_ups_lb } = result

  // 1. The headline read: name the cheapest option.
  findings.push({
    tone: 'good',
    text: `${cheapest.carrier} ${cheapest.service} is your cheapest option at $${cheapest.rate.toFixed(2)} per order.`,
  })

  // 2. Quantified opportunity: savings vs the next-cheapest carrier.
  //    `rates` is sorted ascending by calcShipping; find the next distinct rate.
  const next = rates.find((r) => r.rate > cheapest.rate)
  if (next) {
    const saving = round2(next.rate - cheapest.rate)
    if (saving > 0) {
      findings.push({
        tone: 'opportunity',
        text: `Choosing ${cheapest.carrier} over ${next.carrier} saves $${saving.toFixed(2)} per order.`,
        value: saving,
        unit: 'per_order',
      })
    }
  }

  // 3. Dimensional-weight warning: box is billed heavier than it actually is.
  if (billable_weight_ups_lb > actual_weight_lb + 0.5) {
    findings.push({
      tone: 'warn',
      text: `Carriers bill this box at ${billable_weight_ups_lb} lb (dimensional weight), not its actual ${actual_weight_lb} lb — tighter packaging could lower the rate.`,
    })
  }

  return { findings, nextTool: nextToolFor('shipping') }
}

// ── ROAS ────────────────────────────────────────────────────────────────────

export function roasInsights(r: RoasResult): ToolInsight {
  const findings: InsightFinding[] = []

  if (r.is_profitable) {
    findings.push({
      tone: 'good',
      text: `Profitable: $${r.net_profit.toFixed(2)} net profit at a ${r.troas.toFixed(2)}× true ROAS.`,
      value: r.net_profit,
      unit: 'usd',
    })
  } else {
    findings.push({
      tone: 'warn',
      text: `This campaign isn't profitable yet — net profit is $${r.net_profit.toFixed(2)} after ad spend.`,
    })
  }

  if (r.roas > 0 && r.break_even_roas > 0) {
    if (r.roas < r.break_even_roas) {
      findings.push({
        tone: 'opportunity',
        text: `You need a ${r.break_even_roas.toFixed(2)}× ROAS to break even — you're at ${r.roas.toFixed(2)}×.`,
      })
    } else {
      const headroom = round2(r.roas - r.break_even_roas)
      findings.push({
        tone: 'opportunity',
        text: `You're ${headroom.toFixed(2)}× above your ${r.break_even_roas.toFixed(2)}× break-even ROAS — room to scale spend.`,
        value: headroom,
      })
    }
  }

  return { findings, nextTool: nextToolFor('roas') }
}

// ── Shopify profit ────────────────────────────────────────────────────────────

export function shopifyProfitInsights(r: ShopifyProfitResult): ToolInsight {
  const findings: InsightFinding[] = []

  findings.push({
    tone: r.true_margin_pct >= 15 ? 'good' : 'warn',
    text: `Your true margin is ${r.true_margin_pct}% after every fee — $${r.true_profit.toFixed(2)}/mo profit.`,
    value: r.true_profit,
    unit: 'per_month',
  })

  const platformFees = round2(r.plan_fee + r.processing_fee)
  findings.push({
    tone: 'opportunity',
    text: `Shopify plan + payment processing alone take ${r.effective_rate_pct}% of revenue ($${platformFees.toFixed(2)}/mo).`,
    value: platformFees,
    unit: 'per_month',
  })

  if (r.returns_cost > 0) {
    findings.push({
      tone: 'warn',
      text: `Returns quietly cost you $${r.returns_cost.toFixed(2)}/mo — easy to miss in gross margin.`,
      value: r.returns_cost,
      unit: 'per_month',
    })
  }

  return { findings, nextTool: nextToolFor('shopify-profit') }
}

// ── Amazon FBA ──────────────────────────────────────────────────────────────

export function fbaInsights(r: FbaResult): ToolInsight {
  const findings: InsightFinding[] = []
  // selling_price = break_even_price + net_profit (fees + cost recovered, then profit)
  const sellingPrice = round2(r.break_even_price + r.net_profit)

  findings.push({
    tone: r.margin_pct >= 15 ? 'good' : 'warn',
    text: `You net $${r.net_profit.toFixed(2)} per unit — a ${r.margin_pct}% margin and ${r.roi_pct}% ROI.`,
    value: r.net_profit,
    unit: 'usd',
  })

  const feePct = sellingPrice > 0 ? round1((r.total_fees / sellingPrice) * 100) : 0
  findings.push({
    tone: 'opportunity',
    text: `Amazon fees take $${r.total_fees.toFixed(2)} per unit${feePct > 0 ? ` (${feePct}% of your price)` : ''}.`,
    value: r.total_fees,
    unit: 'usd',
  })

  if (r.net_profit <= 0) {
    findings.push({
      tone: 'warn',
      text: `You're below break-even ($${r.break_even_price.toFixed(2)}). Raise price or cut cost to turn a profit.`,
    })
  }

  return { findings, nextTool: nextToolFor('fba') }
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export function inventoryInsights(r: InventoryResult): ToolInsight {
  const findings: InsightFinding[] = []

  findings.push({
    tone: 'good',
    text: `Reorder when stock hits ${r.reorder_point} units; order ${r.eoq} at a time to minimise total cost.`,
  })

  if (r.working_capital > 0) {
    findings.push({
      tone: 'opportunity',
      text: `You're tying up $${r.working_capital.toFixed(2)} in average inventory at $${r.annual_holding_cost.toFixed(2)}/yr holding cost.`,
      value: r.annual_holding_cost,
      unit: 'usd',
    })
  }

  if (r.stockout_risk_pct > 0) {
    findings.push({
      tone: 'warn',
      text: `At this service level there's a ${r.stockout_risk_pct}% stockout risk each order cycle.`,
    })
  }

  return { findings, nextTool: nextToolFor('inventory') }
}

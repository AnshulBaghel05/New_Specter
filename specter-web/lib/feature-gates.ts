'use client'

import { useState, useEffect } from 'react'

// ── Tier & gate types ──────────────────────────────────────────────────────

export type UserTier =
  | 'free'
  | 'email'
  | 'recon'
  | 'cipher'
  | 'phantom'
  | 'predator'
  | 'eclipse'

export type GateLevel = 'free' | 'email' | 'recon' | 'cipher' | 'phantom'

export interface FeatureGate {
  level: GateLevel
  label?: string
  blurredPreview?: boolean
}

// ── Tier hierarchy (higher index = higher tier) ────────────────────────────

const TIER_ORDER: UserTier[] = [
  'free',
  'email',
  'recon',
  'cipher',
  'phantom',
  'predator',
  'eclipse',
]

const GATE_ORDER: GateLevel[] = ['free', 'email', 'recon', 'cipher', 'phantom']

export function isAccessible(gate: FeatureGate, userTier: UserTier): boolean {
  const userIdx = TIER_ORDER.indexOf(userTier)
  const gateIdx = GATE_ORDER.indexOf(gate.level)
  const gateAsTierIdx = TIER_ORDER.indexOf(gate.level as UserTier)
  return userIdx >= Math.max(gateIdx, gateAsTierIdx)
}

// ── CTA copy per gate level ────────────────────────────────────────────────

export function getGateCTA(level: GateLevel): { text: string; href: string } {
  switch (level) {
    case 'free':
      return { text: 'Use free', href: '#' }
    case 'email':
      return { text: 'Save result — free', href: '#email-gate' }
    case 'recon':
      return { text: 'Start monitoring free — 14 days', href: '/sign-up' }
    case 'cipher':
      return { text: 'Start repricing automatically', href: '/sign-up' }
    case 'phantom':
      return { text: 'Book a 15-min demo', href: 'mailto:sales@specterapp.io' }
  }
}

export function getGateLabel(level: GateLevel): string {
  switch (level) {
    case 'free':
      return 'Free'
    case 'email':
      return 'Free with email'
    case 'recon':
      return 'RECON+'
    case 'cipher':
      return 'CIPHER+'
    case 'phantom':
      return 'PHANTOM+'
  }
}

// ── Per-tool gate configs ──────────────────────────────────────────────────

export const PRICE_POSITION_GATES = {
  manualCalculation:     { level: 'free'  } as FeatureGate,
  raiseHoldSignal:       { level: 'free'  } as FeatureGate,
  marketRangeStats:      { level: 'free'  } as FeatureGate,
  competitorCountPreview:{ level: 'recon', blurredPreview: true, label: 'SPECTER found N more competitors' } as FeatureGate,
  signalGapPreview:      { level: 'recon', blurredPreview: true, label: 'Real signal vs manual gap' } as FeatureGate,
  revenueLiftPreview:    { level: 'recon', blurredPreview: true, label: 'Revenue lift calculation' } as FeatureGate,
  liveCompetitorPrices:  { level: 'recon', label: 'Live competitor prices' } as FeatureGate,
  skuMonitoring:         { level: 'recon', label: 'Automatic SKU monitoring' } as FeatureGate,
  priceTrendSparkline:   { level: 'cipher', blurredPreview: true, label: '30-day price trend' } as FeatureGate,
}

export const FBA_GATES = {
  coreProfit:            { level: 'free'  } as FeatureGate,
  feeBreakdown:          { level: 'free'  } as FeatureGate,
  advancedInputs:        { level: 'free'  } as FeatureGate,
  categoryBenchmark:     { level: 'email', blurredPreview: true, label: 'Category margin benchmark' } as FeatureGate,
  optimalPriceRange:     { level: 'email', blurredPreview: true, label: 'Optimal price range' } as FeatureGate,
  packageOptimizerTeaser:{ level: 'email', blurredPreview: true, label: 'Package optimizer savings' } as FeatureGate,
  packageOptimizerFull:  { level: 'cipher', label: 'Full package optimizer' } as FeatureGate,
  batchCatalog:          { level: 'cipher', label: 'Batch catalog analysis' } as FeatureGate,
  csvExport:             { level: 'cipher', label: 'CSV export' } as FeatureGate,
}

export const SHOPIFY_GATES = {
  coreProfit:            { level: 'free'  } as FeatureGate,
  planComparison:        { level: 'free'  } as FeatureGate,
  healthBadges:          { level: 'free'  } as FeatureGate,
  basicLtv:              { level: 'email', label: 'Basic LTV calculator' } as FeatureGate,
  advancedLtv:           { level: 'cipher', label: 'Advanced LTV & cohort analysis' } as FeatureGate,
  subscriptionMrr:       { level: 'cipher', blurredPreview: true, label: 'Subscription / MRR tab' } as FeatureGate,
  mrrProjection:         { level: 'cipher', label: '12-month MRR projection' } as FeatureGate,
}

export const SHIPPING_GATES = {
  domesticTab:           { level: 'free'  } as FeatureGate,
  internationalTab:      { level: 'free'  } as FeatureGate,
  bulkShipment:          { level: 'email', label: 'Bulk shipment calculator' } as FeatureGate,
  packagingOptimizerOne: { level: 'free'  } as FeatureGate,
  packagingOptimizerFull:{ level: 'cipher', label: 'Full packaging optimizer' } as FeatureGate,
  historicalRates:       { level: 'email', blurredPreview: true, label: 'Historical rate trends' } as FeatureGate,
}

export const ROAS_GATES = {
  basicRoas:             { level: 'free'  } as FeatureGate,
  funnelAnalysis:        { level: 'email', label: 'Funnel analysis tab' } as FeatureGate,
  topPlatformBenchmarks: { level: 'free'  } as FeatureGate,
  extendedBenchmarks:    { level: 'email', blurredPreview: true, label: 'Amazon, TikTok, Pinterest, Snapchat benchmarks' } as FeatureGate,
  peerComparison:        { level: 'email', blurredPreview: true, label: 'Your ROAS vs similar merchants' } as FeatureGate,
}

export const INVENTORY_GATES = {
  coreReorderCalc:       { level: 'free'  } as FeatureGate,
  safetyStockCalc:       { level: 'free'  } as FeatureGate,
  leadTimeBuffer:        { level: 'free'  } as FeatureGate,
  multiSkuOptimization:  { level: 'email', label: 'Multi-SKU optimization' } as FeatureGate,
  supplierComparison:    { level: 'cipher', blurredPreview: true, label: 'Supplier price comparison' } as FeatureGate,
  demandForecasting:     { level: 'cipher', label: 'Demand forecasting' } as FeatureGate,
}

// ── Hook: reads tier from localStorage for dev/testing ────────────────────

export function useUserTier(): UserTier {
  const [tier, setTier] = useState<UserTier>('free')

  useEffect(() => {
    const stored = localStorage.getItem('specter_tier') as UserTier | null
    if (stored && TIER_ORDER.includes(stored)) {
      setTier(stored)
    }
  }, [])

  return tier
}

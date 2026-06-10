import type { BlogPost } from '../types'

import { competitorPriceMonitoringShopify } from './competitor-price-monitoring-shopify'
import { catchCompetitorsOutOfStock } from './catch-competitors-out-of-stock'
import { repricingStrategyRaiseLowerHold } from './repricing-strategy-raise-lower-hold'
import { hiddenCostsKillingMargins } from './hidden-costs-killing-ecommerce-margins'
import { pricingAgainstAmazon } from './pricing-against-amazon-marketplace-competitors'
import { amazonFbaFeesExplained } from './amazon-fba-fees-explained'
import { shopifyFeesExplained } from './shopify-fees-explained'
import { reorderPointCalculation } from './reorder-point-calculation'
import { roasProfitabilityGuide } from './roas-profitability-guide'
import { pricingTurnaroundCaseStudy } from './pricing-turnaround-case-study'

/** Every published blog post. New posts: add the file + this entry.
 * Display order is computed by date in lib/blog (newest first). */
export const POSTS: BlogPost[] = [
  competitorPriceMonitoringShopify,
  catchCompetitorsOutOfStock,
  repricingStrategyRaiseLowerHold,
  hiddenCostsKillingMargins,
  pricingAgainstAmazon,
  amazonFbaFeesExplained,
  shopifyFeesExplained,
  reorderPointCalculation,
  roasProfitabilityGuide,
  pricingTurnaroundCaseStudy,
]

'use client'

import posthog from 'posthog-js'

// ── Event catalogue ────────────────────────────────────────────────────────

export type ToolId =
  | 'price-position'
  | 'fba'
  | 'shopify'
  | 'shipping'
  | 'roas'
  | 'inventory'

export type TierId = 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'

export type AnalyticsEvent =
  // Tool events
  | 'tool_page_viewed'
  | 'tool_calculated'
  | 'tool_email_gate_shown'
  | 'tool_email_gate_dismissed'
  | 'tool_email_captured'
  | 'tool_locked_section_cta_clicked'
  // Pricing events
  | 'pricing_page_viewed'
  | 'pricing_billing_toggled'
  | 'pricing_cta_clicked'
  | 'pricing_tier_viewed'
  // Conversion events
  | 'trial_started'
  | 'demo_booked'
  | 'sales_contacted'
  // Navigation
  | 'hero_cta_clicked'
  | 'nav_cta_clicked'
  // Workspace + PQL events (Wave 4)
  | 'workspace_viewed'
  | 'workspace_report_saved'
  | 'workspace_opportunity_clicked'
  | 'locked_value_card_viewed'
  | 'locked_value_card_cta_clicked'
  | 'pql_reached'

export interface EventProperties {
  tool_page_viewed:             { tool: ToolId }
  tool_calculated:              { tool: ToolId; signal?: 'RAISE' | 'LOWER' | 'HOLD'; has_result: boolean }
  tool_email_gate_shown:        { tool: ToolId }
  tool_email_gate_dismissed:    { tool: ToolId }
  tool_email_captured:          { tool: ToolId; source: 'gate' | 'upgrade_prompt' }
  tool_locked_section_cta_clicked: { tool: ToolId; gate_level: string; cta_text: string }
  pricing_page_viewed:          { source?: string }
  pricing_billing_toggled:      { to: 'monthly' | 'annual' }
  pricing_cta_clicked:          { tier: TierId; cta_text: string; billing_period: 'monthly' | 'annual'; href: string }
  pricing_tier_viewed:          { tier: TierId }
  trial_started:                { tier: TierId; source: string }
  demo_booked:                  { tier: TierId }
  sales_contacted:              { tier: TierId }
  hero_cta_clicked:             { cta_text: string }
  nav_cta_clicked:              { cta_text: string }
  // Workspace + PQL
  workspace_viewed:             { plan: string; saved_count: number }
  workspace_report_saved:       { tool: string; source: 'migration' | 'manual' }
  workspace_opportunity_clicked:{ tool: string }
  locked_value_card_viewed:     { surface: string; required_plan: string }
  locked_value_card_cta_clicked:{ surface: string; required_plan: string }
  pql_reached:                  { trigger: 'saves' | 'locked_surface'; saved_count?: number }
}

// ── Product-Qualified-Lead threshold ────────────────────────────────────────
// A free user is "qualified" once they've saved this many reports — at which
// point the Workspace nudges them toward a trial (PRICING.md: 3+ saves).
export const PQL_SAVE_THRESHOLD = 3

// ── Initialisation ─────────────────────────────────────────────────────────

let _initialised = false

export function initPostHog() {
  if (_initialised || typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: 'https://app.posthog.com',
    capture_pageview: false,   // we fire page views manually
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: false,        // explicit events only
    disable_session_recording: process.env.NODE_ENV !== 'production',
  })
  _initialised = true
}

// ── Identity ─────────────────────────────────────────────────────────────────

/** Associate subsequent events with a signed-in user (called on Supabase auth). */
export function identifyUser(userId: string, email?: string | null): void {
  if (typeof window === 'undefined') return
  try {
    posthog.identify(userId, email ? { email } : undefined)
  } catch {
    // never throw from analytics
  }
}

/** Register merchant_id (and plan) as super-properties so EVERY captured event
 *  carries them. Called from the dashboard once the merchant is known. */
export function identifyMerchant(merchantId: string, plan?: string): void {
  if (typeof window === 'undefined') return
  try {
    posthog.register(plan ? { merchant_id: merchantId, plan } : { merchant_id: merchantId })
  } catch {
    // never throw from analytics
  }
}

/** Clear identity + super-properties on sign-out so the next user isn't conflated. */
export function resetIdentity(): void {
  if (typeof window === 'undefined') return
  try {
    posthog.reset()
  } catch {
    // never throw from analytics
  }
}

// ── Core track function ────────────────────────────────────────────────────

export function track<E extends AnalyticsEvent>(
  event: E,
  props: EventProperties[E],
): void {
  if (typeof window === 'undefined') return
  try {
    posthog.capture(event, props as Record<string, unknown>)
  } catch {
    // never throw from analytics
  }
}

export function trackPageView(url: string) {
  if (typeof window === 'undefined') return
  try {
    posthog.capture('$pageview', { $current_url: url })
  } catch {
    // never throw from analytics
  }
}

// ── Convenience helpers ────────────────────────────────────────────────────

export function trackToolCalculated(
  tool: ToolId,
  opts: { signal?: 'RAISE' | 'LOWER' | 'HOLD'; has_result?: boolean } = {},
) {
  track('tool_calculated', { tool, signal: opts.signal, has_result: opts.has_result ?? true })
}

export function trackEmailCaptured(tool: ToolId, source: 'gate' | 'upgrade_prompt' = 'gate') {
  track('tool_email_captured', { tool, source })
}

export function trackEmailGateShown(tool: ToolId) {
  track('tool_email_gate_shown', { tool })
}

export function trackEmailGateDismissed(tool: ToolId) {
  track('tool_email_gate_dismissed', { tool })
}

export function trackPricingCTA(
  tier: TierId,
  ctaText: string,
  billingPeriod: 'monthly' | 'annual',
  href: string,
) {
  track('pricing_cta_clicked', { tier, cta_text: ctaText, billing_period: billingPeriod, href })
}

// ── Workspace + PQL helpers ──────────────────────────────────────────────────

export function trackWorkspaceViewed(plan: string, savedCount: number) {
  track('workspace_viewed', { plan, saved_count: savedCount })
}

export function trackOpportunityClicked(tool: string) {
  track('workspace_opportunity_clicked', { tool })
}

export function trackLockedValueCardViewed(surface: string, requiredPlan: string) {
  track('locked_value_card_viewed', { surface, required_plan: requiredPlan })
}

export function trackLockedValueCardCTA(surface: string, requiredPlan: string) {
  track('locked_value_card_cta_clicked', { surface, required_plan: requiredPlan })
}

/** Fire once when a free user crosses the PQL threshold. Guarded by localStorage
 *  so it only emits the first time per browser. */
export function trackPqlOnce(trigger: 'saves' | 'locked_surface', savedCount?: number) {
  if (typeof window === 'undefined') return
  const key = `specter_pql_${trigger}`
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  } catch {
    /* storage unavailable — fire anyway */
  }
  track('pql_reached', { trigger, saved_count: savedCount })
}

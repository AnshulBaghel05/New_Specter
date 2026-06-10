// Pure date-range presets for the Signals history picker (F9).
// PREDATOR/ECLIPSE may look back up to 90 days; every other plan is capped at 30.
// The backend (specter-api /signals) is the real gate (400 range_exceeds_plan);
// this only shapes what the picker offers and which preset is locked.

import type { Merchant } from '@/lib/api'

export type Plan = Merchant['plan']

export interface RangePreset {
  label: string
  days: number
}

export const RANGE_PRESETS: RangePreset[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

export const DEFAULT_RANGE_DAYS = 30

const HISTORY_90D_PLANS: ReadonlySet<Plan> = new Set<Plan>(['predator', 'eclipse'])

/** True for plans that retain 90 days of price/signal history. */
export function isHistory90dPlan(plan: Plan | undefined): boolean {
  return plan !== undefined && HISTORY_90D_PLANS.has(plan)
}

/** Max lookback window (days) the plan is allowed to query. */
export function maxLookbackDays(plan: Plan | undefined): number {
  return isHistory90dPlan(plan) ? 90 : 30
}

/** Whether a preset of `days` is selectable on `plan` (>30 needs a 90d plan). */
export function presetAllowed(days: number, plan: Plan | undefined): boolean {
  return days <= maxLookbackDays(plan)
}

/** ISO date (YYYY-MM-DD) for `days` before `today` — the date_from query value. */
export function dateFromForDays(days: number, today: Date): string {
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Parse a range-days URL param to a known preset, defaulting to 30. */
export function parseRangeDays(v: string | null): number {
  const n = Number(v)
  return RANGE_PRESETS.some((p) => p.days === n) ? n : DEFAULT_RANGE_DAYS
}

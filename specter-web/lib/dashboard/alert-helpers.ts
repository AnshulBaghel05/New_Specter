import type { OOSAlert } from '@/lib/api'

export type AlertSort = 'recent' | 'oldest' | 'domain'
export const OOS_URGENT_HOURS = 24

// Active: now − detected. Resolved: resolved − detected (0 if resolved_at missing).
export function oosDurationMs(a: OOSAlert, now: Date = new Date()): number {
  const detected = new Date(a.detected_at).getTime()
  const end =
    a.status === 'resolved' && a.resolved_at
      ? new Date(a.resolved_at).getTime()
      : now.getTime()
  return Math.max(0, end - detected)
}

// Largest whole unit, minimum "1m".
export function formatOosDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h`
  return `${Math.max(1, minutes)}m`
}

export function isUrgentOOS(a: OOSAlert, now: Date = new Date()): boolean {
  if (a.status !== 'active') return false
  return oosDurationMs(a, now) > OOS_URGENT_HOURS * 3_600_000
}

export function sortAlerts(alerts: OOSAlert[], sort: AlertSort): OOSAlert[] {
  const out = [...alerts]
  out.sort((a, b) => {
    if (sort === 'domain') return a.competitor_domain.localeCompare(b.competitor_domain)
    const ta = new Date(a.detected_at).getTime()
    const tb = new Date(b.detected_at).getTime()
    return sort === 'oldest' ? ta - tb : tb - ta
  })
  return out
}

export function alertCounts(alerts: OOSAlert[]): { active: number; resolved: number } {
  let active = 0
  let resolved = 0
  for (const a of alerts) {
    if (a.status === 'active') active++
    else resolved++
  }
  return { active, resolved }
}

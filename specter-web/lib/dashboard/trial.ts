/** Whole days until a trial ends. null when no trial, already ended, or unparseable. */
export function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end)) return null
  const diff = end - Date.now()
  if (diff <= 0) return null
  return Math.ceil(diff / 86_400_000)
}

// ── First-visit coachmark suppression ──────────────────────────────────────
// Lightweight, dismiss-once coachmarks that point a new user at the part of a
// tool that matters (e.g. the hero answer). Once dismissed they never show
// again. Pure + storage-injectable so the logic is unit-testable and SSR-safe.

/** The hero-answer coachmark shown on every public tool's result. */
export const COACHMARK_HERO = 'hero'

function key(id: string): string {
  return `specter_coachmark_${id}`
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  if (typeof localStorage !== 'undefined') return localStorage
  return null
}

/** True only if this coachmark exists and has never been dismissed. */
export function shouldShowCoachmark(id: string, storage?: Storage): boolean {
  const s = resolveStorage(storage)
  if (!s) return false
  try {
    return !s.getItem(key(id))
  } catch {
    return false
  }
}

/** Permanently dismiss a coachmark (records the timestamp). Never throws. */
export function dismissCoachmark(id: string, storage?: Storage): void {
  const s = resolveStorage(storage)
  if (!s) return
  try {
    s.setItem(key(id), String(Date.now()))
  } catch {
    /* ignore — storage unavailable */
  }
}

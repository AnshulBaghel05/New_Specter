// ── PQL upgrade-modal gating ────────────────────────────────────────────────
// A product-qualified lead (PQL) is a free user who has crossed the save
// threshold. The Workspace surfaces a one-time contextual upgrade modal naming
// the exact next outcome (start a RECON trial). Pure + storage-injectable so the
// "show once, never nag" rule is unit-testable and SSR-safe.

export const PQL_MODAL_KEY = 'specter_pql_modal_seen'

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  if (typeof localStorage !== 'undefined') return localStorage
  return null
}

/**
 * True only when the user has reached the save threshold AND the modal has not
 * been seen before. If storage is unavailable we cannot confirm "unseen", so we
 * return false rather than risk nagging on every visit.
 */
export function shouldShowPqlModal(savedCount: number, threshold: number, storage?: Storage): boolean {
  if (savedCount < threshold) return false
  const s = resolveStorage(storage)
  if (!s) return false
  try {
    return !s.getItem(PQL_MODAL_KEY)
  } catch {
    return false
  }
}

/** Permanently mark the PQL modal as seen. Never throws. */
export function markPqlModalSeen(storage?: Storage): void {
  const s = resolveStorage(storage)
  if (!s) return
  try {
    s.setItem(PQL_MODAL_KEY, String(Date.now()))
  } catch {
    /* ignore — storage unavailable */
  }
}

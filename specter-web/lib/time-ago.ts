/**
 * Compact relative time formatter for dashboard feeds.
 * Returns strings like "just now", "5m ago", "3h ago", "2d ago", "Apr 12".
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const diffMs = Date.now() - then
  const sec = Math.round(diffMs / 1000)

  if (sec < 45) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`

  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

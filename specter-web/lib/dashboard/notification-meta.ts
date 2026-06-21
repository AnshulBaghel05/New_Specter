/**
 * Pure presentation helpers for notifications — severity → colour token and
 * type → human label. Kept JSX-free so they're unit-tested without rendering;
 * the bell/dropdown/page map these to icons + classes.
 */
export const TYPE_LABELS: Record<string, string> = {
  signal: 'Signals',
  oos: 'Out of stock',
  billing: 'Billing',
  competitor_change: 'Competitor',
  system: 'System',
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

// Severity → design-system text colour token (matches tokens used elsewhere in
// the dashboard: primary green for success, amber for warning, rose for critical).
export const SEVERITY_TONE: Record<string, string> = {
  info: 'text-sky-400',
  success: 'text-primary',
  warning: 'text-amber-400',
  critical: 'text-rose-400',
}

export function severityTone(severity: string): string {
  return SEVERITY_TONE[severity] ?? 'text-muted'
}

// The type filters shown on the full notifications page (in order).
export const FILTERABLE_TYPES = ['signal', 'oos', 'billing'] as const

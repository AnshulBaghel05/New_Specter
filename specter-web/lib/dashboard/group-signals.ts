import type { Signal } from '@/lib/api'

export interface SignalDayGroup {
  label: 'Today' | 'Yesterday' | 'Earlier'
  items: Signal[]
}

// Whole-day difference between two dates using local calendar days.
function dayDiff(now: Date, then: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()
  return Math.round((a - b) / 86_400_000)
}

export function groupSignalsByDay(signals: Signal[], now: Date = new Date()): SignalDayGroup[] {
  const today: Signal[] = []
  const yesterday: Signal[] = []
  const earlier: Signal[] = []

  for (const s of signals) {
    const diff = dayDiff(now, new Date(s.created_at))
    if (diff <= 0) today.push(s)
    else if (diff === 1) yesterday.push(s)
    else earlier.push(s)
  }

  const groups: SignalDayGroup[] = [
    { label: 'Today', items: today },
    { label: 'Yesterday', items: yesterday },
    { label: 'Earlier', items: earlier },
  ]
  return groups.filter((g) => g.items.length > 0)
}

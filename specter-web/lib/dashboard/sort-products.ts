import type { Product, SignalType } from '@/lib/api'

export type ProductSort = 'signals' | 'updated' | 'name'

const SIGNAL_RANK: Record<SignalType, number> = { RAISE: 0, LOWER: 1, HOLD: 2 }

export function sortProducts(products: Product[], mode: ProductSort): Product[] {
  const arr = [...products]
  if (mode === 'name') {
    return arr.sort((a, b) => a.title.localeCompare(b.title))
  }
  if (mode === 'updated') {
    return arr.sort((a, b) =>
      (b.latest_signal?.created_at ?? '').localeCompare(a.latest_signal?.created_at ?? ''))
  }
  // signals-first: RAISE, LOWER, HOLD, then none; ties by confidence desc
  return arr.sort((a, b) => {
    const ra = a.latest_signal ? SIGNAL_RANK[a.latest_signal.type] : 99
    const rb = b.latest_signal ? SIGNAL_RANK[b.latest_signal.type] : 99
    if (ra !== rb) return ra - rb
    return (b.latest_signal?.confidence ?? 0) - (a.latest_signal?.confidence ?? 0)
  })
}

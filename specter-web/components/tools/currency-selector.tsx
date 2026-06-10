'use client'

import { Globe } from 'lucide-react'
import { CURRENCIES, RATES_AS_OF } from '@/lib/tools/currency'
import { useCurrency } from '@/hooks/use-currency'

export default function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()

  return (
    <div
      className="flex items-center gap-1.5"
      title={`Exchange rates as of ${RATES_AS_OF}`}
    >
      <Globe size={12} className="text-muted" aria-hidden="true" />
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="bg-transparent border border-border rounded-lg px-2 py-1 font-mono text-xs text-muted hover:text-text focus:outline-none focus:border-primary/50 cursor-pointer transition-colors appearance-none"
        aria-label="Select display currency"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} {c.symbol}
          </option>
        ))}
      </select>
    </div>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  CURRENCIES,
  EXCHANGE_RATES,
  toUSD as toUSDFn,
  fromUSD as fromUSDFn,
  fmt as fmtFn,
} from '@/lib/tools/currency'

const STORAGE_KEY = 'specter_currency'

export function useCurrency() {
  const [currency, setCurrencyState] = useState('USD')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && EXCHANGE_RATES[stored]) {
      setCurrencyState(stored)
    }
  }, [])

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code)
    localStorage.setItem(STORAGE_KEY, code)
  }, [])

  const toUSD = useCallback(
    (amount: number) => toUSDFn(amount, currency),
    [currency],
  )

  const fromUSD = useCallback(
    (amount: number) => fromUSDFn(amount, currency),
    [currency],
  )

  const fmt = useCallback(
    (amount: number) => fmtFn(amount, currency),
    [currency],
  )

  return { currency, setCurrency, toUSD, fromUSD, fmt, currencies: CURRENCIES }
}

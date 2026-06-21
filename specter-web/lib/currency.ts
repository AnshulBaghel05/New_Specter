/**
 * Currency helpers for the dashboard.
 *
 * Products carry their own ISO-4217 currency (see specter-api skus.currency).
 * The API normalizes competitor prices into the product's currency for signal
 * math, but the UI still shows each price labelled with the currency it belongs
 * to. `SUPPORTED_CURRENCIES` mirrors the server's allow-list (services/fx.py).
 */

export interface CurrencyOption {
  code: string
  symbol: string
  label: string
}

// Keep in sync with specter-api services/fx.py SUPPORTED_CURRENCIES.
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand' },
  { code: 'MXN', symbol: 'Mex$', label: 'Mexican Peso' },
  { code: 'NZD', symbol: 'NZ$', label: 'New Zealand Dollar' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', label: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', label: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', label: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', label: 'Polish Złoty' },
  { code: 'HKD', symbol: 'HK$', label: 'Hong Kong Dollar' },
]

const SYMBOL_BY_CODE: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.symbol]),
)

export const DEFAULT_CURRENCY = 'USD'

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return '$'
  return SYMBOL_BY_CODE[code.toUpperCase()] ?? code.toUpperCase()
}

/**
 * Format a money amount in the given currency. Uses the platform Intl formatter
 * (correct symbol placement + per-currency decimal places, e.g. JPY has none),
 * falling back to a symbol + fixed-2 string if Intl rejects an unusual code.
 * Returns an em dash for null/undefined so callers don't special-case it.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  code: string | null | undefined,
): string {
  if (amount == null || amount === '') return '—'
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(value)) return '—'
  const currency = (code || DEFAULT_CURRENCY).toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${currencySymbol(currency)}${value.toFixed(2)}`
  }
}

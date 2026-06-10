export interface Currency {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$',    name: 'US Dollar'         },
  { code: 'EUR', symbol: '€',    name: 'Euro'              },
  { code: 'GBP', symbol: '£',    name: 'British Pound'     },
  { code: 'CAD', symbol: 'C$',   name: 'Canadian Dollar'   },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar' },
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee'      },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen'      },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar'  },
  { code: 'AED', symbol: 'د.إ',  name: 'UAE Dirham'        },
  { code: 'MXN', symbol: 'MX$',  name: 'Mexican Peso'      },
]

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,    EUR: 0.92,  GBP: 0.79,  CAD: 1.36,
  AUD: 1.53, INR: 83.5,  JPY: 156,   SGD: 1.34,
  AED: 3.67, MXN: 17.2,
}

export const RATES_AS_OF = '2025-05-01'

export function toUSD(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] ?? 1
  return amount / rate
}

export function fromUSD(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] ?? 1
  return amount * rate
}

export function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
}

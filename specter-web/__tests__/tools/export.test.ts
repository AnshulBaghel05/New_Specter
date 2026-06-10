import { describe, it, expect } from 'vitest'
import { buildCsvString } from '@/lib/tools/export'

const inputs = [
  { label: 'Selling Price', value: '$29.99' },
  { label: 'Product Cost', value: '$8.00' },
]
const results = [
  { label: 'Net Profit', value: '$12.50' },
  { label: 'Margin', value: '41.8%' },
]

describe('buildCsvString', () => {
  it('includes the tool id in the header row', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('fba')
  })
  it('includes the currency in the header row', () => {
    const csv = buildCsvString('fba', inputs, results, 'EUR')
    expect(csv).toContain('Currency: EUR')
  })
  it('includes INPUTS section header', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('--- INPUTS ---')
  })
  it('includes RESULTS section header', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('--- RESULTS ---')
  })
  it('includes all input labels and values', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('Selling Price')
    expect(csv).toContain('$29.99')
    expect(csv).toContain('Product Cost')
    expect(csv).toContain('$8.00')
  })
  it('includes all result labels and values', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('Net Profit')
    expect(csv).toContain('$12.50')
    expect(csv).toContain('Margin')
    expect(csv).toContain('41.8%')
  })
  it('returns a non-empty string', () => {
    const csv = buildCsvString('roas', [], [], 'USD')
    expect(csv.length).toBeGreaterThan(0)
  })
  it('wraps fields containing commas in double-quotes', () => {
    const csv = buildCsvString(
      'fba',
      [{ label: 'Revenue', value: '$1,234.56' }],
      [],
      'USD',
    )
    expect(csv).toContain('"$1,234.56"')
  })
})

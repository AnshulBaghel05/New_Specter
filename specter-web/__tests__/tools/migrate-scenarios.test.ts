import { describe, it, expect } from 'vitest'
import {
  collectLocalScenarios,
  toCalculationPayloads,
  type LocalScenarioGroup,
} from '@/lib/tools/migrate-scenarios'
import type { Scenario } from '@/lib/tools/scenarios'

/** Minimal in-memory Storage stand-in (only what collectLocalScenarios uses). */
function fakeStorage(entries: Record<string, string>): Storage {
  const keys = Object.keys(entries)
  return {
    length: keys.length,
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => entries[k] ?? null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  } as Storage
}

function scenario(name: string): Scenario {
  return {
    id: crypto.randomUUID(),
    name,
    currency: 'USD',
    inputs: { selling_price: '29.99' },
    results: { net_profit: 4.2 },
    savedAt: Date.now(),
  }
}

describe('collectLocalScenarios', () => {
  it('gathers only specter_scenarios_* keys and tags each with its toolId', () => {
    const storage = fakeStorage({
      specter_scenarios_fba: JSON.stringify([scenario('Product A')]),
      'specter_scenarios_roas-basic': JSON.stringify([scenario('May Ads'), scenario('June Ads')]),
      unrelated_key: 'ignore me',
    })
    const groups = collectLocalScenarios(storage)
    const ids = groups.map((g) => g.toolId).sort()
    expect(ids).toEqual(['fba', 'roas-basic'])
    expect(groups.find((g) => g.toolId === 'roas-basic')!.scenarios).toHaveLength(2)
  })

  it('skips empty and corrupt entries', () => {
    const storage = fakeStorage({
      specter_scenarios_fba: '[]',
      specter_scenarios_roas: 'not json',
    })
    expect(collectLocalScenarios(storage)).toEqual([])
  })

  it('returns [] when no storage is available', () => {
    expect(collectLocalScenarios(undefined as unknown as Storage)).toEqual([])
  })
})

describe('toCalculationPayloads', () => {
  it('flattens groups into one create-payload per scenario', () => {
    const groups: LocalScenarioGroup[] = [
      { toolId: 'fba', scenarios: [scenario('Product A')] },
      { toolId: 'roas-basic', scenarios: [scenario('May'), scenario('June')] },
    ]
    const payloads = toCalculationPayloads(groups)
    expect(payloads).toHaveLength(3)
    const fba = payloads.find((p) => p.tool_name === 'fba')!
    expect(fba.name).toBe('Product A')
    expect(fba.currency).toBe('USD')
    expect(fba.inputs).toEqual({ selling_price: '29.99' })
    expect(fba.results).toEqual({ net_profit: 4.2 })
  })

  it('defaults a missing currency to null', () => {
    const s = scenario('X')
    // @ts-expect-error — simulate a legacy scenario with no currency
    delete s.currency
    const payloads = toCalculationPayloads([{ toolId: 'fba', scenarios: [s] }])
    expect(payloads[0].currency).toBeNull()
  })

  it('returns [] for no groups', () => {
    expect(toCalculationPayloads([])).toEqual([])
  })
})

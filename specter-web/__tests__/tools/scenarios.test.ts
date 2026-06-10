import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadScenarios, saveScenario, deleteScenario } from '@/lib/tools/scenarios'

const TOOL_ID = 'test-tool'
const mockStore: Record<string, string> = {}

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mockStore[k] ?? null,
    setItem: (k: string, v: string) => { mockStore[k] = v },
    removeItem: (k: string) => { delete mockStore[k] },
  })
  let uuid = 0
  vi.stubGlobal('crypto', {
    randomUUID: () => `uuid-${++uuid}`,
  })
})

describe('loadScenarios', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadScenarios(TOOL_ID)).toEqual([])
  })
  it('returns empty array when stored value is invalid JSON', () => {
    mockStore[`specter_scenarios_${TOOL_ID}`] = 'not-json'
    expect(loadScenarios(TOOL_ID)).toEqual([])
  })
  it('returns parsed scenarios from localStorage', () => {
    const data = [{ id: '1', name: 'A', currency: 'USD', inputs: {}, results: {}, savedAt: 1 }]
    mockStore[`specter_scenarios_${TOOL_ID}`] = JSON.stringify(data)
    expect(loadScenarios(TOOL_ID)).toHaveLength(1)
    expect(loadScenarios(TOOL_ID)[0].name).toBe('A')
  })
})

describe('saveScenario', () => {
  it('returns scenario with generated id and savedAt', () => {
    const s = saveScenario(TOOL_ID, { name: 'Test', currency: 'USD', inputs: {}, results: {} })
    expect(s.id).toBeTruthy()
    expect(s.savedAt).toBeGreaterThan(0)
    expect(s.name).toBe('Test')
  })
  it('prepends new scenario so newest is first', () => {
    saveScenario(TOOL_ID, { name: 'First', currency: 'USD', inputs: {}, results: {} })
    saveScenario(TOOL_ID, { name: 'Second', currency: 'USD', inputs: {}, results: {} })
    const list = loadScenarios(TOOL_ID)
    expect(list[0].name).toBe('Second')
    expect(list[1].name).toBe('First')
  })
  it('trims list to 5 scenarios maximum', () => {
    for (let i = 0; i < 7; i++) {
      saveScenario(TOOL_ID, { name: `S${i}`, currency: 'USD', inputs: {}, results: {} })
    }
    expect(loadScenarios(TOOL_ID)).toHaveLength(5)
  })
  it('persists inputs and results snapshots', () => {
    saveScenario(TOOL_ID, {
      name: 'WithData',
      currency: 'EUR',
      inputs: { price: '99', is_peak: true },
      results: { net_profit: 12.5 },
    })
    const s = loadScenarios(TOOL_ID)[0]
    expect(s.currency).toBe('EUR')
    expect(s.inputs['price']).toBe('99')
    expect(s.results['net_profit']).toBe(12.5)
  })
})

describe('deleteScenario', () => {
  it('removes the scenario with matching id', () => {
    const s = saveScenario(TOOL_ID, { name: 'ToDelete', currency: 'USD', inputs: {}, results: {} })
    deleteScenario(TOOL_ID, s.id)
    expect(loadScenarios(TOOL_ID)).toHaveLength(0)
  })
  it('leaves other scenarios intact', () => {
    saveScenario(TOOL_ID, { name: 'Keep', currency: 'USD', inputs: {}, results: {} })
    const del = saveScenario(TOOL_ID, { name: 'Delete', currency: 'USD', inputs: {}, results: {} })
    deleteScenario(TOOL_ID, del.id)
    expect(loadScenarios(TOOL_ID)).toHaveLength(1)
    expect(loadScenarios(TOOL_ID)[0].name).toBe('Keep')
  })
  it('does nothing if id not found', () => {
    saveScenario(TOOL_ID, { name: 'Keep', currency: 'USD', inputs: {}, results: {} })
    deleteScenario(TOOL_ID, 'nonexistent-id')
    expect(loadScenarios(TOOL_ID)).toHaveLength(1)
  })
})

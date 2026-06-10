export interface Scenario {
  id: string
  name: string
  currency: string
  inputs: Record<string, string | boolean>
  results: Record<string, number>
  savedAt: number
}

const MAX_SCENARIOS = 5

function storageKey(toolId: string): string {
  return `specter_scenarios_${toolId}`
}

export function loadScenarios(toolId: string): Scenario[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey(toolId)) : null
    return raw ? (JSON.parse(raw) as Scenario[]) : []
  } catch {
    return []
  }
}

export function saveScenario(
  toolId: string,
  scenario: Omit<Scenario, 'id' | 'savedAt'>,
): Scenario {
  const newScenario: Scenario = {
    ...scenario,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  }
  const existing = loadScenarios(toolId)
  const updated = [newScenario, ...existing].slice(0, MAX_SCENARIOS)
  localStorage.setItem(storageKey(toolId), JSON.stringify(updated))
  return newScenario
}

export function deleteScenario(toolId: string, id: string): void {
  const existing = loadScenarios(toolId)
  const updated = existing.filter((s) => s.id !== id)
  localStorage.setItem(storageKey(toolId), JSON.stringify(updated))
}

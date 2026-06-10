/**
 * Local-first → account migration for saved tool scenarios.
 *
 * Anonymous visitors save/compare for free in localStorage (lib/tools/scenarios.ts).
 * When they create an account, we lift those scenarios into the DB-backed
 * `tool_calculations` table so nothing is lost and the Workspace can show them
 * cross-device. Pure + storage-injectable so the mapping is unit-testable.
 */
import type { Scenario } from './scenarios'

const PREFIX = 'specter_scenarios_'

export interface LocalScenarioGroup {
  toolId: string
  scenarios: Scenario[]
}

/** Mirrors the specter-api CalculationCreate body. */
export interface CalculationPayload {
  tool_name: string
  name: string
  inputs: Record<string, string | boolean>
  results: Record<string, number>
  currency: string | null
}

/** Read every `specter_scenarios_*` bucket out of localStorage (or an injected
 *  Storage), skipping empty/corrupt entries. */
export function collectLocalScenarios(storage?: Storage): LocalScenarioGroup[] {
  const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!s) return []

  const groups: LocalScenarioGroup[] = []
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i)
    if (!key || !key.startsWith(PREFIX)) continue
    try {
      const parsed = JSON.parse(s.getItem(key) ?? '[]') as Scenario[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        groups.push({ toolId: key.slice(PREFIX.length), scenarios: parsed })
      }
    } catch {
      /* corrupt bucket — skip it */
    }
  }
  return groups
}

/** Flatten collected groups into one create-payload per scenario. */
export function toCalculationPayloads(groups: LocalScenarioGroup[]): CalculationPayload[] {
  const out: CalculationPayload[] = []
  for (const group of groups) {
    for (const sc of group.scenarios) {
      out.push({
        tool_name: group.toolId,
        name: sc.name,
        inputs: sc.inputs,
        results: sc.results,
        currency: sc.currency ?? null,
      })
    }
  }
  return out
}

/** Remove the migrated buckets from storage once they're safely in the DB. */
export function clearLocalScenarios(groups: LocalScenarioGroup[], storage?: Storage): void {
  const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!s) return
  for (const group of groups) {
    s.removeItem(`${PREFIX}${group.toolId}`)
  }
}

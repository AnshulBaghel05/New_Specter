'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  loadScenarios,
  saveScenario as saveFn,
  deleteScenario as deleteFn,
  Scenario,
} from '@/lib/tools/scenarios'

export function useScenarios(toolId: string) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  useEffect(() => {
    setScenarios(loadScenarios(toolId))
    setCompareIds(null)
  }, [toolId])

  const saveScenario = useCallback(
    (
      name: string,
      inputs: Record<string, string | boolean>,
      results: Record<string, number>,
      currency: string,
    ): Scenario | null => {
      try {
        const saved = saveFn(toolId, { name, currency, inputs, results })
        setScenarios(loadScenarios(toolId))
        return saved
      } catch (error) {
        console.error('Failed to save scenario:', error)
        return null
      }
    },
    [toolId],
  )

  const loadScenario = useCallback(
    (id: string): Scenario | undefined =>
      scenarios.find((s) => s.id === id),
    [scenarios],
  )

  const deleteScenario = useCallback(
    (id: string) => {
      deleteFn(toolId, id)
      setScenarios(loadScenarios(toolId))
      setCompareIds((prev) => {
        if (!prev) return null
        return prev.includes(id) ? null : prev
      })
    },
    [toolId],
  )

  return {
    scenarios,
    saveScenario,
    loadScenario,
    deleteScenario,
    compareIds,
    setCompareIds,
  }
}

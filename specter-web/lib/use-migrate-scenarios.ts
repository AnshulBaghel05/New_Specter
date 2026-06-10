'use client'

/**
 * Local-first → account bridge.
 *
 * Anonymous visitors save/compare for free in localStorage (the public tool
 * pages never call specter-api). When a logged-in user opens the Workspace —
 * a dashboard page that *is* allowed to call the API — we lift any local
 * scenarios into the DB-backed calculations so nothing they saved before (or
 * between) sign-ins is lost, then clear the buckets we successfully imported.
 *
 * Safety: a localStorage bucket is only cleared once *all* its scenarios saved,
 * so a network failure never drops un-synced work (it simply retries next visit).
 */
import { useEffect, useRef, useState } from 'react'
import {
  collectLocalScenarios,
  toCalculationPayloads,
  clearLocalScenarios,
  type LocalScenarioGroup,
} from '@/lib/tools/migrate-scenarios'
import { useSaveCalculation } from '@/lib/calculations-api'

export function useMigrateScenarios(enabled: boolean): { migrating: boolean } {
  const save = useSaveCalculation()
  const started = useRef(false)
  const [migrating, setMigrating] = useState(false)

  useEffect(() => {
    if (!enabled || started.current) return
    if (typeof localStorage === 'undefined') return

    const groups = collectLocalScenarios()
    if (groups.length === 0) return

    started.current = true
    setMigrating(true)

    void (async () => {
      const fullyImported: LocalScenarioGroup[] = []
      for (const group of groups) {
        const payloads = toCalculationPayloads([group])
        let allOk = true
        for (const payload of payloads) {
          try {
            await save.mutateAsync(payload)
          } catch {
            allOk = false // leave this bucket for a later retry
          }
        }
        if (allOk) fullyImported.push(group)
      }
      if (fullyImported.length > 0) clearLocalScenarios(fullyImported)
      setMigrating(false)
    })()
    // run-once per mount via `started`; save.mutateAsync is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { migrating }
}

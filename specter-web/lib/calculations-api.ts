'use client'

/**
 * Saved tool calculations (SPECTER Workspace persistence).
 *
 * Talks to the specter-api `/calculations` router (no plan gate — available to
 * every plan incl. `free`). Kept in its own module so the Workspace data layer
 * stays independent of the marketing/platform hooks in lib/api.ts.
 *
 * Auth mirrors lib/api.ts: attach the current Supabase access token as a bearer.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ApiError } from '@/lib/api'
import { PREVIEW } from '@/lib/preview-data'
import { buildOpportunityFeed, type OpportunityItem, type SavedCalc } from '@/lib/tools/workspace'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types (mirror specter-api CalculationOut) ─────────────────────────────────

export interface Calculation {
  id: string
  tool_name: string
  name: string
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  currency: string | null
  archived: boolean
  created_at: string
}

export interface SaveCalculationInput {
  tool_name: string
  name: string
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  currency?: string | null
}

export interface UpdateCalculationInput {
  id: string
  name?: string
  inputs?: Record<string, unknown>
  results?: Record<string, unknown>
  currency?: string | null
  archived?: boolean
}

// ── Authenticated fetcher ──────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function calcFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const resp = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (resp.status === 204) return undefined as T

  let payload: unknown = null
  const text = await resp.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!resp.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? (payload as { detail: unknown }).detail
        : payload
    const body =
      detail && typeof detail === 'object'
        ? (detail as { error: string })
        : { error: String(detail ?? 'unknown_error') }
    throw new ApiError(resp.status, body)
  }

  return payload as T
}

// ── Preview mode ──────────────────────────────────────────────────────────────
// In NEXT_PUBLIC_PREVIEW mode the app runs with no backend, so the Workspace
// must resolve to a clean empty state (matching the empty fixtures the rest of
// the dashboard uses) instead of erroring against a non-existent API. Saved
// reports start empty; mutations resolve optimistically so the UI stays live.

const PREVIEW_CALCS: Calculation[] = []

function previewCalculationFromSave(body: SaveCalculationInput): Calculation {
  return {
    id: `calc_preview_${Date.now()}`,
    tool_name: body.tool_name,
    name: body.name,
    inputs: body.inputs,
    results: body.results,
    currency: body.currency ?? null,
    archived: false,
    created_at: new Date().toISOString(),
  }
}

// ── Query keys ──────────────────────────────────────────────────────────────────

export const calculationKeys = {
  all: ['calculations'] as const,
  list: (toolName?: string) => ['calculations', 'list', toolName ?? 'all'] as const,
  detail: (id: string) => ['calculations', 'detail', id] as const,
}

// ── Hooks ───────────────────────────────────────────────────────────────────────

export function useCalculations(toolName?: string): UseQueryResult<Calculation[], ApiError> {
  const qs = toolName ? `?tool_name=${encodeURIComponent(toolName)}` : ''
  return useQuery({
    queryKey: calculationKeys.list(toolName),
    queryFn: () =>
      PREVIEW
        ? Promise.resolve(PREVIEW_CALCS)
        : calcFetch<Calculation[]>(`/calculations${qs}`),
    retry: false,
  })
}

export function useCalculationDetail(id: string | null): UseQueryResult<Calculation, ApiError> {
  return useQuery({
    queryKey: calculationKeys.detail(id ?? ''),
    queryFn: () =>
      PREVIEW
        ? Promise.reject(new ApiError(404, { error: 'not_found' }))
        : calcFetch<Calculation>(`/calculations/${id}`),
    enabled: !!id,
    retry: false,
  })
}

export function useSaveCalculation(): UseMutationResult<Calculation, ApiError, SaveCalculationInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve(previewCalculationFromSave(body))
        : calcFetch<Calculation>('/calculations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calculationKeys.all })
    },
  })
}

export function useUpdateCalculation(): UseMutationResult<Calculation, ApiError, UpdateCalculationInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }) =>
      PREVIEW
        ? Promise.resolve(previewCalculationFromSave({
            tool_name: '', name: '', inputs: {}, results: {},
            ...patch,
          } as SaveCalculationInput))
        : calcFetch<Calculation>(`/calculations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calculationKeys.all })
    },
  })
}

export function useDeleteCalculation(): UseMutationResult<void, ApiError, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) =>
      PREVIEW
        ? Promise.resolve(undefined as void)
        : calcFetch<void>(`/calculations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calculationKeys.all })
    },
  })
}

/**
 * Opportunity Feed — quantified, ranked actions derived client-side from the
 * user's saved calculations (reuses the deterministic insight engine). Returns
 * the same loading/error surface as the underlying list query.
 */
export function useOpportunityFeed(): {
  items: OpportunityItem[]
  isLoading: boolean
  isError: boolean
} {
  const { data, isLoading, isError } = useCalculations()
  const items = data ? buildOpportunityFeed(data as unknown as SavedCalc[]) : []
  return { items, isLoading, isError }
}

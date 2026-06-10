import { ApiError } from '@/lib/api'

// Single import path for toasts across the app.
export { toast } from 'sonner'

/**
 * Extracts a human-readable message from anything thrown by a mutation.
 * Order: ApiError body.message → ApiError body.error → Error.message → generic.
 * Used by the global MutationCache error net and (optionally) call sites.
 */
export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.body?.message) return err.body.message
    if (err.body?.error) return err.body.error
  }
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong. Please try again.'
}

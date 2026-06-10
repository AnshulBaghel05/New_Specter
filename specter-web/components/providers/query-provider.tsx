'use client'

import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { toast, formatApiError } from '@/lib/toast'

/**
 * Wraps the app in a TanStack Query client.
 * Defaults: 60s stale time (matches dashboard refetch cadence in ARCHITECTURE.md),
 * one retry, no refetch-on-focus to avoid hammering specter-api.
 *
 * A global MutationCache.onError surfaces an error toast for ANY failed mutation,
 * so no mutation can fail silently. Call sites add their own success toasts.
 */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (err) => toast.error(formatApiError(err)),
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchInterval: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: 'bg-surface border border-border text-text font-body',
            title: 'text-text',
            description: 'text-muted',
            closeButton: 'bg-surface border-border text-muted',
            error: 'border-rose-400/40',
            success: 'border-primary/40',
          },
        }}
      />
    </QueryClientProvider>
  )
}

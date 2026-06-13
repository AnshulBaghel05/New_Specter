'use client'

/**
 * App-wide client providers, mounted once in the root layout:
 *   QueryProvider → TanStack Query cache
 *   PostHogProvider → analytics init + manual pageview tracking
 *   SmoothScrollProvider → Lenis
 *
 * Also wires PostHog identity to Supabase auth: on sign-in we identify the user
 * (so events attach to a person); on sign-out we reset. The dashboard separately
 * registers merchant_id via identifyMerchant() once the merchant row is loaded,
 * so every event carries it. (The prompt referenced Clerk — this stack is
 * Supabase, per ARCHITECTURE.md.)
 */
import { useEffect } from 'react'
import QueryProvider from '@/components/providers/query-provider'
import SmoothScrollProvider from '@/components/providers/smooth-scroll'
import PostHogProvider from '@/components/analytics/posthog-provider'
import { createClient } from '@/lib/supabase/client'
import { identifyUser, resetIdentity } from '@/lib/analytics'

function SupabaseIdentity() {
  useEffect(() => {
    // No Supabase configured (e.g. preview/marketing-only) → nothing to identify.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return
    }
    const supabase = createClient()
    // onAuthStateChange fires INITIAL_SESSION on mount (covers already-signed-in)
    // plus every subsequent sign-in/out.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        identifyUser(session.user.id, session.user.email)
      } else {
        resetIdentity()
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])
  return null
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PostHogProvider>
        <SupabaseIdentity />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </PostHogProvider>
    </QueryProvider>
  )
}

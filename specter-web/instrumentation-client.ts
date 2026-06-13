import * as Sentry from '@sentry/nextjs'

// Browser Sentry init (loaded by withSentryConfig; the forward-compatible
// replacement for sentry.client.config.ts). Uses the public DSN; no-op when
// unset and disabled outside production so dev noise never reaches Sentry.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    enabled: process.env.NODE_ENV === 'production',
  })
}

// Instruments client-side navigations for tracing (no-op without a DSN).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

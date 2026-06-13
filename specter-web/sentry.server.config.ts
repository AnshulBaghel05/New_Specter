import * as Sentry from '@sentry/nextjs'

// Server-runtime Sentry init. No-op when SENTRY_DSN is unset (dev/preview).
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0, // tracing opt-in; errors always captured
    enabled: process.env.NODE_ENV === 'production',
  })
}

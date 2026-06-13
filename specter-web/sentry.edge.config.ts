import * as Sentry from '@sentry/nextjs'

// Edge-runtime Sentry init (middleware, edge routes). No-op without a DSN.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    enabled: process.env.NODE_ENV === 'production',
  })
}

/**
 * Next.js instrumentation hook. Initializes Sentry on the server/edge runtimes
 * by importing the matching runtime config. The client is initialized separately
 * via sentry.client.config.ts (loaded by withSentryConfig).
 *
 * All init is guarded on a DSN being present (see the config files), so with no
 * SENTRY_DSN set this is a complete no-op — local/preview builds need nothing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captures errors thrown in nested React Server Components (Next 14.2+).
export { captureRequestError as onRequestError } from '@sentry/nextjs'

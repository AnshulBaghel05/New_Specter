// Single source of truth for the specter-api base URL.
//
// NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time, so this
// is resolved when Vercel builds — not at runtime. If NEXT_PUBLIC_API_URL is unset
// in the Vercel Production environment, the old `?? 'http://localhost:8000'` default
// got baked into the production bundle; the page CSP (connect-src https: wss:) then
// blocks every localhost/http call and the whole dashboard fails.
//
// So: localhost is allowed ONLY for local dev. In a production build a missing var
// is a hard error — we fail loud at build/import instead of silently shipping a
// dead localhost URL.
function resolveApiUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '') // tolerate a trailing slash in the env value
  }
  // Local-dev fallback only. This branch is statically dead in a production build
  // (NODE_ENV is inlined to "production"), so the bundler strips it — the localhost
  // literal never ships in the production bundle.
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8000'
  }
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set. Set it to the backend HTTPS URL in the ' +
      'Vercel project Production environment and redeploy.',
  )
}

export const API_URL = resolveApiUrl()

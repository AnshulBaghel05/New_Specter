import { withSentryConfig } from '@sentry/nextjs'

// Content-Security-Policy. Permissive on script/style/connect (Next, Three.js,
// GSAP, Supabase, PostHog, Sentry, Razorpay all need inline/eval or varied
// origins) so the existing UI is unaffected, while still enforcing the
// high-value directives: frame-ancestors 'none' (clickjacking), object-src
// 'none', base-uri 'self', and HTTPS upgrade. Razorpay checkout is allowed to
// frame in via frame-src.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://*.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.razorpay.com",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile ESM-only packages so webpack can create stable module factories
  transpilePackages: ['three', '@react-three/fiber'],

  experimental: {
    // Tree-shake large icon/animation libraries to smaller client chunks
    optimizePackageImports: ['lucide-react', 'framer-motion'],
    // Required on Next 14 for instrumentation.ts (Sentry server/edge init) to run.
    instrumentationHook: true,
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

// Source-map upload only runs when SENTRY_AUTH_TOKEN + org/project are set
// (production CI). Without them the build proceeds normally, just no upload —
// so local/preview builds are unaffected.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
})

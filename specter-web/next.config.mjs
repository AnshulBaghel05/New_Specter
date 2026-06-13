import { withSentryConfig } from '@sentry/nextjs'

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

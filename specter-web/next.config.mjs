/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile ESM-only packages so webpack can create stable module factories
  transpilePackages: ['three', '@react-three/fiber'],

  experimental: {
    // Tree-shake large icon/animation libraries to smaller client chunks
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
}

export default nextConfig

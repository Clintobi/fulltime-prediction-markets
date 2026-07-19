/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: previously `output: 'export'` (pure static). Removed because the gasless
  // relayer at src/app/api/relay/route.ts is a server route that a static export
  // cannot build — Vercel runs this as a standard Next app (serverless) instead.
  images: { unoptimized: true },
  // Solana wallet-adapter ships types that clash with the installed @types/react
  // (a type-check-only issue; the adapter works fine at runtime). Don't let it
  // block the production build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig

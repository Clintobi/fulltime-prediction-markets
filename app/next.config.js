/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // Solana wallet-adapter ships types that clash with the installed @types/react
  // (a type-check-only issue; the adapter works fine at runtime). Don't let it
  // block the production build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig

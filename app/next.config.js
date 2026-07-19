/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: previously `output: 'export'` (pure static). Removed because the gasless
  // relayer at src/app/api/relay/route.ts is a server route that a static export
  // cannot build — Vercel runs this as a standard Next app (serverless) instead.
  images: { unoptimized: true },
}
module.exports = nextConfig

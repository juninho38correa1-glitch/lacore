/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ritvdomqjwodevyhpqox.supabase.co' },
    ],
  },
  // Desabilitar type checking no build para agilizar deploy
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Enable instrumentation hook for automatic migrations on startup
  instrumentationHook: true,
  images: {
    // Allow external images from any HTTPS source for user-provided URLs
    // (coat of arms, logos, etc.)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  experimental: {
    // Tree-shake large libraries for smaller bundles
    optimizePackageImports: ['lucide-react', 'd3'],
  },
};

export default nextConfig;

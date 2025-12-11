import type { NextConfig } from "next";
import packageJson from './package.json';

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    APP_VERSION: packageJson.version,
  },
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

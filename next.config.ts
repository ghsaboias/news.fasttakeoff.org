import type { NextConfig } from "next";

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Only initialize OpenNext Cloudflare dev harness when explicitly requested in dev
if (process.env.NODE_ENV === 'development' && process.env.OPENNEXT_DEV === '1') {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'news.fasttakeoff.org',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      {
        protocol: 'https',
        hostname: 'media.discordapp.net',
      },
      {
        protocol: 'https',
        hostname: 'images-ext-1.discordapp.net',
      },
      {
        protocol: 'https',
        hostname: 'images-ext-2.discordapp.net',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400, // 24 hours
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Enable experimental optimizations
  experimental: {
    optimizePackageImports: [
      // UI Components
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-tabs',
      '@radix-ui/react-collapsible',
      'lucide-react',
      // Data display
      'react-markdown',
      'react-masonry-css',
      // 3D/Visualization (large packages)
      '@react-three/drei',
      // Utilities
      'class-variance-authority',
      'clsx',
      'tailwind-merge'
    ],
  },
};

export default withBundleAnalyzer(nextConfig);

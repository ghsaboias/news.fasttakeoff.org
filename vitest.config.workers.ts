import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

// Cloudflare Workers runtime configuration for Queue/D1/API tests
export default defineWorkersConfig({
  test: {
    globals: true,
    setupFiles: ['tests/workers-setup.ts'],
    include: ['tests/workers/**/*.test.ts'],
    exclude: ['node_modules', '.next', '.open-next'],
    testTimeout: 30000, // Longer timeout for Workers tests
    hookTimeout: 30000,
    poolOptions: {
      workers: {
        singleWorker: true, // Single worker for simplicity
        isolatedStorage: true, // Clean state between tests
        wrangler: {
          configPath: './wrangler.toml',
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Handle Node.js compatibility issues
    'process.env': '{}',
  },
  optimizeDeps: {
    exclude: ['node:os', 'node:path', 'node:fs'],
  },
});
import { defineConfig } from 'vitest/config';
import path from 'path';

// Node.js environment configuration for frontend/utility tests
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Use node environment for now
    setupFiles: ['tests/setup.ts'],
    include: [
      'tests/unit/**/*.test.ts',
      '!tests/workers/**'
    ],
    exclude: ['node_modules', '.next', '.open-next', 'tests/workers/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

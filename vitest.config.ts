import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@rasid/kernel': path.resolve(__dirname, 'packages/kernel/src'),
      '@rasid/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});

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
    sequence: {
      files: [
        'tests/unit/step2-iam.test.ts',
        'tests/unit/step4-pipeline.test.ts',
        'tests/unit/step3-object-model.test.ts',
        'tests/integration/p0-primary.test.ts',
        'tests/integration/p0-secondary.test.ts',
        'tests/unit/step1-setup.test.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@rasid/kernel': path.resolve(__dirname, 'packages/kernel/src'),
      '@rasid/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});

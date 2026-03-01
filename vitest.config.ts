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
        // Core kernel (must run first — seed data required)
        'tests/unit/step2-iam.test.ts',
        'tests/unit/step4-pipeline.test.ts',
        'tests/unit/step3-object-model.test.ts',
        // Integration
        'tests/integration/p0-primary.test.ts',
        'tests/integration/p0-secondary.test.ts',
        // Kernel extensions
        'tests/unit/step6-lineage.test.ts',
        'tests/unit/step7-semantic-layer.test.ts',
        // Module tests (isolated, order-independent)
        'tests/unit/step8-design-system.test.ts',
        'tests/unit/step9-notification-router.test.ts',
        'tests/unit/step10-custom-tables.test.ts',
        'tests/unit/step11-sheetforge.test.ts',
        'tests/unit/step12-semantic.test.ts',
        'tests/unit/step13-search.test.ts',
        'tests/unit/step14-dashboard.test.ts',
        'tests/unit/step15-file-manager.test.ts',
        'tests/unit/step16-reports.test.ts',
        'tests/unit/step17-custom-pages.test.ts',
        'tests/unit/step18-presentations.test.ts',
        'tests/unit/step19-forms.test.ts',
        // AI Engine
        'tests/unit/step20-ai-engine.test.ts',
        'tests/unit/step21-tool-registry.test.ts',
        'tests/unit/step22-agent-framework.test.ts',
        'tests/unit/step23-rag-engine.test.ts',
        'tests/unit/step24-memory-layer.test.ts',
        'tests/unit/step25-guardrails.test.ts',
        'tests/unit/step26-proactive-engine.test.ts',
        // Phase 5 — Enterprise Operations
        'tests/unit/step27-observability.test.ts',
        'tests/unit/step28-backup.test.ts',
        'tests/unit/step29-gateway.test.ts',
        'tests/unit/step30-billing.test.ts',
        'tests/unit/step31-localization.test.ts',
        'tests/unit/step32-dev-portal.test.ts',
        // Tier X — Document Processing Cluster
        'tests/unit/step33-dpc.test.ts',
        // Setup verification (last — reads DB state)
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

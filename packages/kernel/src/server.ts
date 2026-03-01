import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import 'dotenv/config';
import { PlatformError } from '@rasid/shared';
import { authRoutes, userRoutes, roleRoutes } from './iam/iam.routes.js';
import { objectRoutes } from './object-model/object-model.routes.js';
import { auditRoutes } from './audit/audit.routes.js';
import { lineageRoutes } from './lineage/lineage.routes.js';
import { semanticLayerRoutes } from './semantic-layer/semantic-layer.routes.js';
import { designSystemRoutes } from './design-system/design-system.routes.js';
import { notificationRouterRoutes } from './notification-router/notification-router.routes.js';
import { registerObjectActions } from './action-registry/action-handlers.js';
import { registerNotificationActions } from './notification-router/notification-action-handlers.js';
import { registerCustomTableActions } from '../../modules/connectors/src/custom-tables.actions.js';
import { customTablesRoutes } from '../../modules/connectors/src/custom-tables.routes.js';
import { registerSheetForgeActions } from '../../modules/sheetforge/src/sheetforge.actions.js';
import { sheetForgeRoutes } from '../../modules/sheetforge/src/sheetforge.routes.js';
import { registerSemanticActions } from '../../modules/semantic/src/semantic.actions.js';
import { semanticRoutes } from '../../modules/semantic/src/semantic.routes.js';
import { registerSearchActions } from '../../modules/search/src/search.actions.js';
import { searchRoutes } from '../../modules/search/src/search.routes.js';
import { registerDashboardActions } from '../../modules/dashboard/src/dashboard.actions.js';
import { dashboardRoutes } from '../../modules/dashboard/src/dashboard.routes.js';
import { registerFileManagerActions } from '../../modules/file-manager/src/file-manager.actions.js';
import { fileManagerRoutes } from '../../modules/file-manager/src/file-manager.routes.js';
import { registerReportsActions } from '../../modules/reports/src/reports.actions.js';
import { reportsRoutes } from '../../modules/reports/src/reports.routes.js';
import { registerCustomPagesActions } from '../../modules/custom-pages/src/custom-pages.actions.js';
import { customPagesRoutes } from '../../modules/custom-pages/src/custom-pages.routes.js';
import { registerPresentationsActions } from '../../modules/presentations/src/presentations.actions.js';
import { presentationsRoutes } from '../../modules/presentations/src/presentations.routes.js';
import { registerFormsActions } from '../../modules/forms/src/forms.actions.js';
import { formsRoutes } from '../../modules/forms/src/forms.routes.js';
import { registerAiEngineActions } from '../../modules/ai-engine/src/ai-engine.actions.js';
import { aiEngineRoutes } from '../../modules/ai-engine/src/ai-engine.routes.js';
import { registerToolRegistryActions } from '../../modules/ai-engine/src/tool-registry.actions.js';
import { toolRegistryRoutes } from '../../modules/ai-engine/src/tool-registry.routes.js';
import { registerAgentActions } from '../../modules/ai-engine/src/agent.actions.js';
import { agentRoutes } from '../../modules/ai-engine/src/agent.routes.js';
import { registerRagActions } from '../../modules/ai-engine/src/rag.actions.js';
import { ragRoutes } from '../../modules/ai-engine/src/rag.routes.js';
import { registerMemoryActions } from '../../modules/ai-engine/src/memory.actions.js';
import { memoryRoutes } from '../../modules/ai-engine/src/memory.routes.js';
import { registerGuardrailsActions } from '../../modules/ai-engine/src/guardrails.actions.js';
import { guardrailsRoutes } from '../../modules/ai-engine/src/guardrails.routes.js';
import { registerProactiveActions } from '../../modules/ai-engine/src/proactive.actions.js';
import { proactiveRoutes } from '../../modules/ai-engine/src/proactive.routes.js';
import { registerObservabilityActions } from '../../modules/observability/src/observability.actions.js';
import { observabilityRoutes } from '../../modules/observability/src/observability.routes.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
    genReqId: () => crypto.randomUUID(),
    ajv: {
      customOptions: { allErrors: true },
    },
  });

  // Register rate limit plugin (global, but applied per-route)
  await app.register(rateLimit, {
    global: false,
  });

  // Global error handler
  app.setErrorHandler((error: Error & { validation?: unknown[]; statusCode?: number }, request, reply) => {
    if (error instanceof PlatformError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        meta: {
          request_id: request.id as string,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { issues: error.validation },
        },
        meta: {
          request_id: request.id as string,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Rate limit errors
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
        meta: {
          request_id: request.id as string,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Fastify-native errors with explicit statusCode (e.g. FST_ERR_CTP_EMPTY_JSON_BODY)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: {
          code: (error as Error & { code?: string }).code || 'BAD_REQUEST',
          message: error.message,
        },
        meta: {
          request_id: request.id as string,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Unknown errors
    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
      meta: {
        request_id: request.id as string,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Health check — no auth
  app.get('/api/v1/health', async () => {
    return { status: 'ok' };
  });

  // Auth routes (no JWT)
  await app.register(authRoutes);

  // User routes (JWT required)
  await app.register(userRoutes);

  // Role routes (JWT required)
  await app.register(roleRoutes);

  // Register action handlers (must be before routes that use them)
  registerObjectActions();
  registerNotificationActions();
  registerCustomTableActions();
  registerSheetForgeActions();
  registerSemanticActions();
  registerSearchActions();
  registerDashboardActions();
  registerFileManagerActions();
  registerReportsActions();
  registerCustomPagesActions();
  registerPresentationsActions();
  registerFormsActions();
  registerAiEngineActions();
  registerToolRegistryActions();
  registerAgentActions();
  registerRagActions();
  registerMemoryActions();
  registerGuardrailsActions();
  registerProactiveActions();
  registerObservabilityActions();

  // Object routes (JWT required, mutations via K3 pipeline)
  await app.register(objectRoutes);

  // Audit routes (JWT required)
  await app.register(auditRoutes);

  // Lineage routes (JWT required)
  await app.register(lineageRoutes);

  // Semantic Data Layer routes (JWT required)
  await app.register(semanticLayerRoutes);

  // Design System routes (JWT required)
  await app.register(designSystemRoutes);

  // Notification Router routes (JWT required)
  await app.register(notificationRouterRoutes);

  // ── Phase 2 Modules ──

  // M13 — Custom Tables (Data Studio)
  await app.register(customTablesRoutes);

  // M8 — SheetForge (Data Connectors)
  await app.register(sheetForgeRoutes);

  // M11 — Semantic Model + KPI Hub
  await app.register(semanticRoutes);

  // M12 — Search Engine
  await app.register(searchRoutes);

  // M9 — Dashboard Engine
  await app.register(dashboardRoutes);

  // ── Phase 3 Modules ──

  // M17 — File Manager
  await app.register(fileManagerRoutes);

  // M10 — Reports Engine
  await app.register(reportsRoutes);

  // M14 — Custom Pages
  await app.register(customPagesRoutes);

  // M16 — Presentations
  await app.register(presentationsRoutes);

  // M15 — Forms Builder
  await app.register(formsRoutes);

  // ── Phase 4 Modules ──

  // M21 — AI Engine (Step 1: Core)
  await app.register(aiEngineRoutes);

  // M21 — AI Engine (Step 2: Tool Registry)
  await app.register(toolRegistryRoutes);

  // M21 — AI Engine (Step 3: Agent Framework Core)
  await app.register(agentRoutes);
  await app.register(ragRoutes);

  // M21 — AI Engine (Step 5: Memory Layer)
  await app.register(memoryRoutes);

  // M21 — AI Engine (Step 6: Guardrails)
  await app.register(guardrailsRoutes);

  // M21 — AI Engine (Step 7: Proactive Engine)
  await app.register(proactiveRoutes);

  // ── Phase 5 Modules ──

  // M27 — Observability Layer
  await app.register(observabilityRoutes);

  return app;
}

// Start server if run directly
const isDirectRun =
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js');
if (isDirectRun) {
  buildServer()
    .then((app) =>
      app.listen({ port: PORT, host: HOST }).then((address) => {
        console.log(`Rasid Platform listening on ${address}`);
      }),
    )
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

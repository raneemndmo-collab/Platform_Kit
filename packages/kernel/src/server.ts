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

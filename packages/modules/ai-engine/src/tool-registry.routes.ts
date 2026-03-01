/**
 * M21 AI Engine — Tool Registry Routes (Step 2)
 *
 * ALL endpoints go through K3 actionRegistry.executeAction() for RBAC.
 * Schema: mod_ai
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type postgres from 'postgres';
import {
  actionRegistry,
  authMiddleware,
  tenantMiddleware,
  tenantCleanup,
  buildRequestContext,
} from '../../../kernel/src/index.js';
import {
  ValidationError,
  PermissionDeniedError,
  NotFoundError,
} from '@rasid/shared';

function meta(requestId: string, extra?: Record<string, unknown>) {
  return {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function handleError(
  err: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (err instanceof PermissionDeniedError) {
    return reply.status(403).send({
      error: { code: 'PERMISSION_DENIED', message: err.message },
      meta: meta(request.id as string),
    });
  }
  if (err instanceof NotFoundError) {
    return reply.status(404).send({
      error: { code: 'NOT_FOUND', message: err.message },
      meta: meta(request.id as string),
    });
  }
  if (err instanceof ValidationError) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: err.message },
      meta: meta(request.id as string),
    });
  }
  request.log.error(err);
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    meta: meta(request.id as string),
  });
}

export async function toolRegistryRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ═══════════════════════════════════════════
  // TOOL DEFINITIONS
  // ═══════════════════════════════════════════

  app.post('/api/v1/ai/tool-definitions', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_def.create',
        request.body ?? {},
        ctx, sql,
      );
      return reply.status(201).send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.get('/api/v1/ai/tool-definitions', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { category, status, tag } = request.query as {
        category?: string;
        status?: string;
        tag?: string;
      };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_def.list',
        { category, status, tag },
        ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.get('/api/v1/ai/tool-definitions/:toolId', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { toolId } = request.params as { toolId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_def.get',
        { tool_id: toolId },
        ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.patch('/api/v1/ai/tool-definitions/:toolId', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { toolId } = request.params as { toolId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_def.update',
        { tool_id: toolId, ...(request.body as Record<string, unknown>) },
        ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/ai/tool-definitions/:toolId', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { toolId } = request.params as { toolId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_def.delete',
        { tool_id: toolId },
        ctx, sql,
      );
      return reply.send({
        data: null,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });

  // ═══════════════════════════════════════════
  // TOOL BINDINGS
  // ═══════════════════════════════════════════

  app.post('/api/v1/ai/tool-bindings', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_binding.create',
        request.body ?? {},
        ctx, sql,
      );
      return reply.status(201).send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.get('/api/v1/ai/tool-bindings', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { tool_id } = request.query as { tool_id?: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_binding.list',
        { tool_id },
        ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/ai/tool-bindings/:bindingId', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { bindingId } = request.params as { bindingId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_binding.delete',
        { binding_id: bindingId },
        ctx, sql,
      );
      return reply.send({
        data: null,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });

  // ═══════════════════════════════════════════
  // SYNC FROM REGISTRY
  // ═══════════════════════════════════════════

  app.post('/api/v1/ai/tool-registry/sync', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool_registry.sync',
        {},
        ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) { return handleError(err, request, reply); }
  });
}

/**
 * M21 AI Engine — Routes (Step 1: Core)
 *
 * ALL endpoints go through K3 actionRegistry.executeAction() for RBAC.
 * No endpoint relies on authMiddleware alone.
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

export async function aiEngineRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ═══════════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════════

  app.post('/api/v1/ai/conversations', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.conversation.create',
        { input: request.body ?? {} },
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

  app.get('/api/v1/ai/conversations', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.conversation.list', {}, ctx, sql,
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

  app.get('/api/v1/ai/conversations/:conversationId', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { conversationId } = request.params as { conversationId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.conversation.get',
        { conversation_id: conversationId },
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

  app.patch('/api/v1/ai/conversations/:conversationId', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { conversationId } = request.params as { conversationId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.conversation.update',
        { conversation_id: conversationId, input: request.body },
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

  app.delete('/api/v1/ai/conversations/:conversationId', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { conversationId } = request.params as { conversationId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.conversation.delete',
        { conversation_id: conversationId },
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
  // CHAT (send message + get response)
  // ═══════════════════════════════════════════

  app.post('/api/v1/ai/conversations/:conversationId/chat', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { conversationId } = request.params as { conversationId: string };
      const { content } = request.body as { content: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.chat',
        { conversation_id: conversationId, content },
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

  // ═══════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════

  app.get('/api/v1/ai/conversations/:conversationId/messages', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { conversationId } = request.params as { conversationId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.messages.list',
        { conversation_id: conversationId },
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

  // ═══════════════════════════════════════════
  // TOOL INVOCATION
  // ═══════════════════════════════════════════

  app.post('/api/v1/ai/conversations/:conversationId/tools/invoke', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { conversationId } = request.params as { conversationId: string };
      const { action_id, input } = request.body as {
        action_id: string;
        input: Record<string, unknown>;
      };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool.invoke',
        { conversation_id: conversationId, action_id, input },
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

  app.get('/api/v1/ai/conversations/:conversationId/tools', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { conversationId } = request.params as { conversationId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tool.list',
        { conversation_id: conversationId },
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

  // ═══════════════════════════════════════════
  // TOOL DISCOVERY
  // ═══════════════════════════════════════════

  app.get('/api/v1/ai/tools', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { module, verb } = request.query as {
        module?: string;
        verb?: string;
      };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.tools.discover',
        { module, verb },
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

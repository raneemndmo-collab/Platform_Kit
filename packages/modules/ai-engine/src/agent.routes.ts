/**
 * M21 AI Engine — Agent Framework Core Routes (Step 3)
 *
 * ALL endpoints go through K3 actionRegistry.executeAction() for RBAC.
 * No endpoint relies on authMiddleware alone.
 * No streaming. No websocket. No background execution.
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
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

function handleError(err: unknown, reply: FastifyReply, requestId: string) {
  if (err instanceof ValidationError) {
    return reply.status(400).send({
      success: false, error: { code: 'VALIDATION_ERROR', message: err.message }, meta: meta(requestId),
    });
  }
  if (err instanceof PermissionDeniedError) {
    return reply.status(403).send({
      success: false, error: { code: 'PERMISSION_DENIED', message: err.message }, meta: meta(requestId),
    });
  }
  if (err instanceof NotFoundError) {
    return reply.status(404).send({
      success: false, error: { code: 'NOT_FOUND', message: err.message }, meta: meta(requestId),
    });
  }
  const msg = err instanceof Error ? err.message : String(err);
  return reply.status(500).send({
    success: false, error: { code: 'INTERNAL_ERROR', message: msg }, meta: meta(requestId),
  });
}

function getSql(request: FastifyRequest): postgres.ReservedSql {
  return (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
}

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ═══════════════════════════════════════════
  // AGENT DEFINITION CRUD
  // ═══════════════════════════════════════════

  // POST /api/v1/ai/agents
  app.post('/api/v1/ai/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    const sql = getSql(request);
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.agent.create', request.body as Record<string, unknown>, ctx, sql,
      );
      return reply.status(201).send({ success: true, data: result.data, meta: meta(ctx.correlationId) });
    } catch (err) { return handleError(err, reply, ctx.correlationId); }
  });

  // GET /api/v1/ai/agents
  app.get('/api/v1/ai/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    const sql = getSql(request);
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.agent.list', {}, ctx, sql,
      );
      return reply.status(200).send({ success: true, data: result.data, meta: meta(ctx.correlationId) });
    } catch (err) { return handleError(err, reply, ctx.correlationId); }
  });

  // GET /api/v1/ai/agents/:agent_id
  app.get('/api/v1/ai/agents/:agent_id', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    const sql = getSql(request);
    const { agent_id } = request.params as { agent_id: string };
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.agent.get', { agent_id }, ctx, sql,
      );
      return reply.status(200).send({ success: true, data: result.data, meta: meta(ctx.correlationId) });
    } catch (err) { return handleError(err, reply, ctx.correlationId); }
  });

  // PATCH /api/v1/ai/agents/:agent_id
  app.patch('/api/v1/ai/agents/:agent_id', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    const sql = getSql(request);
    const { agent_id } = request.params as { agent_id: string };
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.agent.update',
        { agent_id, ...(request.body as Record<string, unknown>) },
        ctx, sql,
      );
      return reply.status(200).send({ success: true, data: result.data, meta: meta(ctx.correlationId) });
    } catch (err) { return handleError(err, reply, ctx.correlationId); }
  });

  // DELETE /api/v1/ai/agents/:agent_id
  app.delete('/api/v1/ai/agents/:agent_id', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    const sql = getSql(request);
    const { agent_id } = request.params as { agent_id: string };
    try {
      await actionRegistry.executeAction(
        'rasid.mod.ai.agent.delete', { agent_id }, ctx, sql,
      );
      return reply.status(200).send({ success: true, data: null, meta: meta(ctx.correlationId) });
    } catch (err) { return handleError(err, reply, ctx.correlationId); }
  });

  // ═══════════════════════════════════════════
  // AGENT EXECUTION — ONE TOOL PER REQUEST
  // ═══════════════════════════════════════════

  // POST /api/v1/ai/agents/:agent_id/execute
  app.post('/api/v1/ai/agents/:agent_id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    const sql = getSql(request);
    const { agent_id } = request.params as { agent_id: string };
    const body = request.body as Record<string, unknown>;
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.agent.execute',
        { agent_id, tool_id: body.tool_id, input: body.input ?? {} },
        ctx, sql,
      );
      const execution = result.data as Record<string, unknown>;
      return reply.status(200).send({
        success: execution.status === 'completed',
        data: execution,
        meta: meta(ctx.correlationId),
      });
    } catch (err) { return handleError(err, reply, ctx.correlationId); }
  });

  // ═══════════════════════════════════════════
  // EXECUTION HISTORY
  // ═══════════════════════════════════════════

  // GET /api/v1/ai/agents/:agent_id/executions
  app.get('/api/v1/ai/agents/:agent_id/executions', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    const sql = getSql(request);
    const { agent_id } = request.params as { agent_id: string };
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.agent.executions.list', { agent_id }, ctx, sql,
      );
      return reply.status(200).send({ success: true, data: result.data, meta: meta(ctx.correlationId) });
    } catch (err) { return handleError(err, reply, ctx.correlationId); }
  });

  // GET /api/v1/ai/agents/executions/:execution_id
  app.get('/api/v1/ai/agents/executions/:execution_id', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    const sql = getSql(request);
    const { execution_id } = request.params as { execution_id: string };
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.agent.execution.get', { execution_id }, ctx, sql,
      );
      return reply.status(200).send({ success: true, data: result.data, meta: meta(ctx.correlationId) });
    } catch (err) { return handleError(err, reply, ctx.correlationId); }
  });
}

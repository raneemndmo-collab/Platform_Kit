/**
 * M21 AI Engine — Memory Layer Routes (Step 5)
 *
 * ALL endpoints go through K3 actionRegistry.executeAction() for RBAC.
 * Session-scoped memory only. No cross-session sharing.
 * No streaming. No websocket. No background execution.
 * Schema: mod_ai
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
import { ZodError } from 'zod';

function meta(requestId: string, extra?: Record<string, unknown>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

function handleError(err: unknown, reply: FastifyReply, requestId: string) {
  if (err instanceof ZodError) {
    const msg = err.issues.map(i => i.message).join('; ');
    return reply.status(400).send({ error: msg, ...meta(requestId) });
  }
  if (err instanceof ValidationError) {
    return reply.status(400).send({ error: err.message, ...meta(requestId) });
  }
  if (err instanceof PermissionDeniedError) {
    return reply.status(403).send({ error: err.message, ...meta(requestId) });
  }
  if (err instanceof NotFoundError) {
    return reply.status(404).send({ error: err.message, ...meta(requestId) });
  }
  // Handle Zod-like errors
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: Array<{ message: string }> }).issues;
    const msg = issues.map(i => i.message).join('; ');
    return reply.status(400).send({ error: msg, ...meta(requestId) });
  }
  const msg = err instanceof Error ? err.message : 'Internal server error';
  if (msg.includes('not found')) {
    return reply.status(404).send({ error: msg, ...meta(requestId) });
  }
  return reply.status(500).send({ error: msg, ...meta(requestId) });
}

function getSql(request: FastifyRequest): any {
  return (request as any).sql;
}

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ── SESSION CRUD ──

  // POST /api/v1/ai/memory/sessions — Create session
  app.post('/api/v1/ai/memory/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = crypto.randomUUID();
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.memory.session.create',
        request.body || {},
        ctx,
        sql,
      );
      return reply.status(201).send({ data: result.data, ...meta(requestId) });
    } catch (err) {
      return handleError(err, reply, requestId);
    }
  });

  // GET /api/v1/ai/memory/sessions — List sessions
  app.get('/api/v1/ai/memory/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = crypto.randomUUID();
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const query = request.query as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.memory.session.list',
        {
          limit: query.limit ? Number(query.limit) : undefined,
          offset: query.offset ? Number(query.offset) : undefined,
        },
        ctx,
        sql,
      );
      return reply.status(200).send({ data: result.data, ...meta(requestId) });
    } catch (err) {
      return handleError(err, reply, requestId);
    }
  });

  // GET /api/v1/ai/memory/sessions/:id — Get session
  app.get('/api/v1/ai/memory/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = crypto.randomUUID();
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const { id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.memory.session.get',
        { session_id: id },
        ctx,
        sql,
      );
      return reply.status(200).send({ data: result.data, ...meta(requestId) });
    } catch (err) {
      return handleError(err, reply, requestId);
    }
  });

  // PATCH /api/v1/ai/memory/sessions/:id — Update session
  app.patch('/api/v1/ai/memory/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = crypto.randomUUID();
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const { id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.memory.session.update',
        { session_id: id, ...(request.body as any) },
        ctx,
        sql,
      );
      return reply.status(200).send({ data: result.data, ...meta(requestId) });
    } catch (err) {
      return handleError(err, reply, requestId);
    }
  });

  // DELETE /api/v1/ai/memory/sessions/:id — Delete session
  app.delete('/api/v1/ai/memory/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = crypto.randomUUID();
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const { id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.memory.session.delete',
        { session_id: id },
        ctx,
        sql,
      );
      return reply.status(200).send({ data: result.data, ...meta(requestId) });
    } catch (err) {
      return handleError(err, reply, requestId);
    }
  });

  // ── ENTRY MANAGEMENT ──

  // POST /api/v1/ai/memory/sessions/:id/entries — Add entry
  app.post('/api/v1/ai/memory/sessions/:id/entries', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = crypto.randomUUID();
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const { id } = request.params as any;
      const body = request.body as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.memory.entry.add',
        { session_id: id, role: body.role, content: body.content },
        ctx,
        sql,
      );
      return reply.status(201).send({ data: result.data, ...meta(requestId) });
    } catch (err) {
      return handleError(err, reply, requestId);
    }
  });

  // GET /api/v1/ai/memory/sessions/:id/entries — List entries
  app.get('/api/v1/ai/memory/sessions/:id/entries', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = crypto.randomUUID();
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const { id } = request.params as any;
      const query = request.query as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.memory.entry.list',
        {
          session_id: id,
          limit: query.limit ? Number(query.limit) : undefined,
          offset: query.offset ? Number(query.offset) : undefined,
        },
        ctx,
        sql,
      );
      return reply.status(200).send({ data: result.data, ...meta(requestId) });
    } catch (err) {
      return handleError(err, reply, requestId);
    }
  });
}

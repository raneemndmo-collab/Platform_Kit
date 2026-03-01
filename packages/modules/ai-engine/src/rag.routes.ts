/**
 * M21 AI Engine — RAG Engine Routes (Step 4)
 *
 * All routes go through K3 pipeline via actionRegistry.executeAction().
 * No direct DB access from routes. No external calls.
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

function meta(requestId: string, extra?: Record<string, unknown>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

function handleError(err: unknown, reply: FastifyReply, requestId: string) {
  if (err instanceof ValidationError) {
    return reply.status(400).send({ error: err.message, ...meta(requestId) });
  }
  if (err instanceof PermissionDeniedError) {
    return reply.status(403).send({ error: err.message, ...meta(requestId) });
  }
  if (err instanceof NotFoundError) {
    return reply.status(404).send({ error: err.message, ...meta(requestId) });
  }
  // Handle Zod validation errors
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

export async function ragRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ── POST /api/v1/ai/rag/sources — Create RAG source ──
  app.post('/api/v1/ai/rag/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.rag.source.create',
        request.body as Record<string, unknown>,
        ctx,
        (request as any).sql,
      );
      return reply.status(201).send(result);
    } catch (err) {
      return handleError(err, reply, ctx.correlationId);
    }
  });

  // ── GET /api/v1/ai/rag/sources — List RAG sources ──
  app.get('/api/v1/ai/rag/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.rag.source.list',
        {},
        ctx,
        (request as any).sql,
      );
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply, ctx.correlationId);
    }
  });

  // ── GET /api/v1/ai/rag/sources/:sourceId — Get RAG source ──
  app.get('/api/v1/ai/rag/sources/:sourceId', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    try {
      const { sourceId } = request.params as { sourceId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.rag.source.get',
        { source_id: sourceId },
        ctx,
        (request as any).sql,
      );
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply, ctx.correlationId);
    }
  });

  // ── PATCH /api/v1/ai/rag/sources/:sourceId — Update RAG source ──
  app.patch('/api/v1/ai/rag/sources/:sourceId', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    try {
      const { sourceId } = request.params as { sourceId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.rag.source.update',
        { source_id: sourceId, ...(request.body as Record<string, unknown>) },
        ctx,
        (request as any).sql,
      );
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply, ctx.correlationId);
    }
  });

  // ── DELETE /api/v1/ai/rag/sources/:sourceId — Delete RAG source ──
  app.delete('/api/v1/ai/rag/sources/:sourceId', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    try {
      const { sourceId } = request.params as { sourceId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.rag.source.delete',
        { source_id: sourceId },
        ctx,
        (request as any).sql,
      );
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply, ctx.correlationId);
    }
  });

  // ── POST /api/v1/ai/rag/retrieve — One-shot retrieval ──
  app.post('/api/v1/ai/rag/retrieve', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    try {
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.rag.retrieve',
        request.body as Record<string, unknown>,
        ctx,
        (request as any).sql,
      );
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply, ctx.correlationId);
    }
  });

  // ── GET /api/v1/ai/rag/logs — List retrieval logs ──
  app.get('/api/v1/ai/rag/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = buildRequestContext(request);
    try {
      const { limit } = request.query as { limit?: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.rag.logs.list',
        { limit: limit ? parseInt(limit, 10) : undefined },
        ctx,
        (request as any).sql,
      );
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply, ctx.correlationId);
    }
  });
}

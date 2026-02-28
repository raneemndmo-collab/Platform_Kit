/**
 * M16 Presentations — Routes
 *
 * All operations go through K3 pipeline via executeAction.
 * No direct DB access. No PPTX. No PDF. No rendering.
 * Metadata-only slide definitions with report references by ID.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type postgres from 'postgres';
import { actionRegistry } from '../../../kernel/src/action-registry/action-registry.service.js';
import { authMiddleware } from '../../../kernel/src/middleware/auth.middleware.js';
import { tenantMiddleware, tenantCleanup } from '../../../kernel/src/middleware/tenant.middleware.js';
import { buildRequestContext } from '../../../kernel/src/middleware/request-context.js';

type TenantRequest = FastifyRequest & { sql: postgres.ReservedSql };

function getSql(request: FastifyRequest): postgres.ReservedSql {
  return (request as TenantRequest).sql;
}

function meta(requestId: string, extra?: Record<string, unknown>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

function handleError(err: any, request: FastifyRequest, reply: FastifyReply) {
  const rid = request.id as string;
  if (err.name === 'ValidationError') return reply.status(400).send({ error: err.message, meta: meta(rid) });
  if (err.message?.includes('not found')) return reply.status(404).send({ error: err.message, meta: meta(rid) });
  if (err.status === 403 || err.message?.includes('permission')) return reply.status(403).send({ error: err.message, meta: meta(rid) });
  return reply.status(500).send({ error: err.message || 'Internal error', meta: meta(rid) });
}

export async function presentationsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const prefix = '/api/v1/presentations';

  // ── Presentation CRUD ──

  // POST /api/v1/presentations
  app.post(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.presentation.create', request.body, ctx, sql,
      );
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/presentations
  app.get(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.presentation.list', {}, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/presentations/:id
  app.get(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.presentation.get', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Presentation not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/presentations/:id
  app.patch(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.presentation.update', { id, ...(request.body as object) }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Presentation not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/presentations/:id
  app.delete(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      await actionRegistry.executeAction(
        'rasid.mod.presentations.presentation.delete', { id }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // ── Status transitions ──

  // POST /api/v1/presentations/:id/publish
  app.post(`${prefix}/:id/publish`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.presentation.publish', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Presentation not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/presentations/:id/archive
  app.post(`${prefix}/:id/archive`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.presentation.archive', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Presentation not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // ── Slide management ──

  // POST /api/v1/presentations/:id/slides
  app.post(`${prefix}/:id/slides`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.slide.add', { presentation_id: id, ...(request.body as object) }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Presentation not found' }, meta: meta(request.id as string) });
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/presentations/:id/slides/:slideId
  app.patch(`${prefix}/:id/slides/:slideId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, slideId } = request.params as { id: string; slideId: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.slide.update', { presentation_id: id, slide_id: slideId, ...(request.body as object) }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Slide not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/presentations/:id/slides/:slideId
  app.delete(`${prefix}/:id/slides/:slideId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, slideId } = request.params as { id: string; slideId: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.slide.remove', { presentation_id: id, slide_id: slideId }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Slide not found' }, meta: meta(request.id as string) });
      return reply.status(204).send();
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/presentations/:id/slides/reorder
  app.post(`${prefix}/:id/slides/reorder`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.presentations.slide.reorder', { presentation_id: id, ...(request.body as object) }, ctx, sql,
      );
      if (!result.data) return reply.status(400).send({ error: { code: 'INVALID_INPUT', message: 'Invalid slide IDs' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });
}

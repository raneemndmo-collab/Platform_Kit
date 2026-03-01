/**
 * M14 Custom Pages — Routes
 *
 * All operations go through K3 pipeline via executeAction.
 * No direct DB access. No rendering. No templating. No HTML.
 * Metadata-only page definitions with section references by ID.
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

export async function customPagesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const prefix = '/api/v1/pages';

  // ── Page CRUD ──

  // POST /api/v1/pages
  app.post(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.page.create', request.body, ctx, sql,
      );
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/pages
  app.get(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.page.list', {}, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/pages/:id
  app.get(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.page.get', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Page not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/pages/:id
  app.patch(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.page.update', { id, ...(request.body as object) }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Page not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/pages/:id
  app.delete(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      await actionRegistry.executeAction(
        'rasid.mod.custom_pages.page.delete', { id }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // ── Status transitions ──

  // POST /api/v1/pages/:id/publish
  app.post(`${prefix}/:id/publish`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.page.publish', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Page not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/pages/:id/archive
  app.post(`${prefix}/:id/archive`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.page.archive', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Page not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // ── Section management ──

  // POST /api/v1/pages/:id/sections
  app.post(`${prefix}/:id/sections`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.section.add', { page_id: id, ...(request.body as object) }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Page not found' }, meta: meta(request.id as string) });
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/pages/:id/sections/:sectionId
  app.patch(`${prefix}/:id/sections/:sectionId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, sectionId } = request.params as { id: string; sectionId: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.section.update', { page_id: id, section_id: sectionId, ...(request.body as object) }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Section not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/pages/:id/sections/:sectionId
  app.delete(`${prefix}/:id/sections/:sectionId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, sectionId } = request.params as { id: string; sectionId: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.section.remove', { page_id: id, section_id: sectionId }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Section not found' }, meta: meta(request.id as string) });
      return reply.status(204).send();
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/pages/:id/sections/reorder
  app.post(`${prefix}/:id/sections/reorder`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.custom_pages.section.reorder', { page_id: id, ...(request.body as object) }, ctx, sql,
      );
      if (!result.data) return reply.status(400).send({ error: { code: 'INVALID_INPUT', message: 'Invalid section IDs' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { audit_id: result.audit_id }) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });
}

/**
 * M12 Search Engine -- Routes
 * ALL endpoints go through K3 actionRegistry.executeAction() for RBAC enforcement.
 * No endpoint relies on authMiddleware alone.
 * Schema: mod_search
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
import { ValidationError, PermissionDeniedError, NotFoundError } from '@rasid/shared';
import { ZodError } from 'zod';

function meta(requestId: string, extra?: Record<string, unknown>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

function handleError(err: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (err instanceof PermissionDeniedError) {
    return reply.status(403).send({ error: { code: 'PERMISSION_DENIED', message: err.message }, meta: meta(request.id as string) });
  }
  if (err instanceof NotFoundError) {
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message: err.message }, meta: meta(request.id as string) });
  }
  if (err instanceof ValidationError) {
    return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: err.message }, meta: meta(request.id as string) });
  }
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') }, meta: meta(request.id as string) });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (message.includes('not found')) {
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message }, meta: meta(request.id as string) });
  }
  request.log.error(err);
  return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message }, meta: meta(request.id as string) });
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  /* ═══════════════════════════════════════════
   * SEARCH QUERY
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const query = request.query as Record<string, string>;
      const result = await actionRegistry.executeAction('rasid.mod.search.query', {
        q: query.q || '',
        module_id: query.module_id,
        object_type: query.object_type,
        limit: query.limit ? parseInt(query.limit) : undefined,
        offset: query.offset ? parseInt(query.offset) : undefined,
      }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * INDEX ENTRY CRUD
   * ═══════════════════════════════════════════ */

  app.post('/api/v1/search/index', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.search.index.create', request.body, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/search/index/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.search.index.delete', { id }, ctx, sql);
      return reply.send({ data: null, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/search/reindex', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.search.reindex', request.body || {}, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * SYNONYMS
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/search/synonyms', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.search.synonym.list', {}, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.get('/api/v1/search/synonyms/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.search.synonym.get', { id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Synonym not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/search/synonyms', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.search.synonym.create', request.body, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.patch('/api/v1/search/synonyms/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.search.synonym.update', { id, ...(request.body as object) }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/search/synonyms/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.search.synonym.delete', { id }, ctx, sql);
      return reply.send({ data: null, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * ANALYTICS (read-only)
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/search/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const query = request.query as Record<string, string>;
      const result = await actionRegistry.executeAction('rasid.mod.search.analytics.list', {
        limit: query.limit ? parseInt(query.limit) : undefined,
      }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });
}

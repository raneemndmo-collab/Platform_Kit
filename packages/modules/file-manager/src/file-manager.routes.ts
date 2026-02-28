/**
 * M17 File Manager -- Routes
 *
 * All operations go through K3 pipeline via executeAction.
 * No direct DB access. No binary storage endpoints.
 * Metadata-only file management.
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

export async function fileManagerRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const prefix = '/api/v1/file-manager';

  // ─── Folders ───

  app.post(`${prefix}/folders`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.folder.create', request.body as Record<string, unknown>, ctx, sql,
      );
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.get(`${prefix}/folders`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const query = request.query as Record<string, string>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.folder.list', { parent_id: query.parent_id || null }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.get(`${prefix}/folders/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.folder.get', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: 'Folder not found' });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.patch(`${prefix}/folders/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.folder.update',
        { id, ...(request.body as Record<string, unknown>) }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.delete(`${prefix}/folders/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction(
        'rasid.mod.file_manager.folder.delete', { id }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // ─── Files ───

  app.post(`${prefix}/files`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.file.create', request.body as Record<string, unknown>, ctx, sql,
      );
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.get(`${prefix}/files`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const query = request.query as Record<string, string>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.file.list', { folder_id: query.folder_id || null }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.get(`${prefix}/files/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.file.get', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: 'File not found' });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.patch(`${prefix}/files/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.file.update',
        { id, ...(request.body as Record<string, unknown>) }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.post(`${prefix}/files/:id/move`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.file.move',
        { id, ...(request.body as Record<string, unknown>) }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.post(`${prefix}/files/:id/archive`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.file_manager.file.archive', { id }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.delete(`${prefix}/files/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction(
        'rasid.mod.file_manager.file.delete', { id }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });
}

function handleError(err: any, request: FastifyRequest, reply: FastifyReply) {
  const rid = request.id as string;
  if (err.name === 'ValidationError') return reply.status(400).send({ error: err.message, meta: meta(rid) });
  if (err.message?.includes('not found')) return reply.status(404).send({ error: err.message, meta: meta(rid) });
  if (err.status === 403 || err.message?.includes('permission')) return reply.status(403).send({ error: err.message, meta: meta(rid) });
  return reply.status(500).send({ error: err.message || 'Internal error', meta: meta(rid) });
}

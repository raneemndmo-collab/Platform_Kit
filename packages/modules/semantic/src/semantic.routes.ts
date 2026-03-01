/**
 * M11 Semantic Model + KPI Hub -- Routes
 *
 * ALL endpoints (reads AND mutations) go through K3.executeAction().
 * K3 pipeline enforces RBAC via required_permissions on every action.
 * No endpoint relies on authMiddleware alone.
 * Schema: mod_semantic
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
  createModelSchema,
  updateModelSchema,
  defineDimensionSchema,
  defineFactSchema,
  createRelationshipSchema,
  createKpiSchema,
  updateKpiSchema,
} from './semantic.schema.js';
import type {
  CreateModelInput,
  UpdateModelInput,
  DefineDimensionInput,
  DefineFactInput,
  CreateRelationshipInput,
  CreateKpiInput,
  UpdateKpiInput,
} from './semantic.types.js';
import {
  PlatformError,
  NotFoundError,
  ValidationError,
  PermissionDeniedError,
} from '@rasid/shared';

function meta(requestId: string, extra?: Record<string, string>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

function handleError(err: unknown, request: FastifyRequest, reply: FastifyReply): ReturnType<typeof reply.send> {
  if (err instanceof PermissionDeniedError) {
    return reply.status(403).send({
      error: { code: 'PERMISSION_DENIED', message: err.message, details: (err as PlatformError).details },
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
  if (err instanceof PlatformError) {
    return reply.status(err.statusCode).send({
      error: { code: err.code, message: err.message, details: err.details },
      meta: meta(request.id as string),
    });
  }
  request.log.error(err);
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    meta: meta(request.id as string),
  });
}

export async function semanticRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  /* ═══════════════════════════════════════════
   * MODEL MUTATIONS (via K3)
   * ═══════════════════════════════════════════ */

  app.post('/api/v1/semantic/models', { schema: createModelSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as CreateModelInput;
      const result = await actionRegistry.executeAction('rasid.mod.semantic.model.create', input, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.patch('/api/v1/semantic/models/:id', { schema: updateModelSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<UpdateModelInput, 'id'>;
      const result = await actionRegistry.executeAction('rasid.mod.semantic.model.update', { id, ...body }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/semantic/models/:id/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.model.publish', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/semantic/models/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction('rasid.mod.semantic.model.delete', { id }, ctx, sql);
      return reply.status(204).send();
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * MODEL READS (via K3 for RBAC enforcement)
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/semantic/models', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.semantic.model.list', {}, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.get('/api/v1/semantic/models/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.model.get', { id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Model not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * DIMENSION MUTATIONS (via K3)
   * ═══════════════════════════════════════════ */

  app.post('/api/v1/semantic/models/:modelId/dimensions', { schema: defineDimensionSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { modelId } = request.params as { modelId: string };
      const body = request.body as Omit<DefineDimensionInput, 'model_id'>;
      const result = await actionRegistry.executeAction('rasid.mod.semantic.dimension.define', { model_id: modelId, ...body }, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/semantic/dimensions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction('rasid.mod.semantic.dimension.delete', { id }, ctx, sql);
      return reply.status(204).send();
    } catch (err) { return handleError(err, request, reply); }
  });

  /* DIMENSION READS (via K3) */

  app.get('/api/v1/semantic/models/:modelId/dimensions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { modelId } = request.params as { modelId: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.dimension.list', { model_id: modelId }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * FACT MUTATIONS (via K3)
   * ═══════════════════════════════════════════ */

  app.post('/api/v1/semantic/models/:modelId/facts', { schema: defineFactSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { modelId } = request.params as { modelId: string };
      const body = request.body as Omit<DefineFactInput, 'model_id'>;
      const result = await actionRegistry.executeAction('rasid.mod.semantic.fact.define', { model_id: modelId, ...body }, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/semantic/facts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction('rasid.mod.semantic.fact.delete', { id }, ctx, sql);
      return reply.status(204).send();
    } catch (err) { return handleError(err, request, reply); }
  });

  /* FACT READS (via K3) */

  app.get('/api/v1/semantic/models/:modelId/facts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { modelId } = request.params as { modelId: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.fact.list', { model_id: modelId }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * RELATIONSHIP MUTATIONS (via K3)
   * ═══════════════════════════════════════════ */

  app.post('/api/v1/semantic/models/:modelId/relationships', { schema: createRelationshipSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { modelId } = request.params as { modelId: string };
      const body = request.body as Omit<CreateRelationshipInput, 'model_id'>;
      const result = await actionRegistry.executeAction('rasid.mod.semantic.relationship.create', { model_id: modelId, ...body }, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/semantic/relationships/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction('rasid.mod.semantic.relationship.delete', { id }, ctx, sql);
      return reply.status(204).send();
    } catch (err) { return handleError(err, request, reply); }
  });

  /* RELATIONSHIP READS (via K3) */

  app.get('/api/v1/semantic/models/:modelId/relationships', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { modelId } = request.params as { modelId: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.relationship.list', { model_id: modelId }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * KPI MUTATIONS (via K3)
   * ═══════════════════════════════════════════ */

  app.post('/api/v1/semantic/kpis', { schema: createKpiSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as CreateKpiInput;
      const result = await actionRegistry.executeAction('rasid.mod.semantic.kpi.create', input, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.patch('/api/v1/semantic/kpis/:id', { schema: updateKpiSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<UpdateKpiInput, 'id'>;
      const result = await actionRegistry.executeAction('rasid.mod.semantic.kpi.update', { id, ...body }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/semantic/kpis/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.kpi.approve', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/semantic/kpis/:id/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.kpi.deprecate', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * KPI READS (via K3 for RBAC enforcement)
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/semantic/kpis', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.semantic.kpi.list', {}, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.get('/api/v1/semantic/kpis/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.kpi.get', { id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'KPI not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.get('/api/v1/semantic/kpis/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.kpi.versions', { kpi_id: id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * IMPACT PREVIEW (via K3 for audit trail + RBAC)
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/semantic/kpis/:id/impact', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.semantic.impact.preview', { kpi_id: id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });
}

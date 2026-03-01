/**
 * M27 Observability Layer — Routes
 *
 * ALL endpoints go through K3 actionRegistry.executeAction() for RBAC.
 * Schema: mod_observability — no cross-schema queries.
 * No external monitoring. Metrics in DB tables only.
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
    return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: err.errors.map(e => e.message).join('; ') }, meta: meta(request.id as string) });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (message.includes('not found')) {
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message }, meta: meta(request.id as string) });
  }
  request.log.error(err);
  return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message }, meta: meta(request.id as string) });
}

export async function observabilityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  /* ═══════════════════════════════════════════
   * METRICS
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/observability/metrics', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.metric.list', {}, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.get('/api/v1/observability/metrics/:id', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.metric.get', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/observability/metrics', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.metric.create', request.body as Record<string, unknown>, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.patch('/api/v1/observability/metrics/:id', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.metric.update', { id, ...(request.body as Record<string, unknown>) }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/observability/metrics/:id', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.metric.delete', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * ALERTS
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/observability/alerts', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.alert.list', {}, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/observability/alerts', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.alert.create', request.body as Record<string, unknown>, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.patch('/api/v1/observability/alerts/:id', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.alert.update', { id, ...(request.body as Record<string, unknown>) }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/observability/alerts/:id', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.alert.delete', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * ALERT HISTORY
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/observability/alert-history', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const qs = request.query as { alert_id?: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.alert.history', { alert_id: qs.alert_id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/observability/alert-history/fire', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.alert.fire', request.body as Record<string, unknown>, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/observability/alert-history/:id/acknowledge', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.alert.acknowledge', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/observability/alert-history/:id/resolve', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.alert.resolve', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * SLO DEFINITIONS
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/observability/slos', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.slo.list', {}, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/observability/slos', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.slo.create', request.body as Record<string, unknown>, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.patch('/api/v1/observability/slos/:id', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.slo.update', { id, ...(request.body as Record<string, unknown>) }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.delete('/api/v1/observability/slos/:id', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.slo.delete', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  /* ═══════════════════════════════════════════
   * STATUS INCIDENTS
   * ═══════════════════════════════════════════ */

  app.get('/api/v1/observability/incidents', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.incident.list', {}, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/observability/incidents', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction('rasid.mod.observability.incident.create', request.body as Record<string, unknown>, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.patch('/api/v1/observability/incidents/:id', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.incident.update', { id, ...(request.body as Record<string, unknown>) }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });

  app.post('/api/v1/observability/incidents/:id/resolve', async (request, reply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction('rasid.mod.observability.incident.resolve', { id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (err) { return handleError(err, request, reply); }
  });
}

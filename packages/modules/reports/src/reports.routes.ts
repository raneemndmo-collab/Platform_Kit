/**
 * M10 Reports Engine — Routes
 *
 * All operations go through K3 pipeline via executeAction.
 * No direct DB access. No PDF. No export. No scheduling.
 * Metadata-driven report definitions + simulated execution.
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

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const prefix = '/api/v1/reports';

  // ═══════════════════════════════════════
  // Report Definitions
  // ═══════════════════════════════════════

  app.post(prefix, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.report.create', request.body as Record<string, unknown>, ctx, sql,
      );
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.get(prefix, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.report.list', {}, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.get(`${prefix}/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.report.get', { id }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: 'Report not found' });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.patch(`${prefix}/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.report.update',
        { id, ...(request.body as Record<string, unknown>) }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.post(`${prefix}/:id/publish`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.report.publish', { id }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.post(`${prefix}/:id/archive`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.report.archive', { id }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.delete(`${prefix}/:id`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction(
        'rasid.mod.reports.report.delete', { id }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  // ═══════════════════════════════════════
  // Report Execution (simulated)
  // ═══════════════════════════════════════

  app.post(`${prefix}/:id/execute`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const body = (request.body || {}) as Record<string, unknown>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.report.execute', { report_id: id, ...body }, ctx, sql,
      );
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.get(`${prefix}/:id/runs`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.run.list', { report_id: id }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) {
      return handleError(err, request, reply);
    }
  });

  app.get(`${prefix}/runs/:runId`, async (request, reply) => {
    try {
      const sql = getSql(request);
      const ctx = buildRequestContext(request);
      const { runId } = request.params as { runId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.reports.run.get', { id: runId }, ctx, sql,
      );
      if (!result.data) return reply.status(404).send({ error: 'Run not found' });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
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

/**
 * DPC — Fastify Routes
 *
 * All routes go through K3 (executeAction) and K4 (policy).
 * No direct DB access. No external calls.
 * Pattern matches M27/M28 (observability/backup).
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
  if (err instanceof PermissionDeniedError) return reply.status(403).send({ error: { code: 'PERMISSION_DENIED', message: err.message }, meta: meta(request.id as string) });
  if (err instanceof NotFoundError) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: err.message }, meta: meta(request.id as string) });
  if (err instanceof ValidationError) return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: err.message }, meta: meta(request.id as string) });
  if (err instanceof ZodError) return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: err.errors.map(e => e.message).join('; ') }, meta: meta(request.id as string) });
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (message.includes('not found')) return reply.status(404).send({ error: { code: 'NOT_FOUND', message }, meta: meta(request.id as string) });
  request.log.error(err);
  return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message }, meta: meta(request.id as string) });
}

const MOD = 'rasid.tierx.dpc';

export async function dpcRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  /* ═══════════════════ Node Pool ═══════════════════ */
  app.post('/api/v1/dpc/pools', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.pool.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/pools', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.pool.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/pools/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.pool.get`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node pool not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.patch('/api/v1/dpc/pools/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.pool.update`, { id: (request.params as any).id, ...(request.body as any) }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node pool not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.delete('/api/v1/dpc/pools/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.pool.delete`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node pool not found' }, meta: meta(request.id as string) });
      return reply.status(204).send();
    } catch (e) { return handleError(e, request, reply); }
  });

  /* ═══════════════════ Resource Quota ═══════════════════ */
  app.post('/api/v1/dpc/quotas', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.quota.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/quotas', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.quota.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/quotas/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.quota.get`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Resource quota not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.patch('/api/v1/dpc/quotas/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.quota.update`, { id: (request.params as any).id, ...(request.body as any) }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Resource quota not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.delete('/api/v1/dpc/quotas/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.quota.delete`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Resource quota not found' }, meta: meta(request.id as string) });
      return reply.status(204).send();
    } catch (e) { return handleError(e, request, reply); }
  });

  /* ═══════════════════ Job Priority Tier ═══════════════════ */
  app.post('/api/v1/dpc/priorities', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.priority.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/priorities', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.priority.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/priorities/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.priority.get`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job priority tier not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.patch('/api/v1/dpc/priorities/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.priority.update`, { id: (request.params as any).id, ...(request.body as any) }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job priority tier not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.delete('/api/v1/dpc/priorities/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.priority.delete`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job priority tier not found' }, meta: meta(request.id as string) });
      return reply.status(204).send();
    } catch (e) { return handleError(e, request, reply); }
  });

  /* ═══════════════════ Module Slot ═══════════════════ */
  app.post('/api/v1/dpc/modules', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.slot.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/modules', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.slot.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/modules/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.slot.get`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Module slot not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.patch('/api/v1/dpc/modules/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.slot.update`, { id: (request.params as any).id, ...(request.body as any) }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Module slot not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.delete('/api/v1/dpc/modules/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.slot.delete`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Module slot not found' }, meta: meta(request.id as string) });
      return reply.status(204).send();
    } catch (e) { return handleError(e, request, reply); }
  });

  /* ═══════════════════ Capacity Snapshot ═══════════════════ */
  app.post('/api/v1/dpc/capacity', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.capacity.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/capacity', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.capacity.list`, { pool_id: (request.query as any).pool_id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });

  app.get('/api/v1/dpc/capacity/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.capacity.get`, { id: (request.params as any).id }, ctx, sql);
      if (!result.data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capacity snapshot not found' }, meta: meta(request.id as string) });
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (e) { return handleError(e, request, reply); }
  });
}

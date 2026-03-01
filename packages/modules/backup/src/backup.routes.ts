/**
 * M28 Backup & Recovery — Routes (Metadata Only)
 *
 * ALL endpoints go through K3 actionRegistry.executeAction() for RBAC.
 * Schema: mod_backup — no cross-schema queries.
 * No actual backup execution. Metadata records only.
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

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const MOD = 'rasid.mod.backup';

  /* ── Retention Policies ── */
  app.get('/api/v1/backup/policies', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.policy.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.get('/api/v1/backup/policies/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.policy.get`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.post('/api/v1/backup/policies', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.policy.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.patch('/api/v1/backup/policies/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.policy.update`, { ...(request.body as any), id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.delete('/api/v1/backup/policies/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.policy.delete`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  /* ── Backup Jobs ── */
  app.get('/api/v1/backup/jobs', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.job.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.get('/api/v1/backup/jobs/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.job.get`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.post('/api/v1/backup/jobs', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.job.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.patch('/api/v1/backup/jobs/:id/status', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.job.updateStatus`, { ...(request.body as any), id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.delete('/api/v1/backup/jobs/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.job.delete`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  /* ── Restore Points ── */
  app.get('/api/v1/backup/restores', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.restore.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.get('/api/v1/backup/restores/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.restore.get`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.post('/api/v1/backup/restores', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.restore.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.patch('/api/v1/backup/restores/:id/status', async (request, reply) => {
    try {
      const sql = (request as any).sql;
      const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${MOD}.restore.updateStatus`, { ...(request.body as any), id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
}

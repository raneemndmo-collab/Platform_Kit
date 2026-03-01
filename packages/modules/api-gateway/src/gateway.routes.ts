/**
 * M29 API Gateway Hardening — Routes (Metadata Only)
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

export async function gatewayRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const M = 'rasid.mod.gateway';

  /* ── API Keys ── */
  app.get('/api/v1/gateway/api-keys', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.apikey.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.get('/api/v1/gateway/api-keys/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.apikey.get`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.post('/api/v1/gateway/api-keys', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.apikey.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.patch('/api/v1/gateway/api-keys/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.apikey.update`, { ...(request.body as any), id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.delete('/api/v1/gateway/api-keys/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.apikey.delete`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  /* ── IP Allowlist ── */
  app.get('/api/v1/gateway/ip-allowlist', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.ip.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.post('/api/v1/gateway/ip-allowlist', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.ip.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.patch('/api/v1/gateway/ip-allowlist/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.ip.update`, { ...(request.body as any), id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.delete('/api/v1/gateway/ip-allowlist/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.ip.delete`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });

  /* ── Rate Limits ── */
  app.get('/api/v1/gateway/rate-limits', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.ratelimit.list`, request.query as any, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.post('/api/v1/gateway/rate-limits', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.ratelimit.create`, request.body as any, ctx, sql);
      return reply.status(201).send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.patch('/api/v1/gateway/rate-limits/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.ratelimit.update`, { ...(request.body as any), id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
  app.delete('/api/v1/gateway/rate-limits/:id', async (request, reply) => {
    try {
      const sql = (request as any).sql; const ctx = buildRequestContext(request);
      const result = await actionRegistry.executeAction(`${M}.ratelimit.delete`, { id: (request.params as any).id }, ctx, sql);
      return reply.send({ data: result.data, meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }) });
    } catch (e) { return handleError(e, request, reply); }
  });
}

/**
 * M32 Developer Portal — Routes (Metadata Only)
 * No external SDK publishing. No OpenAPI runtime generator. No Swagger UI.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  actionRegistry, authMiddleware, tenantMiddleware, tenantCleanup, buildRequestContext,
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

export async function portalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const M = 'rasid.mod.portal';

  /* ── Portal API Keys ── */
  app.get('/api/v1/portal/keys', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/portal/keys/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/portal/keys', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/portal/keys/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/portal/keys/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Usage Logs ── */
  app.get('/api/v1/portal/usage', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.usage.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/portal/usage', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.usage.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Doc Pages ── */
  app.get('/api/v1/portal/docs', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.doc.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/portal/docs/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.doc.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/portal/docs', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.doc.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/portal/docs/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.doc.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/portal/docs/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.doc.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Webhooks ── */
  app.get('/api/v1/portal/webhooks', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.webhook.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/portal/webhooks/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.webhook.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/portal/webhooks', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.webhook.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/portal/webhooks/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.webhook.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/portal/webhooks/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.webhook.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
}

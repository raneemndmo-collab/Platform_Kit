/**
 * M30 Billing / Licensing — Routes (Metadata Only)
 * No payment gateway. No invoice engine.
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

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const M = 'rasid.mod.billing';

  /* ── Plans ── */
  app.get('/api/v1/billing/plans', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.plan.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/billing/plans/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.plan.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/billing/plans', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.plan.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/billing/plans/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.plan.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/billing/plans/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.plan.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Feature Flags ── */
  app.get('/api/v1/billing/flags', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.flag.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/billing/flags/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.flag.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/billing/flags', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.flag.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/billing/flags/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.flag.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/billing/flags/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.flag.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Usage Records ── */
  app.get('/api/v1/billing/usage', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.usage.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/billing/usage', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.usage.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Quota Configs ── */
  app.get('/api/v1/billing/quotas', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.quota.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/billing/quotas/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.quota.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/billing/quotas', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.quota.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/billing/quotas/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.quota.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/billing/quotas/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.quota.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Subscriptions ── */
  app.get('/api/v1/billing/subscriptions', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.subscription.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/billing/subscriptions/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.subscription.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/billing/subscriptions', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.subscription.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/billing/subscriptions/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.subscription.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
}

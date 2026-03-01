/**
 * M31 Localization — Routes (Metadata Only)
 * No runtime translation engine.
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

export async function localizationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const M = 'rasid.mod.l10n';

  /* ── Languages ── */
  app.get('/api/v1/l10n/languages', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.language.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/l10n/languages/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.language.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/l10n/languages', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.language.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/l10n/languages/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.language.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/l10n/languages/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.language.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Translation Keys ── */
  app.get('/api/v1/l10n/keys', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/l10n/keys/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/l10n/keys', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/l10n/keys/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/l10n/keys/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.key.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });

  /* ── Translations ── */
  app.get('/api/v1/l10n/translations', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.translation.list`, req.query as any, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.get('/api/v1/l10n/translations/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.translation.get`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.post('/api/v1/l10n/translations', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.translation.create`, req.body as any, ctx, sql); return reply.status(201).send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.patch('/api/v1/l10n/translations/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.translation.update`, { ...(req.body as any), id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
  app.delete('/api/v1/l10n/translations/:id', async (req, reply) => { try { const sql = (req as any).sql; const ctx = buildRequestContext(req); const r = await actionRegistry.executeAction(`${M}.translation.delete`, { id: (req.params as any).id }, ctx, sql); return reply.send({ data: r.data, meta: meta(req.id as string, { action_id: r.action_id, audit_id: r.audit_id }) }); } catch (e) { return handleError(e, req, reply); } });
}

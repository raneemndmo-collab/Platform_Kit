/**
 * M15 Forms Builder — Routes
 *
 * All operations go through K3 pipeline via executeAction.
 * No direct DB access. No email. No notification. No workflow.
 * Metadata-only form definitions + submission storage.
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

type TenantRequest = FastifyRequest & { sql: postgres.ReservedSql };

function getSql(request: FastifyRequest): postgres.ReservedSql {
  return (request as TenantRequest).sql;
}

function meta(requestId: string, extra?: Record<string, unknown>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

function handleError(err: any, request: FastifyRequest, reply: FastifyReply) {
  const rid = request.id as string;
  if (err.name === 'ValidationError') return reply.status(400).send({ error: err.message, meta: meta(rid) });
  if (err.message?.includes('not found')) return reply.status(404).send({ error: err.message, meta: meta(rid) });
  if (err.status === 403 || err.message?.includes('permission')) return reply.status(403).send({ error: err.message, meta: meta(rid) });
  return reply.status(500).send({ error: err.message || 'Internal error', meta: meta(rid) });
}

export async function formsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  const prefix = '/api/v1/forms';

  // ═══════════════════════════════════════
  // Form CRUD
  // ═══════════════════════════════════════

  app.post(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.form.create', request.body as object, ctx, sql,
      );
      return reply.status(201).send({ data: result.data, audit_id: result.audit_id, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.get(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.form.list', {}, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.get(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.form.get', { id }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.patch(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.form.update', { id, ...(request.body as object) }, ctx, sql,
      );
      return reply.send({ data: result.data, audit_id: result.audit_id, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.delete(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.form.delete', { id }, ctx, sql,
      );
      return reply.send({ data: result.data, audit_id: result.audit_id, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.post(`${prefix}/:id/publish`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.form.publish', { id }, ctx, sql,
      );
      return reply.send({ data: result.data, audit_id: result.audit_id, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.post(`${prefix}/:id/archive`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.form.archive', { id }, ctx, sql,
      );
      return reply.send({ data: result.data, audit_id: result.audit_id, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  // ═══════════════════════════════════════
  // Submission CRUD
  // ═══════════════════════════════════════

  app.post(`${prefix}/:id/submissions`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.submission.create', { form_id: id, ...(request.body as object) }, ctx, sql,
      );
      return reply.status(201).send({ data: result.data, audit_id: result.audit_id, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.get(`${prefix}/:id/submissions`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.submission.list', { form_id: id }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.get(`${prefix}/:id/submissions/:submissionId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, submissionId } = request.params as { id: string; submissionId: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.submission.get', { form_id: id, submission_id: submissionId }, ctx, sql,
      );
      return reply.send({ data: result.data, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });

  app.delete(`${prefix}/:id/submissions/:submissionId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, submissionId } = request.params as { id: string; submissionId: string };
      const ctx = buildRequestContext(request);
      const sql = getSql(request);
      const result = await actionRegistry.executeAction(
        'rasid.mod.forms.submission.delete', { form_id: id, submission_id: submissionId }, ctx, sql,
      );
      return reply.send({ data: result.data, audit_id: result.audit_id, meta: meta(request.id as string) });
    } catch (err: any) { return handleError(err, request, reply); }
  });
}

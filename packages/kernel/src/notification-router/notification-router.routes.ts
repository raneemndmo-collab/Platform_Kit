/** K10 — Notification Router routes (Phase 1)
 *
 * OPT-12 compliant: ALL mutations go through K3.executeAction().
 * READ operations call service directly (no mutation = no pipeline).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type postgres from 'postgres';
import { NotificationRouterService } from './notification-router.service.js';
import { actionRegistry } from '../action-registry/action-registry.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware, tenantCleanup } from '../middleware/tenant.middleware.js';
import { buildRequestContext } from '../middleware/request-context.js';
import {
  createChannelSchema,
  updateChannelSchema,
  createTemplateSchema,
  updateTemplateSchema,
  sendNotificationSchema,
  markNotificationSchema,
  upsertPreferenceSchema,
} from './notification-router.schema.js';
import type {
  CreateChannelInput,
  UpdateChannelInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  SendNotificationInput,
  UpdatePreferenceInput,
} from './notification-router.types.js';
import {
  PlatformError,
  NotFoundError,
  ValidationError,
  PermissionDeniedError,
  ConflictError,
} from '@rasid/shared';

function meta(requestId: string, extra?: Record<string, string>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

/** Centralized error handler — same pattern as object-model */
function handleError(
  err: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): ReturnType<typeof reply.send> {
  if (err instanceof PermissionDeniedError) {
    return reply.status(403).send({
      error: { code: 'PERMISSION_DENIED', message: err.message, details: err.details },
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
  if (err instanceof ConflictError) {
    return reply.status(409).send({
      error: { code: 'CONFLICT', message: err.message },
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

export async function notificationRouterRoutes(app: FastifyInstance): Promise<void> {
  const service = new NotificationRouterService();

  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ═══════════════════════════════════════════════
  // ─── Channel Routes (MUTATIONS via K3 pipeline) ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/notifications/channels — Create (via K3)
  app.post('/api/v1/notifications/channels', {
    schema: createChannelSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as CreateChannelInput;
      const result = await actionRegistry.executeAction(
        'rasid.core.notification.channel.create',
        input,
        ctx,
        sql,
      );
      return reply.status(201).send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/notifications/channels/:id — Update (via K3)
  app.patch('/api/v1/notifications/channels/:id', {
    schema: updateChannelSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const body = request.body as UpdateChannelInput;
      const result = await actionRegistry.executeAction(
        'rasid.core.notification.channel.update',
        { id, ...body },
        ctx,
        sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/notifications/channels/:id — Delete (via K3)
  app.delete('/api/v1/notifications/channels/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction(
        'rasid.core.notification.channel.delete',
        { id },
        ctx,
        sql,
      );
      return reply.status(204).send();
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ─── Channel READ routes (no K3 pipeline — reads don't mutate) ───

  // GET /api/v1/notifications/channels
  app.get('/api/v1/notifications/channels', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const query = request.query as { channel_type?: string };
      const channels = await service.listChannels(reqSql, ctx.tenantId, query.channel_type);
      return reply.send({ data: channels, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/notifications/channels/:id
  app.get('/api/v1/notifications/channels/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const channel = await service.getChannel(reqSql, id);
      if (!channel) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Channel not found' },
          meta: meta(request.id as string),
        });
      }
      return reply.send({ data: channel, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Template Routes (MUTATIONS via K3 pipeline) ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/notifications/templates — Create (via K3)
  app.post('/api/v1/notifications/templates', {
    schema: createTemplateSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as CreateTemplateInput;
      const result = await actionRegistry.executeAction(
        'rasid.core.notification.template.create',
        input,
        ctx,
        sql,
      );
      return reply.status(201).send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/notifications/templates/:id — Update (via K3)
  app.patch('/api/v1/notifications/templates/:id', {
    schema: updateTemplateSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const body = request.body as UpdateTemplateInput;
      const result = await actionRegistry.executeAction(
        'rasid.core.notification.template.update',
        { id, ...body },
        ctx,
        sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/notifications/templates/:id — Delete (via K3)
  app.delete('/api/v1/notifications/templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction(
        'rasid.core.notification.template.delete',
        { id },
        ctx,
        sql,
      );
      return reply.status(204).send();
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ─── Template READ routes (no K3 pipeline) ───

  // GET /api/v1/notifications/templates
  app.get('/api/v1/notifications/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const query = request.query as { channel_type?: string };
      const templates = await service.listTemplates(reqSql, ctx.tenantId, query.channel_type);
      return reply.send({ data: templates, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/notifications/templates/:id
  app.get('/api/v1/notifications/templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const template = await service.getTemplate(reqSql, id);
      if (!template) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Template not found' },
          meta: meta(request.id as string),
        });
      }
      return reply.send({ data: template, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Notification Routes (MUTATIONS via K3 pipeline) ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/notifications/send — Send (via K3)
  app.post('/api/v1/notifications/send', {
    schema: sendNotificationSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as SendNotificationInput;
      const result = await actionRegistry.executeAction(
        'rasid.core.notification.send',
        input,
        ctx,
        sql,
      );
      return reply.status(201).send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/notifications/:id/status — Mark status (via K3)
  app.patch('/api/v1/notifications/:id/status', {
    schema: markNotificationSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: 'delivered' | 'failed' };
      const result = await actionRegistry.executeAction(
        'rasid.core.notification.mark',
        { id, status },
        ctx,
        sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ─── Notification READ routes (no K3 pipeline) ───

  // GET /api/v1/notifications
  app.get('/api/v1/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const query = request.query as { recipient_id?: string };
      const notifications = await service.listNotifications(reqSql, ctx.tenantId, query.recipient_id);
      return reply.send({ data: notifications, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/notifications/:id
  app.get('/api/v1/notifications/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const notification = await service.getNotification(reqSql, id);
      if (!notification) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Notification not found' },
          meta: meta(request.id as string),
        });
      }
      return reply.send({ data: notification, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Preference Routes (MUTATION via K3 pipeline) ───
  // ═══════════════════════════════════════════════

  // PUT /api/v1/notifications/preferences — Upsert (via K3)
  app.put('/api/v1/notifications/preferences', {
    schema: upsertPreferenceSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as UpdatePreferenceInput;
      const result = await actionRegistry.executeAction(
        'rasid.core.notification.preference.upsert',
        input,
        ctx,
        sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, {
          action_id: result.action_id,
          audit_id: result.audit_id,
        }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ─── Preference READ route (no K3 pipeline) ───

  // GET /api/v1/notifications/preferences
  app.get('/api/v1/notifications/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const preferences = await service.getPreferences(reqSql, ctx.tenantId, ctx.userId);
      return reply.send({ data: preferences, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });
}

/** K10 — Notification Router routes (Phase 1) */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type postgres from 'postgres';
import { NotificationRouterService } from './notification-router.service.js';
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
import { NotFoundError, ConflictError } from '@rasid/shared';

interface TenantRequest extends FastifyRequest {
  sql: postgres.ReservedSql;
}

function errorResponse(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof NotFoundError) {
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message: err.message } });
  }
  if (err instanceof ConflictError) {
    return reply.status(409).send({ error: { code: 'CONFLICT', message: err.message } });
  }
  const msg = err instanceof Error ? err.message : 'Internal server error';
  return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: msg } });
}

export async function notificationRouterRoutes(app: FastifyInstance): Promise<void> {
  const service = new NotificationRouterService();

  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ═══════════════════════════════════════════════
  // ─── Channel Routes ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/notifications/channels
  app.post('/api/v1/notifications/channels', {
    schema: createChannelSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as CreateChannelInput;
      const channel = await service.createChannel(reqSql, ctx.tenantId, ctx.userId, input);
      return reply.status(201).send({ data: channel });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/notifications/channels
  app.get('/api/v1/notifications/channels', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const query = request.query as { channel_type?: string };
      const channels = await service.listChannels(reqSql, ctx.tenantId, query.channel_type);
      return reply.send({ data: channels });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/notifications/channels/:id
  app.get('/api/v1/notifications/channels/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const channel = await service.getChannel(reqSql, id);
      if (!channel) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });
      return reply.send({ data: channel });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // PATCH /api/v1/notifications/channels/:id
  app.patch('/api/v1/notifications/channels/:id', {
    schema: updateChannelSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as UpdateChannelInput;
      const channel = await service.updateChannel(reqSql, id, input);
      return reply.send({ data: channel });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // DELETE /api/v1/notifications/channels/:id
  app.delete('/api/v1/notifications/channels/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      await service.deleteChannel(reqSql, id);
      return reply.status(204).send();
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Template Routes ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/notifications/templates
  app.post('/api/v1/notifications/templates', {
    schema: createTemplateSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as CreateTemplateInput;
      const template = await service.createTemplate(reqSql, ctx.tenantId, ctx.userId, input);
      return reply.status(201).send({ data: template });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/notifications/templates
  app.get('/api/v1/notifications/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const query = request.query as { channel_type?: string };
      const templates = await service.listTemplates(reqSql, ctx.tenantId, query.channel_type);
      return reply.send({ data: templates });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/notifications/templates/:id
  app.get('/api/v1/notifications/templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const template = await service.getTemplate(reqSql, id);
      if (!template) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
      return reply.send({ data: template });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // PATCH /api/v1/notifications/templates/:id
  app.patch('/api/v1/notifications/templates/:id', {
    schema: updateTemplateSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as UpdateTemplateInput;
      const template = await service.updateTemplate(reqSql, id, input);
      return reply.send({ data: template });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // DELETE /api/v1/notifications/templates/:id
  app.delete('/api/v1/notifications/templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      await service.deleteTemplate(reqSql, id);
      return reply.status(204).send();
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Notification Routes ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/notifications/send
  app.post('/api/v1/notifications/send', {
    schema: sendNotificationSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as SendNotificationInput;
      const notification = await service.send(reqSql, ctx.tenantId, ctx.userId, input);
      return reply.status(201).send({ data: notification });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/notifications
  app.get('/api/v1/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const query = request.query as { recipient_id?: string };
      const notifications = await service.listNotifications(reqSql, ctx.tenantId, query.recipient_id);
      return reply.send({ data: notifications });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/notifications/:id
  app.get('/api/v1/notifications/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const notification = await service.getNotification(reqSql, id);
      if (!notification) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      return reply.send({ data: notification });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // PATCH /api/v1/notifications/:id/status
  app.patch('/api/v1/notifications/:id/status', {
    schema: markNotificationSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const { status } = request.body as { status: 'delivered' | 'failed' };
      const notification = await service.markAs(reqSql, id, status);
      return reply.send({ data: notification });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Preference Routes ───
  // ═══════════════════════════════════════════════

  // GET /api/v1/notifications/preferences
  app.get('/api/v1/notifications/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const preferences = await service.getPreferences(reqSql, ctx.tenantId, ctx.userId);
      return reply.send({ data: preferences });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // PUT /api/v1/notifications/preferences
  app.put('/api/v1/notifications/preferences', {
    schema: upsertPreferenceSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as UpdatePreferenceInput;
      const preference = await service.upsertPreference(reqSql, ctx.tenantId, ctx.userId, input);
      return reply.send({ data: preference });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });
}

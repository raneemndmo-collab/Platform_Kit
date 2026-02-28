/** K9 — Design System routes (Phase 1) */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type postgres from 'postgres';
import { DesignSystemService } from './design-system.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware, tenantCleanup } from '../middleware/tenant.middleware.js';
import { buildRequestContext } from '../middleware/request-context.js';
import {
  createTokenSchema,
  updateTokenSchema,
  createThemeSchema,
  updateThemeSchema,
  createComponentSchema,
  updateComponentSchema,
} from './design-system.schema.js';
import type {
  CreateTokenInput,
  UpdateTokenInput,
  CreateThemeInput,
  UpdateThemeInput,
  CreateComponentInput,
  UpdateComponentInput,
} from './design-system.types.js';
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

export async function designSystemRoutes(app: FastifyInstance): Promise<void> {
  const service = new DesignSystemService();

  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ═══════════════════════════════════════════════
  // ─── Token Routes ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/design/tokens
  app.post('/api/v1/design/tokens', {
    schema: createTokenSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as CreateTokenInput;
      const token = await service.createToken(reqSql, ctx.tenantId, ctx.userId, input);
      return reply.status(201).send({ data: token });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/design/tokens
  app.get('/api/v1/design/tokens', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const query = request.query as { category?: string };
      const tokens = await service.listTokens(reqSql, ctx.tenantId, query.category);
      return reply.send({ data: tokens });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/design/tokens/:id
  app.get('/api/v1/design/tokens/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const token = await service.getToken(reqSql, id);
      if (!token) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Token not found' } });
      return reply.send({ data: token });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // PATCH /api/v1/design/tokens/:id
  app.patch('/api/v1/design/tokens/:id', {
    schema: updateTokenSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as UpdateTokenInput;
      const token = await service.updateToken(reqSql, id, input);
      return reply.send({ data: token });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // DELETE /api/v1/design/tokens/:id
  app.delete('/api/v1/design/tokens/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      await service.deleteToken(reqSql, id);
      return reply.status(204).send();
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Theme Routes ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/design/themes
  app.post('/api/v1/design/themes', {
    schema: createThemeSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as CreateThemeInput;
      const theme = await service.createTheme(reqSql, ctx.tenantId, ctx.userId, input);
      return reply.status(201).send({ data: theme });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/design/themes
  app.get('/api/v1/design/themes', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const query = request.query as { status?: string };
      const themes = await service.listThemes(reqSql, ctx.tenantId, query.status);
      return reply.send({ data: themes });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/design/themes/:id
  app.get('/api/v1/design/themes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const theme = await service.getTheme(reqSql, id);
      if (!theme) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Theme not found' } });
      return reply.send({ data: theme });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/design/themes/:id/resolve
  app.get('/api/v1/design/themes/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const resolved = await service.resolveTheme(reqSql, ctx.tenantId, id);
      return reply.send({ data: resolved });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // PATCH /api/v1/design/themes/:id
  app.patch('/api/v1/design/themes/:id', {
    schema: updateThemeSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as UpdateThemeInput;
      const theme = await service.updateTheme(reqSql, id, input);
      return reply.send({ data: theme });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // DELETE /api/v1/design/themes/:id
  app.delete('/api/v1/design/themes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      await service.deleteTheme(reqSql, id);
      return reply.status(204).send();
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Component Routes ───
  // ═══════════════════════════════════════════════

  // POST /api/v1/design/components
  app.post('/api/v1/design/components', {
    schema: createComponentSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as CreateComponentInput;
      const component = await service.createComponent(reqSql, ctx.tenantId, ctx.userId, input);
      return reply.status(201).send({ data: component });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/design/components
  app.get('/api/v1/design/components', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const query = request.query as { category?: string };
      const components = await service.listComponents(reqSql, ctx.tenantId, query.category);
      return reply.send({ data: components });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // GET /api/v1/design/components/:id
  app.get('/api/v1/design/components/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const component = await service.getComponent(reqSql, id);
      if (!component) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Component not found' } });
      return reply.send({ data: component });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // PATCH /api/v1/design/components/:id
  app.patch('/api/v1/design/components/:id', {
    schema: updateComponentSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as UpdateComponentInput;
      const component = await service.updateComponent(reqSql, id, input);
      return reply.send({ data: component });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // DELETE /api/v1/design/components/:id
  app.delete('/api/v1/design/components/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      await service.deleteComponent(reqSql, id);
      return reply.status(204).send();
    } catch (err) {
      return errorResponse(reply, err);
    }
  });
}

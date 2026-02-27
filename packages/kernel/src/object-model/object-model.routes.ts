import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { objectModelService } from './object-model.service.js';
import { actionRegistry } from '../action-registry/action-registry.service.js';
import {
  createObjectSchema,
  updateObjectSchema,
  transitionObjectSchema,
  listObjectsSchema,
} from './object-model.schema.js';
import type { ObjectFilter } from './object-model.types.js';
import type { ObjectState } from '@rasid/shared';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware, tenantCleanup } from '../middleware/tenant.middleware.js';
import { buildRequestContext } from '../middleware/request-context.js';
import {
  PlatformError,
  NotFoundError,
  ValidationError,
  InvalidStateTransitionError,
  PermissionDeniedError,
} from '@rasid/shared';
import type postgres from 'postgres';

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return new Date(val).toISOString();
  return new Date().toISOString();
}

function meta(requestId: string, extra?: Record<string, string>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

function formatObject(obj: Record<string, unknown>) {
  return {
    id: obj.id,
    tenant_id: obj.tenant_id,
    type: obj.type,
    state: obj.state,
    version: obj.version,
    data: obj.data,
    created_by: obj.created_by,
    updated_by: obj.updated_by ?? null,
    created_at: toIso(obj.created_at),
    updated_at: toIso(obj.updated_at),
    deleted_at: obj.deleted_at ? toIso(obj.deleted_at) : null,
  };
}

/** Register all object model routes */
export async function objectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ── MUTATIONS via K3 pipeline (OPT-12) ──

  // POST /api/v1/objects — Create
  app.post(
    '/api/v1/objects',
    { schema: createObjectSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
        const ctx = buildRequestContext(request);
        const body = request.body as { type: string; data: Record<string, unknown> };
        const result = await actionRegistry.executeAction(
          'rasid.core.object.create',
          body,
          ctx,
          sql,
        );
        return reply.status(201).send({
          data: formatObject(result.data as Record<string, unknown>),
          meta: meta(request.id as string, {
            action_id: result.action_id,
            audit_id: result.audit_id,
          }),
        });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // PATCH /api/v1/objects/:id — Update
  app.patch(
    '/api/v1/objects/:id',
    { schema: updateObjectSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
        const ctx = buildRequestContext(request);
        const { id } = request.params as { id: string };
        const body = request.body as { data: Record<string, unknown> };
        const result = await actionRegistry.executeAction(
          'rasid.core.object.update',
          { id, data: body.data },
          ctx,
          sql,
        );
        return reply.send({
          data: formatObject(result.data as Record<string, unknown>),
          meta: meta(request.id as string, {
            action_id: result.action_id,
            audit_id: result.audit_id,
          }),
        });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // DELETE /api/v1/objects/:id — Soft-delete
  app.delete(
    '/api/v1/objects/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
        const ctx = buildRequestContext(request);
        const { id } = request.params as { id: string };
        await actionRegistry.executeAction(
          'rasid.core.object.delete',
          { id },
          ctx,
          sql,
        );
        return reply.status(204).send();
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // POST /api/v1/objects/:id/transition — Change state
  app.post(
    '/api/v1/objects/:id/transition',
    { schema: transitionObjectSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
        const ctx = buildRequestContext(request);
        const { id } = request.params as { id: string };
        const { state } = request.body as { state: ObjectState };
        const result = await actionRegistry.executeAction(
          'rasid.core.object.transition',
          { id, state },
          ctx,
          sql,
        );
        return reply.send({
          data: formatObject(result.data as Record<string, unknown>),
          meta: meta(request.id as string, {
            action_id: result.action_id,
            audit_id: result.audit_id,
          }),
        });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── READ operations (no K3 pipeline — reads don't mutate) ──

  // GET /api/v1/objects — List
  app.get(
    '/api/v1/objects',
    { schema: listObjectsSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
        const ctx = buildRequestContext(request);
        const query = request.query as {
          type?: string; state?: string; cursor?: string; limit?: string;
        };
        const filter: ObjectFilter = {
          type: query.type,
          state: query.state as ObjectState | undefined,
          cursor: query.cursor,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
        };
        const result = await objectModelService.listObjects(filter, ctx, sql);
        return reply.send({
          data: {
            items: result.items.map((o) => formatObject(o as unknown as Record<string, unknown>)),
            next_cursor: result.next_cursor,
            has_more: result.has_more,
          },
          meta: meta(request.id as string),
        });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // GET /api/v1/objects/:id — Get
  app.get(
    '/api/v1/objects/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
        const ctx = buildRequestContext(request);
        const { id } = request.params as { id: string };
        const obj = await objectModelService.getObject(id, ctx, sql);
        if (!obj) {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Object not found' },
            meta: meta(request.id as string),
          });
        }
        return reply.send({
          data: formatObject(obj as unknown as Record<string, unknown>),
          meta: meta(request.id as string),
        });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );
}

/** Centralized error handler */
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
  if (err instanceof InvalidStateTransitionError) {
    return reply.status(400).send({
      error: { code: 'INVALID_STATE_TRANSITION', message: err.message },
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

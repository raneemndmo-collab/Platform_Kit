/**
 * M13 — Custom Tables Routes
 *
 * OPT-12 compliant: ALL mutations go through K3.executeAction().
 * READ operations call service directly (no mutation = no pipeline).
 * Schema: mod_connectors
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type postgres from 'postgres';
import { CustomTablesService } from './custom-tables.service.js';
import {
  actionRegistry,
  authMiddleware,
  tenantMiddleware,
  tenantCleanup,
  buildRequestContext,
} from '../../../kernel/src/index.js';
import {
  createTableSchema,
  updateTableSchema,
  createRowSchema,
  updateRowSchema,
} from './custom-tables.schema.js';
import type {
  CreateCustomTableInput,
  UpdateCustomTableInput,
  CreateRowInput,
  UpdateRowInput,
} from './custom-tables.types.js';
import {
  PlatformError,
  NotFoundError,
  ValidationError,
  PermissionDeniedError,
} from '@rasid/shared';

function meta(requestId: string, extra?: Record<string, string>) {
  return { request_id: requestId, timestamp: new Date().toISOString(), ...extra };
}

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

export async function customTablesRoutes(app: FastifyInstance): Promise<void> {
  const service = new CustomTablesService();

  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  /* ═══════════════════════════════════════════
   * TABLE MUTATIONS (via K3 pipeline)
   * ═══════════════════════════════════════════ */

  // POST /api/v1/custom-tables
  app.post('/api/v1/custom-tables', {
    schema: createTableSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as CreateCustomTableInput;
      const result = await actionRegistry.executeAction(
        'rasid.mod.connectors.table.create', input, ctx, sql,
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

  // PATCH /api/v1/custom-tables/:id
  app.patch('/api/v1/custom-tables/:id', {
    schema: updateTableSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<UpdateCustomTableInput, 'id'>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.connectors.table.update', { id, ...body }, ctx, sql,
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

  // DELETE /api/v1/custom-tables/:id
  app.delete('/api/v1/custom-tables/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction(
        'rasid.mod.connectors.table.delete', { id }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  /* ═══════════════════════════════════════════
   * TABLE READS (no K3 pipeline)
   * ═══════════════════════════════════════════ */

  // GET /api/v1/custom-tables
  app.get('/api/v1/custom-tables', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const query = request.query as { status?: string };
      const tables = await service.listTables(reqSql, ctx.tenantId, query.status);
      return reply.send({ data: tables, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/custom-tables/:id
  app.get('/api/v1/custom-tables/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const table = await service.getTable(reqSql, id);
      if (!table) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Custom table not found' },
          meta: meta(request.id as string),
        });
      }
      return reply.send({ data: table, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  /* ═══════════════════════════════════════════
   * ROW MUTATIONS (via K3 pipeline)
   * ═══════════════════════════════════════════ */

  // POST /api/v1/custom-tables/:tableId/rows
  app.post('/api/v1/custom-tables/:tableId/rows', {
    schema: createRowSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { tableId } = request.params as { tableId: string };
      const body = request.body as { row_data: Record<string, unknown> };
      const input: CreateRowInput = { table_id: tableId, row_data: body.row_data };
      const result = await actionRegistry.executeAction(
        'rasid.mod.connectors.table.row.create', input, ctx, sql,
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

  // PATCH /api/v1/custom-tables/:tableId/rows/:rowId
  app.patch('/api/v1/custom-tables/:tableId/rows/:rowId', {
    schema: updateRowSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { tableId, rowId } = request.params as { tableId: string; rowId: string };
      const body = request.body as { row_data: Record<string, unknown> };
      const input: UpdateRowInput = { id: rowId, table_id: tableId, row_data: body.row_data };
      const result = await actionRegistry.executeAction(
        'rasid.mod.connectors.table.row.update', input, ctx, sql,
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

  // DELETE /api/v1/custom-tables/:tableId/rows/:rowId
  app.delete('/api/v1/custom-tables/:tableId/rows/:rowId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { rowId } = request.params as { rowId: string };
      await actionRegistry.executeAction(
        'rasid.mod.connectors.table.row.delete', { id: rowId }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  /* ═══════════════════════════════════════════
   * ROW READS (no K3 pipeline)
   * ═══════════════════════════════════════════ */

  // GET /api/v1/custom-tables/:tableId/rows
  app.get('/api/v1/custom-tables/:tableId/rows', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const { tableId } = request.params as { tableId: string };
      const query = request.query as { limit?: string; offset?: string };
      const rows = await service.listRows(
        reqSql, tableId,
        query.limit ? Number(query.limit) : undefined,
        query.offset ? Number(query.offset) : undefined,
      );
      return reply.send({ data: rows, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/custom-tables/:tableId/rows/:rowId
  app.get('/api/v1/custom-tables/:tableId/rows/:rowId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const { rowId } = request.params as { rowId: string };
      const row = await service.getRow(reqSql, rowId);
      if (!row) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Row not found' },
          meta: meta(request.id as string),
        });
      }
      return reply.send({ data: row, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });
}

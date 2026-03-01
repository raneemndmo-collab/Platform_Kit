/**
 * M8 SheetForge -- Routes
 *
 * ALL mutations go through K3.executeAction().
 * READ operations call service directly.
 * Schema: mod_sheetforge
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type postgres from 'postgres';
import { SheetForgeService } from './sheetforge.service.js';
import {
  actionRegistry,
  authMiddleware,
  tenantMiddleware,
  tenantCleanup,
  buildRequestContext,
} from '../../../kernel/src/index.js';
import {
  uploadLibrarySchema,
  updateLibrarySchema,
  createCompositionSchema,
  updateCompositionSchema,
  runGapAnalysisSchema,
} from './sheetforge.schema.js';
import type {
  UploadLibraryInput,
  UpdateLibraryInput,
  CreateCompositionInput,
  UpdateCompositionInput,
} from './sheetforge.types.js';
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
      error: { code: 'PERMISSION_DENIED', message: err.message, details: (err as PlatformError).details },
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

export async function sheetForgeRoutes(app: FastifyInstance): Promise<void> {
  const service = new SheetForgeService();

  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  /* ═══════════════════════════════════════════
   * LIBRARY MUTATIONS (via K3 pipeline)
   * ═══════════════════════════════════════════ */

  // POST /api/v1/sheetforge/libraries
  app.post('/api/v1/sheetforge/libraries', {
    schema: uploadLibrarySchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as UploadLibraryInput;
      const result = await actionRegistry.executeAction(
        'rasid.mod.sheetforge.library.upload', input, ctx, sql,
      );
      return reply.status(201).send({
        data: result.data,
        meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/sheetforge/libraries/:id/index
  app.post('/api/v1/sheetforge/libraries/:id/index', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.sheetforge.library.index', { id }, ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/sheetforge/libraries/:id
  app.patch('/api/v1/sheetforge/libraries/:id', {
    schema: updateLibrarySchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<UpdateLibraryInput, 'id'>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.sheetforge.library.update', { id, ...body }, ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/sheetforge/libraries/:id
  app.delete('/api/v1/sheetforge/libraries/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction(
        'rasid.mod.sheetforge.library.delete', { id }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  /* ═══════════════════════════════════════════
   * LIBRARY READS (no K3 pipeline)
   * ═══════════════════════════════════════════ */

  // GET /api/v1/sheetforge/libraries
  app.get('/api/v1/sheetforge/libraries', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const libraries = await service.listLibraries(reqSql, ctx.tenantId);
      return reply.send({ data: libraries, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/sheetforge/libraries/:id
  app.get('/api/v1/sheetforge/libraries/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const library = await service.getLibrary(reqSql, id);
      if (!library) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Library not found' },
          meta: meta(request.id as string),
        });
      }
      return reply.send({ data: library, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/sheetforge/libraries/:id/sheets
  app.get('/api/v1/sheetforge/libraries/:id/sheets', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const sheets = await service.getSheets(reqSql, id);
      return reply.send({ data: sheets, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  /* ═══════════════════════════════════════════
   * COMPOSITION MUTATIONS (via K3 pipeline)
   * ═══════════════════════════════════════════ */

  // POST /api/v1/sheetforge/compositions
  app.post('/api/v1/sheetforge/compositions', {
    schema: createCompositionSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const input = request.body as CreateCompositionInput;
      const result = await actionRegistry.executeAction(
        'rasid.mod.sheetforge.compose', input, ctx, sql,
      );
      return reply.status(201).send({
        data: result.data,
        meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/sheetforge/compositions/:id
  app.patch('/api/v1/sheetforge/compositions/:id', {
    schema: updateCompositionSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<UpdateCompositionInput, 'id'>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.sheetforge.compose.update', { id, ...body }, ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/sheetforge/compositions/:id
  app.delete('/api/v1/sheetforge/compositions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      await actionRegistry.executeAction(
        'rasid.mod.sheetforge.compose.delete', { id }, ctx, sql,
      );
      return reply.status(204).send();
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/sheetforge/compositions/:id/publish
  app.post('/api/v1/sheetforge/compositions/:id/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { id } = request.params as { id: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.sheetforge.publish', { id }, ctx, sql,
      );
      return reply.send({
        data: result.data,
        meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  /* ═══════════════════════════════════════════
   * COMPOSITION READS (no K3 pipeline)
   * ═══════════════════════════════════════════ */

  // GET /api/v1/sheetforge/compositions
  app.get('/api/v1/sheetforge/compositions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const compositions = await service.listCompositions(reqSql, ctx.tenantId);
      return reply.send({ data: compositions, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/sheetforge/compositions/:id
  app.get('/api/v1/sheetforge/compositions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const comp = await service.getComposition(reqSql, id);
      if (!comp) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Composition not found' },
          meta: meta(request.id as string),
        });
      }
      return reply.send({ data: comp, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  /* ═══════════════════════════════════════════
   * GAP ANALYSIS (via K3 pipeline for write, direct for read)
   * ═══════════════════════════════════════════ */

  // POST /api/v1/sheetforge/compositions/:compositionId/gap-analysis
  app.post('/api/v1/sheetforge/compositions/:compositionId/gap-analysis', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const ctx = buildRequestContext(request);
      const { compositionId } = request.params as { compositionId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.sheetforge.analyze', { composition_id: compositionId }, ctx, sql,
      );
      return reply.status(201).send({
        data: result.data,
        meta: meta(request.id as string, { action_id: result.action_id, audit_id: result.audit_id }),
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/sheetforge/compositions/:compositionId/gap-analysis
  app.get('/api/v1/sheetforge/compositions/:compositionId/gap-analysis', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { compositionId } = request.params as { compositionId: string };
      const reqSql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const gap = await service.getGapAnalysis(reqSql, compositionId);
      if (!gap) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Gap analysis not found' },
          meta: meta(request.id as string),
        });
      }
      return reply.send({ data: gap, meta: meta(request.id as string) });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });
}

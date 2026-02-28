/** K7 — Lineage Engine Routes (Phase 1)
 *
 * POST   /api/v1/lineage/edges          — Add an edge
 * DELETE /api/v1/lineage/edges          — Remove an edge
 * GET    /api/v1/lineage/:nodeId/upstream   — Get upstream nodes
 * GET    /api/v1/lineage/:nodeId/downstream — Get downstream nodes
 * GET    /api/v1/lineage/:nodeId/impact     — Get impact report
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { lineageService } from './lineage.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware, tenantCleanup } from '../middleware/tenant.middleware.js';
import { buildRequestContext } from '../middleware/request-context.js';
import { addEdgeSchema, removeEdgeSchema, traversalQuerySchema } from './lineage.schema.js';
import type { AddEdgeInput, RemoveEdgeInput } from './lineage.types.js';
import type postgres from 'postgres';

interface TenantRequest extends FastifyRequest {
  sql: postgres.ReservedSql;
}

function meta(requestId: string) {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

export async function lineageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // POST /api/v1/lineage/edges — Add an edge
  app.post(
    '/api/v1/lineage/edges',
    { schema: { body: addEdgeSchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ctx = buildRequestContext(request);
        const input = request.body as AddEdgeInput;
        const sql = (request as TenantRequest).sql;
        await lineageService.addEdge(input, ctx, sql);
        return reply.status(201).send({
          data: { message: 'Edge added' },
          meta: meta(request.id as string),
        });
      } catch (err) {
        const error = err as Error & { statusCode?: number };
        if (error.statusCode === 400) {
          return reply.status(400).send({
            error: { code: 'VALIDATION_ERROR', message: error.message },
            meta: meta(request.id as string),
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
          meta: meta(request.id as string),
        });
      }
    },
  );

  // DELETE /api/v1/lineage/edges — Remove an edge
  app.delete(
    '/api/v1/lineage/edges',
    { schema: { body: removeEdgeSchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ctx = buildRequestContext(request);
        const input = request.body as RemoveEdgeInput;
        const sql = (request as TenantRequest).sql;
        await lineageService.removeEdge(input, ctx, sql);
        return reply.status(204).send();
      } catch (err) {
        const error = err as Error & { statusCode?: number };
        if (error.statusCode === 404) {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: error.message },
            meta: meta(request.id as string),
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
          meta: meta(request.id as string),
        });
      }
    },
  );

  // GET /api/v1/lineage/:nodeId/upstream — Get upstream nodes
  app.get(
    '/api/v1/lineage/:nodeId/upstream',
    { schema: { querystring: traversalQuerySchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ctx = buildRequestContext(request);
        const { nodeId } = request.params as { nodeId: string };
        const query = request.query as { depth?: string };
        const depth = query.depth ? parseInt(query.depth, 10) : 5;
        const sql = (request as TenantRequest).sql;
        const nodes = await lineageService.getUpstream(nodeId, depth, ctx, sql);
        return reply.send({
          data: { items: nodes, node_id: nodeId, direction: 'upstream' },
          meta: meta(request.id as string),
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
          meta: meta(request.id as string),
        });
      }
    },
  );

  // GET /api/v1/lineage/:nodeId/downstream — Get downstream nodes
  app.get(
    '/api/v1/lineage/:nodeId/downstream',
    { schema: { querystring: traversalQuerySchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ctx = buildRequestContext(request);
        const { nodeId } = request.params as { nodeId: string };
        const query = request.query as { depth?: string };
        const depth = query.depth ? parseInt(query.depth, 10) : 5;
        const sql = (request as TenantRequest).sql;
        const nodes = await lineageService.getDownstream(nodeId, depth, ctx, sql);
        return reply.send({
          data: { items: nodes, node_id: nodeId, direction: 'downstream' },
          meta: meta(request.id as string),
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
          meta: meta(request.id as string),
        });
      }
    },
  );

  // GET /api/v1/lineage/:nodeId/impact — Get impact report
  app.get(
    '/api/v1/lineage/:nodeId/impact',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ctx = buildRequestContext(request);
        const { nodeId } = request.params as { nodeId: string };
        const sql = (request as TenantRequest).sql;
        const report = await lineageService.getImpact(nodeId, ctx, sql);
        return reply.send({
          data: report,
          meta: meta(request.id as string),
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
          meta: meta(request.id as string),
        });
      }
    },
  );
}

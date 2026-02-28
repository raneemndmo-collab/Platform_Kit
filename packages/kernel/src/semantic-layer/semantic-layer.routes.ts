/** K8 — Semantic Data Layer routes (Phase 1) */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type postgres from 'postgres';
import { SemanticLayerService } from './semantic-layer.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware, tenantCleanup } from '../middleware/tenant.middleware.js';
import { buildRequestContext } from '../middleware/request-context.js';
import {
  registerDatasetSchema,
  updateDatasetSchema,
  defineMetricSchema,
  semanticQuerySchema,
} from './semantic-layer.schema.js';
import type {
  RegisterDatasetInput,
  UpdateDatasetInput,
  DefineMetricInput,
  SemanticQueryInput,
} from './semantic-layer.types.js';
import { NotFoundError, ConflictError, ValidationError } from '@rasid/shared';

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
  if (err instanceof ValidationError) {
    return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: err.message } });
  }
  const msg = err instanceof Error ? err.message : 'Internal server error';
  return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: msg } });
}

export async function semanticLayerRoutes(app: FastifyInstance): Promise<void> {
  const service = new SemanticLayerService();

  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // ─── POST /api/v1/datasets ───
  app.post('/api/v1/datasets', {
    schema: registerDatasetSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as RegisterDatasetInput;
      const dataset = await service.registerDataset(reqSql, ctx.tenantId, ctx.userId, input);
      return reply.status(201).send({ data: dataset });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── GET /api/v1/datasets ───
  app.get('/api/v1/datasets', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const query = request.query as { status?: string };
      const datasets = await service.listDatasets(reqSql, ctx.tenantId, query.status);
      return reply.send({ data: datasets });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── GET /api/v1/datasets/:id ───
  app.get('/api/v1/datasets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const dataset = await service.getDataset(reqSql, id);
      if (!dataset) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Dataset not found' } });
      return reply.send({ data: dataset });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── GET /api/v1/datasets/:id/schema ───
  app.get('/api/v1/datasets/:id/schema', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const schema = await service.getSchema(reqSql, id);
      return reply.send({ data: schema });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── PATCH /api/v1/datasets/:id ───
  app.patch('/api/v1/datasets/:id', {
    schema: updateDatasetSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as UpdateDatasetInput;
      const dataset = await service.updateDataset(reqSql, id, input);
      return reply.send({ data: dataset });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── DELETE /api/v1/datasets/:id ───
  app.delete('/api/v1/datasets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      await service.deleteDataset(reqSql, id);
      return reply.status(204).send();
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── POST /api/v1/datasets/:id/metrics ───
  app.post('/api/v1/datasets/:id/metrics', {
    schema: defineMetricSchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: datasetId } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as DefineMetricInput;
      const metric = await service.defineMetric(reqSql, ctx.tenantId, ctx.userId, datasetId, input);
      return reply.status(201).send({ data: metric });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── GET /api/v1/datasets/:id/metrics ───
  app.get('/api/v1/datasets/:id/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: datasetId } = request.params as { id: string };
      const reqSql = (request as TenantRequest).sql;
      const metrics = await service.listMetrics(reqSql, datasetId);
      return reply.send({ data: metrics });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── DELETE /api/v1/datasets/:datasetId/metrics/:metricId ───
  app.delete('/api/v1/datasets/:datasetId/metrics/:metricId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { metricId } = request.params as { datasetId: string; metricId: string };
      const reqSql = (request as TenantRequest).sql;
      await service.deleteMetric(reqSql, metricId);
      return reply.status(204).send();
    } catch (err) {
      return errorResponse(reply, err);
    }
  });

  // ─── POST /api/v1/datasets/:id/query ───
  app.post('/api/v1/datasets/:id/query', {
    schema: semanticQuerySchema,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: datasetId } = request.params as { id: string };
      const ctx = buildRequestContext(request);
      const reqSql = (request as TenantRequest).sql;
      const input = request.body as SemanticQueryInput;
      const result = await service.query(reqSql, ctx.tenantId, datasetId, input);
      return reply.send({ data: result });
    } catch (err) {
      return errorResponse(reply, err);
    }
  });
}

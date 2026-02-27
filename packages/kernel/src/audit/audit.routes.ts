import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auditService } from './audit.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware, tenantCleanup } from '../middleware/tenant.middleware.js';
import { buildRequestContext } from '../middleware/request-context.js';
import type { AuditStatus } from '@rasid/shared';

function meta(requestId: string) {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

/** Audit routes — requires audit.read permission (enforced via K3 in future) */
export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  // GET /api/v1/audit — search audit records
  app.get(
    '/api/v1/audit',
    {
      schema: {
        querystring: {
          type: 'object' as const,
          properties: {
            actor_id: { type: 'string' as const },
            action_id: { type: 'string' as const },
            object_id: { type: 'string' as const },
            status: { type: 'string' as const, enum: ['success', 'failure'] },
            cursor: { type: 'string' as const },
            limit: { type: 'integer' as const, minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ctx = buildRequestContext(request);
        const query = request.query as {
          actor_id?: string;
          action_id?: string;
          object_id?: string;
          status?: string;
          cursor?: string;
          limit?: string;
        };
        const result = await auditService.search(
          {
            actor_id: query.actor_id,
            action_id: query.action_id,
            object_id: query.object_id,
            status: query.status as AuditStatus | undefined,
            cursor: query.cursor,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
          },
          ctx.tenantId,
        );
        return reply.send({ data: result, meta: meta(request.id as string) });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
          meta: meta(request.id as string),
        });
      }
    },
  );

  // GET /api/v1/audit/object/:objectId — audit trail for an object
  app.get(
    '/api/v1/audit/object/:objectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ctx = buildRequestContext(request);
        const { objectId } = request.params as { objectId: string };
        const records = await auditService.getByObjectId(objectId, ctx.tenantId);
        return reply.send({ data: { items: records }, meta: meta(request.id as string) });
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

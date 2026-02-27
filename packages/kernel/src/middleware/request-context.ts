import type { FastifyRequest } from 'fastify';
import type { RequestContext, JwtPayload } from '@rasid/shared';

/**
 * Build RequestContext from authenticated request.
 * userId and tenantId come from JWT (MT-2).
 */
export function buildRequestContext(request: FastifyRequest): RequestContext {
  const payload = (request as FastifyRequest & { jwtPayload: JwtPayload }).jwtPayload;
  return {
    userId: payload.sub,
    tenantId: payload.tid,
    sessionId: payload.sid,
    correlationId: request.id as string,
    ipAddress: request.ip || null,
  };
}

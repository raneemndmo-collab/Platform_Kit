import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '@rasid/shared';
import { appSql } from '../db/connection.js';
import type postgres from 'postgres';

interface TenantRequest extends FastifyRequest {
  jwtPayload: JwtPayload;
  sql: postgres.ReservedSql;
  _reserved: postgres.ReservedSql;
}

/**
 * Tenant middleware — P0.6.5 Transaction Wrapping Rule.
 * Opens a DB transaction, sets SET LOCAL app.current_tenant_id,
 * and commits/rollbacks based on response status.
 *
 * MT-2: tenant_id extracted from JWT, never from request body or URL.
 * MT-3: SET LOCAL ensures RLS sees the correct tenant.
 *
 * The cleanup (COMMIT/ROLLBACK + release) is done in tenantCleanup,
 * which must be registered as an onResponse hook on the Fastify instance.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const req = request as TenantRequest;
  const tenantId = req.jwtPayload.tid;

  // Reserve a connection from the pool for this request
  const reserved = await appSql.reserve();

  // Begin transaction and set tenant context
  await reserved`BEGIN`;
  await reserved`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;

  // Attach to request for use in handlers
  req.sql = reserved;
  req._reserved = reserved;
}

/**
 * Must be registered as onResponse hook on the Fastify instance
 * AFTER tenantMiddleware is registered as onRequest hook.
 */
export async function tenantCleanup(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const req = request as Partial<TenantRequest>;
  const reserved = req._reserved;
  if (!reserved) return;

  try {
    if (reply.statusCode >= 400) {
      await reserved`ROLLBACK`;
    } else {
      await reserved`COMMIT`;
    }
  } catch {
    try { await reserved`ROLLBACK`; } catch { /* ignore */ }
  } finally {
    req._reserved = undefined;
    reserved.release();
  }
}

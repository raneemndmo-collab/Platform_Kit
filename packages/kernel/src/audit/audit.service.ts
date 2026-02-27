import { v7 as uuidv7 } from 'uuid';
import { adminSql } from '../db/connection.js';
import type { IAuditEngine } from './audit.interface.js';
import type { AuditEntry, AuditRecord, AuditQuery } from './audit.types.js';
import type { PaginatedResult } from '@rasid/shared';
import type postgres from 'postgres';

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function toRecord(row: Record<string, unknown>): AuditRecord {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    actor_id: row.actor_id as string,
    actor_type: row.actor_type as string,
    action_id: row.action_id as string,
    object_id: (row.object_id as string) ?? null,
    object_type: (row.object_type as string) ?? null,
    status: row.status as string,
    payload_before: row.payload_before ?? null,
    payload_after: row.payload_after ?? null,
    error_message: (row.error_message as string) ?? null,
    ip_address: (row.ip_address as string) ?? null,
    session_id: (row.session_id as string) ?? null,
    correlation_id: row.correlation_id as string,
    created_at: toIso(row.created_at),
  };
}

/**
 * K6 Audit Engine.
 *
 * - record() can accept an optional SQL connection for in-transaction audit.
 *   Falls back to adminSql for separate-transaction audit (failure cases).
 * - search() and getByObjectId() use adminSql (BYPASSRLS) filtered by tenant_id.
 */
export class AuditService implements IAuditEngine {
  /**
   * Record an audit entry.
   * @param entry - The audit data
   * @param sql - Optional SQL connection (for in-transaction recording)
   */
  async record(
    entry: AuditEntry,
    sql?: postgres.ReservedSql | typeof adminSql,
  ): Promise<AuditRecord> {
    const conn = sql ?? adminSql;
    const id = uuidv7();

    const [row] = await conn`
      INSERT INTO kernel.audit_log (
        id, tenant_id, actor_id, actor_type, action_id,
        object_id, object_type, status,
        payload_before, payload_after, error_message,
        ip_address, session_id, correlation_id
      ) VALUES (
        ${id},
        ${entry.tenant_id},
        ${entry.actor_id},
        ${entry.actor_type},
        ${entry.action_id},
        ${entry.object_id},
        ${entry.object_type},
        ${entry.status},
        ${entry.payload_before ? JSON.stringify(entry.payload_before) : null},
        ${entry.payload_after ? JSON.stringify(entry.payload_after) : null},
        ${entry.error_message},
        ${entry.ip_address},
        ${entry.session_id},
        ${entry.correlation_id}
      )
      RETURNING *
    `;
    return toRecord(row as Record<string, unknown>);
  }

  /** Search audit records with filters and cursor pagination */
  async search(
    query: AuditQuery,
    tenantId: string,
  ): Promise<PaginatedResult<AuditRecord>> {
    const limit = Math.min(query.limit ?? 20, 100);

    const rows = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE tenant_id = ${tenantId}
        ${query.actor_id ? adminSql`AND actor_id = ${query.actor_id}` : adminSql``}
        ${query.action_id ? adminSql`AND action_id = ${query.action_id}` : adminSql``}
        ${query.object_id ? adminSql`AND object_id = ${query.object_id}` : adminSql``}
        ${query.status ? adminSql`AND status = ${query.status}` : adminSql``}
        ${query.cursor ? adminSql`AND id < ${query.cursor}` : adminSql``}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(
      (r) => toRecord(r as Record<string, unknown>),
    );
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    return { items, next_cursor: nextCursor, has_more: hasMore };
  }

  /** Get all audit records for a specific object */
  async getByObjectId(
    objectId: string,
    tenantId: string,
  ): Promise<AuditRecord[]> {
    const rows = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE tenant_id = ${tenantId} AND object_id = ${objectId}
      ORDER BY created_at ASC
    `;
    return rows.map((r) => toRecord(r as Record<string, unknown>));
  }
}

/** Singleton */
export const auditService = new AuditService();

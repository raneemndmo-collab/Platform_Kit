import type { AuditEntry, AuditRecord, AuditQuery } from './audit.types.js';
import type { PaginatedResult } from '@rasid/shared';

/** K6 Audit Engine — public contract */
export interface IAuditEngine {
  record(entry: AuditEntry): Promise<AuditRecord>;
  search(query: AuditQuery, tenantId: string): Promise<PaginatedResult<AuditRecord>>;
  getByObjectId(objectId: string, tenantId: string): Promise<AuditRecord[]>;
}

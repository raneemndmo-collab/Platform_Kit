import type { AuditStatus, ActorType } from '@rasid/shared';

/** Input for recording an audit entry */
export interface AuditEntry {
  tenant_id: string;
  actor_id: string;
  actor_type: ActorType;
  action_id: string;
  object_id: string | null;
  object_type: string | null;
  status: AuditStatus;
  payload_before: unknown | null;
  payload_after: unknown | null;
  error_message: string | null;
  ip_address: string | null;
  session_id: string | null;
  correlation_id: string;
}

/** Audit record as returned from the service */
export interface AuditRecord {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  action_id: string;
  object_id: string | null;
  object_type: string | null;
  status: string;
  payload_before: unknown | null;
  payload_after: unknown | null;
  error_message: string | null;
  ip_address: string | null;
  session_id: string | null;
  correlation_id: string;
  created_at: string;
}

/** Query for searching audit records */
export interface AuditQuery {
  actor_id?: string;
  action_id?: string;
  object_id?: string;
  status?: AuditStatus;
  cursor?: string;
  limit?: number;
}

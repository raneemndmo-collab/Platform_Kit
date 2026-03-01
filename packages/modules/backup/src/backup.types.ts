/**
 * M28 Backup & Recovery — Type Definitions (Metadata Only)
 *
 * Stores backup job metadata, retention policies, and status tracking.
 * No actual DB dump. No file system snapshot. No external storage.
 * No encryption key management. No external backup provider.
 * Schema: mod_backup — no cross-schema queries.
 */

/* ── Backup Job Status ── */
export type BackupJobStatus = 'pending' | 'completed' | 'failed';

/* ── Backup Target Type (logical only) ── */
export type BackupTargetType = 'full' | 'schema' | 'table' | 'tenant';

/* ── Retention Policy ── */
export interface RetentionPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  retention_days: number;
  max_backups: number;
  target_type: BackupTargetType;
  target_ref: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/* ── Backup Job (Metadata Only) ── */
export interface BackupJob {
  id: string;
  tenant_id: string;
  policy_id: string | null;
  label: string;
  target_type: BackupTargetType;
  target_ref: string | null;
  status: BackupJobStatus;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  created_by: string;
  created_at: Date;
}

/* ── Restore Point (Metadata Only) ── */
export interface RestorePoint {
  id: string;
  tenant_id: string;
  backup_job_id: string;
  label: string;
  status: BackupJobStatus;
  metadata: Record<string, unknown>;
  requested_by: string;
  requested_at: Date;
  completed_at: Date | null;
  error_message: string | null;
}

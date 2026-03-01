/**
 * M28 Backup & Recovery — Service Layer (Metadata Only)
 *
 * Stores backup job metadata, retention policies, and restore point records.
 * No actual DB dump. No file system snapshot. No external storage.
 * No encryption key management. No external backup provider.
 * Schema: mod_backup — no cross-schema queries.
 */
import type postgres from 'postgres';
import {
  createRetentionPolicySchema,
  updateRetentionPolicySchema,
  createBackupJobSchema,
  updateBackupJobStatusSchema,
  createRestorePointSchema,
  updateRestorePointStatusSchema,
  listBackupJobsSchema,
  listRetentionPoliciesSchema,
  listRestorePointsSchema,
  MAX_JOBS_PER_TENANT,
  MAX_POLICIES_PER_TENANT,
} from './backup.schema.js';
import { ValidationError, NotFoundError } from '@rasid/shared';

export class BackupService {
  /* ══════════════════════════════════════════
   *  Retention Policies
   * ══════════════════════════════════════════ */

  async listPolicies(sql: postgres.Sql, tenantId: string, input: unknown) {
    const filters = listRetentionPoliciesSchema.parse(input ?? {});
    const conditions: string[] = [];
    if (filters.is_active !== undefined) conditions.push(`is_active = ${filters.is_active}`);
    return sql`
      SELECT * FROM mod_backup.retention_policies
      WHERE tenant_id = ${tenantId}
      ${conditions.length ? sql`AND ${sql.unsafe(conditions.join(' AND '))}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${filters.limit} OFFSET ${filters.offset}`;
  }

  async getPolicy(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`
      SELECT * FROM mod_backup.retention_policies
      WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Retention policy not found');
    return rows[0];
  }

  async createPolicy(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createRetentionPolicySchema.parse(input);
    const [count] = await sql`
      SELECT count(*)::int AS c FROM mod_backup.retention_policies
      WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_POLICIES_PER_TENANT) {
      throw new ValidationError(`Maximum ${MAX_POLICIES_PER_TENANT} retention policies per tenant`);
    }
    const rows = await sql`
      INSERT INTO mod_backup.retention_policies
        (tenant_id, name, description, retention_days, max_backups, target_type, target_ref, is_active)
      VALUES
        (${tenantId}, ${data.name}, ${data.description ?? null}, ${data.retention_days},
         ${data.max_backups}, ${data.target_type}, ${data.target_ref ?? null}, ${data.is_active})
      RETURNING *`;
    return rows[0];
  }

  async updatePolicy(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateRetentionPolicySchema.parse(input);
    await this.getPolicy(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_backup.retention_policies
      SET name = COALESCE(${data.name ?? null}, name),
          description = COALESCE(${data.description ?? null}, description),
          retention_days = COALESCE(${data.retention_days ?? null}, retention_days),
          max_backups = COALESCE(${data.max_backups ?? null}, max_backups),
          target_type = COALESCE(${data.target_type ?? null}, target_type),
          target_ref = COALESCE(${data.target_ref ?? null}, target_ref),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deletePolicy(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getPolicy(sql, tenantId, id);
    await sql`DELETE FROM mod_backup.retention_policies WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Backup Jobs (Metadata Only)
   * ══════════════════════════════════════════ */

  async listJobs(sql: postgres.Sql, tenantId: string, input: unknown) {
    const filters = listBackupJobsSchema.parse(input ?? {});
    return sql`
      SELECT * FROM mod_backup.backup_jobs
      WHERE tenant_id = ${tenantId}
      ${filters.status ? sql`AND status = ${filters.status}` : sql``}
      ${filters.target_type ? sql`AND target_type = ${filters.target_type}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${filters.limit} OFFSET ${filters.offset}`;
  }

  async getJob(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`
      SELECT * FROM mod_backup.backup_jobs
      WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Backup job not found');
    return rows[0];
  }

  async createJob(sql: postgres.Sql, tenantId: string, userId: string, input: unknown) {
    const data = createBackupJobSchema.parse(input);
    const [count] = await sql`
      SELECT count(*)::int AS c FROM mod_backup.backup_jobs
      WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_JOBS_PER_TENANT) {
      throw new ValidationError(`Maximum ${MAX_JOBS_PER_TENANT} backup jobs per tenant`);
    }
    const rows = await sql`
      INSERT INTO mod_backup.backup_jobs
        (tenant_id, policy_id, label, target_type, target_ref, status, metadata, created_by)
      VALUES
        (${tenantId}, ${data.policy_id ?? null}, ${data.label}, ${data.target_type},
         ${data.target_ref ?? null}, 'pending', ${JSON.stringify(data.metadata ?? {})}, ${userId})
      RETURNING *`;
    return rows[0];
  }

  async updateJobStatus(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateBackupJobStatusSchema.parse(input);
    await this.getJob(sql, tenantId, id);
    const setCompleted = data.status === 'completed' || data.status === 'failed';
    const rows = await sql`
      UPDATE mod_backup.backup_jobs
      SET status = ${data.status},
          size_bytes = COALESCE(${data.size_bytes ?? null}, size_bytes),
          error_message = COALESCE(${data.error_message ?? null}, error_message),
          completed_at = ${setCompleted ? sql`now()` : sql`completed_at`}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteJob(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getJob(sql, tenantId, id);
    await sql`DELETE FROM mod_backup.backup_jobs WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Restore Points (Metadata Only)
   * ══════════════════════════════════════════ */

  async listRestorePoints(sql: postgres.Sql, tenantId: string, input: unknown) {
    const filters = listRestorePointsSchema.parse(input ?? {});
    return sql`
      SELECT * FROM mod_backup.restore_points
      WHERE tenant_id = ${tenantId}
      ${filters.backup_job_id ? sql`AND backup_job_id = ${filters.backup_job_id}` : sql``}
      ${filters.status ? sql`AND status = ${filters.status}` : sql``}
      ORDER BY requested_at DESC
      LIMIT ${filters.limit} OFFSET ${filters.offset}`;
  }

  async getRestorePoint(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`
      SELECT * FROM mod_backup.restore_points
      WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Restore point not found');
    return rows[0];
  }

  async createRestorePoint(sql: postgres.Sql, tenantId: string, userId: string, input: unknown) {
    const data = createRestorePointSchema.parse(input);
    const rows = await sql`
      INSERT INTO mod_backup.restore_points
        (tenant_id, backup_job_id, label, status, metadata, requested_by)
      VALUES
        (${tenantId}, ${data.backup_job_id}, ${data.label}, 'pending',
         ${JSON.stringify(data.metadata ?? {})}, ${userId})
      RETURNING *`;
    return rows[0];
  }

  async updateRestorePointStatus(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateRestorePointStatusSchema.parse(input);
    await this.getRestorePoint(sql, tenantId, id);
    const setCompleted = data.status === 'completed' || data.status === 'failed';
    const rows = await sql`
      UPDATE mod_backup.restore_points
      SET status = ${data.status},
          error_message = COALESCE(${data.error_message ?? null}, error_message),
          completed_at = ${setCompleted ? sql`now()` : sql`completed_at`}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }
}

/**
 * M28 Backup & Recovery — Zod Validation Schemas
 *
 * Validates all inputs before they reach the service layer.
 * Metadata only — no actual backup payloads.
 */
import { z } from 'zod';

/* ── Constants ── */
export const MAX_METADATA_BYTES = 8192;
export const MAX_JOBS_PER_TENANT = 1000;
export const MAX_POLICIES_PER_TENANT = 50;

/* ── Enums ── */
const backupJobStatusEnum = z.enum(['pending', 'completed', 'failed']);
const backupTargetTypeEnum = z.enum(['full', 'schema', 'table', 'tenant']);

/* ── Retention Policy Schemas ── */
export const createRetentionPolicySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  retention_days: z.number().int().min(1).max(3650),
  max_backups: z.number().int().min(1).max(1000),
  target_type: backupTargetTypeEnum,
  target_ref: z.string().max(255).nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateRetentionPolicySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
  max_backups: z.number().int().min(1).max(1000).optional(),
  target_type: backupTargetTypeEnum.optional(),
  target_ref: z.string().max(255).nullable().optional(),
  is_active: z.boolean().optional(),
});

/* ── Backup Job Schemas ── */
export const createBackupJobSchema = z.object({
  policy_id: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(255),
  target_type: backupTargetTypeEnum,
  target_ref: z.string().max(255).nullable().optional(),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({})
    .refine(
      (v) => Buffer.byteLength(JSON.stringify(v), 'utf-8') <= MAX_METADATA_BYTES,
      { message: `metadata must not exceed ${MAX_METADATA_BYTES} bytes` },
    ),
});

export const updateBackupJobStatusSchema = z.object({
  status: backupJobStatusEnum,
  size_bytes: z.number().int().min(0).nullable().optional(),
  error_message: z.string().max(2000).nullable().optional(),
});

/* ── Restore Point Schemas ── */
export const createRestorePointSchema = z.object({
  backup_job_id: z.string().uuid(),
  label: z.string().min(1).max(255),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({})
    .refine(
      (v) => Buffer.byteLength(JSON.stringify(v), 'utf-8') <= MAX_METADATA_BYTES,
      { message: `metadata must not exceed ${MAX_METADATA_BYTES} bytes` },
    ),
});

export const updateRestorePointStatusSchema = z.object({
  status: backupJobStatusEnum,
  error_message: z.string().max(2000).nullable().optional(),
});

/* ── List Filters ── */
export const listBackupJobsSchema = z.object({
  status: backupJobStatusEnum.optional(),
  target_type: backupTargetTypeEnum.optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const listRetentionPoliciesSchema = z.object({
  is_active: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const listRestorePointsSchema = z.object({
  backup_job_id: z.string().uuid().optional(),
  status: backupJobStatusEnum.optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

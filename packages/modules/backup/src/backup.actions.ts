/**
 * M28 Backup & Recovery — K3 Action Registration (Metadata Only)
 * Schema: mod_backup — no cross-schema queries.
 * No actual backup execution. Metadata records only.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { BackupService } from './backup.service.js';

const svc = new BackupService();
const MOD = 'rasid.mod.backup';
const MID = 'mod_backup';
const S = { type: 'object', properties: {} } as Record<string, unknown>;

export function registerBackupActions(): void {
  /* ── Retention Policies ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.policy.list`, display_name: 'List Retention Policies', module_id: MID, resource: 'backup_policies', verb: 'read', sensitivity: 'standard', required_permissions: ['backup_policies.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listPolicies(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.policy.get`, display_name: 'Get Retention Policy', module_id: MID, resource: 'backup_policies', verb: 'read', sensitivity: 'standard', required_permissions: ['backup_policies.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getPolicy(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'backup_policy' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.policy.create`, display_name: 'Create Retention Policy', module_id: MID, resource: 'backup_policies', verb: 'create', sensitivity: 'standard', required_permissions: ['backup_policies.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createPolicy(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'backup_policy', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.policy.update`, display_name: 'Update Retention Policy', module_id: MID, resource: 'backup_policies', verb: 'update', sensitivity: 'standard', required_permissions: ['backup_policies.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updatePolicy(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'backup_policy', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.policy.delete`, display_name: 'Delete Retention Policy', module_id: MID, resource: 'backup_policies', verb: 'delete', sensitivity: 'critical', required_permissions: ['backup_policies.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deletePolicy(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'backup_policy' }; },
  );

  /* ── Backup Jobs ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.job.list`, display_name: 'List Backup Jobs', module_id: MID, resource: 'backup_jobs', verb: 'read', sensitivity: 'standard', required_permissions: ['backup_jobs.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listJobs(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.job.get`, display_name: 'Get Backup Job', module_id: MID, resource: 'backup_jobs', verb: 'read', sensitivity: 'standard', required_permissions: ['backup_jobs.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getJob(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'backup_job' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.job.create`, display_name: 'Create Backup Job', module_id: MID, resource: 'backup_jobs', verb: 'create', sensitivity: 'standard', required_permissions: ['backup_jobs.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createJob(sql, ctx.tenantId, ctx.userId, input); return { data, object_id: data.id, object_type: 'backup_job', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.job.updateStatus`, display_name: 'Update Backup Job Status', module_id: MID, resource: 'backup_jobs', verb: 'update', sensitivity: 'standard', required_permissions: ['backup_jobs.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateJobStatus(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'backup_job', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.job.delete`, display_name: 'Delete Backup Job', module_id: MID, resource: 'backup_jobs', verb: 'delete', sensitivity: 'critical', required_permissions: ['backup_jobs.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteJob(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'backup_job' }; },
  );

  /* ── Restore Points ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.restore.list`, display_name: 'List Restore Points', module_id: MID, resource: 'backup_restores', verb: 'read', sensitivity: 'standard', required_permissions: ['backup_restores.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listRestorePoints(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.restore.get`, display_name: 'Get Restore Point', module_id: MID, resource: 'backup_restores', verb: 'read', sensitivity: 'standard', required_permissions: ['backup_restores.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getRestorePoint(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'backup_restore' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.restore.create`, display_name: 'Create Restore Point', module_id: MID, resource: 'backup_restores', verb: 'create', sensitivity: 'standard', required_permissions: ['backup_restores.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createRestorePoint(sql, ctx.tenantId, ctx.userId, input); return { data, object_id: data.id, object_type: 'backup_restore', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.restore.updateStatus`, display_name: 'Update Restore Point Status', module_id: MID, resource: 'backup_restores', verb: 'update', sensitivity: 'standard', required_permissions: ['backup_restores.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateRestorePointStatus(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'backup_restore', after: data }; },
  );
}

/**
 * DPC — Service Layer
 *
 * All DB operations use the RLS-scoped sql connection.
 * No cross-schema queries. No external calls.
 */
import crypto from 'node:crypto';
import type { Sql } from 'postgres';
import type {
  CreateNodePoolInput, UpdateNodePoolInput,
  CreateResourceQuotaInput, UpdateResourceQuotaInput,
  CreateJobPriorityTierInput, UpdateJobPriorityTierInput,
  CreateModuleSlotInput, UpdateModuleSlotInput,
  CreateCapacitySnapshotInput,
} from './dpc.types.js';

/* ═══════════════════════════════ Node Pool ═══════════════════════════════ */

export async function createNodePool(sql: Sql<any>, tenantId: string, data: CreateNodePoolInput) {
  const id = crypto.randomUUID();
  const [row] = await sql`
    INSERT INTO mod_dpc.node_pools (id, tenant_id, name, pool_type, min_nodes, max_nodes, current_nodes, cpu_per_node, memory_gb_per_node, gpu_per_node, labels)
    VALUES (${id}, ${tenantId}, ${data.name}, ${data.pool_type}, ${data.min_nodes}, ${data.max_nodes}, ${data.min_nodes}, ${data.cpu_per_node}, ${data.memory_gb_per_node}, ${data.gpu_per_node ?? 0}, ${JSON.stringify(data.labels ?? {})})
    RETURNING *
  `;
  return row;
}

export async function listNodePools(sql: Sql<any>) {
  return sql`SELECT * FROM mod_dpc.node_pools ORDER BY created_at DESC`;
}

export async function getNodePool(sql: Sql<any>, id: string) {
  const [row] = await sql`SELECT * FROM mod_dpc.node_pools WHERE id = ${id}`;
  return row ?? null;
}

export async function updateNodePool(sql: Sql<any>, id: string, data: UpdateNodePoolInput) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined)          { fields.push('name'); values.push(data.name); }
  if (data.status !== undefined)        { fields.push('status'); values.push(data.status); }
  if (data.min_nodes !== undefined)     { fields.push('min_nodes'); values.push(data.min_nodes); }
  if (data.max_nodes !== undefined)     { fields.push('max_nodes'); values.push(data.max_nodes); }
  if (data.current_nodes !== undefined) { fields.push('current_nodes'); values.push(data.current_nodes); }
  if (data.labels !== undefined)        { fields.push('labels'); values.push(JSON.stringify(data.labels)); }
  if (fields.length === 0) return getNodePool(sql, id);
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const query = `UPDATE mod_dpc.node_pools SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`;
  const [row] = await (sql as any).unsafe(query, [id, ...values]);
  return row ?? null;
}

export async function deleteNodePool(sql: Sql<any>, id: string) {
  const [row] = await sql`DELETE FROM mod_dpc.node_pools WHERE id = ${id} RETURNING id`;
  return row ?? null;
}

/* ═══════════════════════════════ Resource Quota ═══════════════════════════════ */

export async function createResourceQuota(sql: Sql<any>, tenantId: string, data: CreateResourceQuotaInput) {
  const id = crypto.randomUUID();
  const [row] = await sql`
    INSERT INTO mod_dpc.resource_quotas (id, tenant_id, scope, scope_ref, max_cpu, max_memory_gb, max_gpu, max_concurrent_jobs, description)
    VALUES (${id}, ${tenantId}, ${data.scope}, ${data.scope_ref}, ${data.max_cpu}, ${data.max_memory_gb}, ${data.max_gpu ?? 0}, ${data.max_concurrent_jobs}, ${data.description ?? ''})
    RETURNING *
  `;
  return row;
}

export async function listResourceQuotas(sql: Sql<any>) {
  return sql`SELECT * FROM mod_dpc.resource_quotas ORDER BY created_at DESC`;
}

export async function getResourceQuota(sql: Sql<any>, id: string) {
  const [row] = await sql`SELECT * FROM mod_dpc.resource_quotas WHERE id = ${id}`;
  return row ?? null;
}

export async function updateResourceQuota(sql: Sql<any>, id: string, data: UpdateResourceQuotaInput) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.max_cpu !== undefined)             { fields.push('max_cpu'); values.push(data.max_cpu); }
  if (data.max_memory_gb !== undefined)       { fields.push('max_memory_gb'); values.push(data.max_memory_gb); }
  if (data.max_gpu !== undefined)             { fields.push('max_gpu'); values.push(data.max_gpu); }
  if (data.max_concurrent_jobs !== undefined) { fields.push('max_concurrent_jobs'); values.push(data.max_concurrent_jobs); }
  if (data.description !== undefined)         { fields.push('description'); values.push(data.description); }
  if (fields.length === 0) return getResourceQuota(sql, id);
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const query = `UPDATE mod_dpc.resource_quotas SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`;
  const [row] = await (sql as any).unsafe(query, [id, ...values]);
  return row ?? null;
}

export async function deleteResourceQuota(sql: Sql<any>, id: string) {
  const [row] = await sql`DELETE FROM mod_dpc.resource_quotas WHERE id = ${id} RETURNING id`;
  return row ?? null;
}

/* ═══════════════════════════════ Job Priority Tier ═══════════════════════════════ */

export async function createJobPriorityTier(sql: Sql<any>, tenantId: string, data: CreateJobPriorityTierInput) {
  const id = crypto.randomUUID();
  const [row] = await sql`
    INSERT INTO mod_dpc.job_priority_tiers (id, tenant_id, level, name, max_queue_depth, timeout_seconds, concurrency_limit, backpressure_threshold, description)
    VALUES (${id}, ${tenantId}, ${data.level}, ${data.name}, ${data.max_queue_depth}, ${data.timeout_seconds}, ${data.concurrency_limit}, ${data.backpressure_threshold}, ${data.description ?? ''})
    RETURNING *
  `;
  return row;
}

export async function listJobPriorityTiers(sql: Sql<any>) {
  return sql`SELECT * FROM mod_dpc.job_priority_tiers ORDER BY level ASC`;
}

export async function getJobPriorityTier(sql: Sql<any>, id: string) {
  const [row] = await sql`SELECT * FROM mod_dpc.job_priority_tiers WHERE id = ${id}`;
  return row ?? null;
}

export async function updateJobPriorityTier(sql: Sql<any>, id: string, data: UpdateJobPriorityTierInput) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined)                    { fields.push('name'); values.push(data.name); }
  if (data.max_queue_depth !== undefined)          { fields.push('max_queue_depth'); values.push(data.max_queue_depth); }
  if (data.timeout_seconds !== undefined)          { fields.push('timeout_seconds'); values.push(data.timeout_seconds); }
  if (data.concurrency_limit !== undefined)        { fields.push('concurrency_limit'); values.push(data.concurrency_limit); }
  if (data.backpressure_threshold !== undefined)   { fields.push('backpressure_threshold'); values.push(data.backpressure_threshold); }
  if (data.description !== undefined)              { fields.push('description'); values.push(data.description); }
  if (fields.length === 0) return getJobPriorityTier(sql, id);
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const query = `UPDATE mod_dpc.job_priority_tiers SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`;
  const [row] = await (sql as any).unsafe(query, [id, ...values]);
  return row ?? null;
}

export async function deleteJobPriorityTier(sql: Sql<any>, id: string) {
  const [row] = await sql`DELETE FROM mod_dpc.job_priority_tiers WHERE id = ${id} RETURNING id`;
  return row ?? null;
}

/* ═══════════════════════════════ Module Slot ═══════════════════════════════ */

export async function createModuleSlot(sql: Sql<any>, tenantId: string, data: CreateModuleSlotInput) {
  const id = crypto.randomUUID();
  const [row] = await sql`
    INSERT INTO mod_dpc.module_slots (id, tenant_id, module_code, module_name, database_name, schema_name, pool_type, event_namespace, api_prefix, resource_quota_id, config)
    VALUES (${id}, ${tenantId}, ${data.module_code}, ${data.module_name}, ${data.database_name}, ${data.schema_name}, ${data.pool_type}, ${data.event_namespace}, ${data.api_prefix}, ${data.resource_quota_id ?? null}, ${JSON.stringify(data.config ?? {})})
    RETURNING *
  `;
  return row;
}

export async function listModuleSlots(sql: Sql<any>) {
  return sql`SELECT * FROM mod_dpc.module_slots ORDER BY module_code ASC`;
}

export async function getModuleSlot(sql: Sql<any>, id: string) {
  const [row] = await sql`SELECT * FROM mod_dpc.module_slots WHERE id = ${id}`;
  return row ?? null;
}

export async function updateModuleSlot(sql: Sql<any>, id: string, data: UpdateModuleSlotInput) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.status !== undefined)            { fields.push('status'); values.push(data.status); }
  if (data.resource_quota_id !== undefined) { fields.push('resource_quota_id'); values.push(data.resource_quota_id); }
  if (data.config !== undefined)            { fields.push('config'); values.push(JSON.stringify(data.config)); }
  if (fields.length === 0) return getModuleSlot(sql, id);
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const query = `UPDATE mod_dpc.module_slots SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`;
  const [row] = await (sql as any).unsafe(query, [id, ...values]);
  return row ?? null;
}

export async function deleteModuleSlot(sql: Sql<any>, id: string) {
  const [row] = await sql`DELETE FROM mod_dpc.module_slots WHERE id = ${id} RETURNING id`;
  return row ?? null;
}

/* ═══════════════════════════════ Capacity Snapshot ═══════════════════════════════ */

export async function createCapacitySnapshot(sql: Sql<any>, tenantId: string, data: CreateCapacitySnapshotInput) {
  const id = crypto.randomUUID();
  const [row] = await sql`
    INSERT INTO mod_dpc.capacity_snapshots (id, tenant_id, pool_id, total_cpu, used_cpu, total_memory_gb, used_memory_gb, total_gpu, used_gpu, active_jobs, queued_jobs)
    VALUES (${id}, ${tenantId}, ${data.pool_id}, ${data.total_cpu}, ${data.used_cpu}, ${data.total_memory_gb}, ${data.used_memory_gb}, ${data.total_gpu ?? 0}, ${data.used_gpu ?? 0}, ${data.active_jobs}, ${data.queued_jobs})
    RETURNING *
  `;
  return row;
}

export async function listCapacitySnapshots(sql: Sql<any>, poolId?: string) {
  if (poolId) {
    return sql`SELECT * FROM mod_dpc.capacity_snapshots WHERE pool_id = ${poolId} ORDER BY recorded_at DESC LIMIT 100`;
  }
  return sql`SELECT * FROM mod_dpc.capacity_snapshots ORDER BY recorded_at DESC LIMIT 100`;
}

export async function getCapacitySnapshot(sql: Sql<any>, id: string) {
  const [row] = await sql`SELECT * FROM mod_dpc.capacity_snapshots WHERE id = ${id}`;
  return row ?? null;
}

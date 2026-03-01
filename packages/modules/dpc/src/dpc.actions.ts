/**
 * DPC — K3 Action Registrations
 *
 * All writes via K3 pipeline. All policy via K4.
 * No cross-schema FK. No external calls.
 * Pattern: registerAction(manifest, async (input, ctx, sql) => ...)
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import * as svc from './dpc.service.js';
import {
  createNodePoolSchema, updateNodePoolSchema,
  createResourceQuotaSchema, updateResourceQuotaSchema,
  createJobPriorityTierSchema, updateJobPriorityTierSchema,
  createModuleSlotSchema, updateModuleSlotSchema,
  createCapacitySnapshotSchema,
} from './dpc.schema.js';

const MOD = 'rasid.tierx.dpc';
const MID = 'mod_dpc';
const S = { type: 'object', properties: {} } as Record<string, unknown>;

export function registerDpcActions(): void {

  /* ═══════════════════ Node Pool ═══════════════════ */
  actionRegistry.registerAction(
    { action_id: `${MOD}.pool.create`, display_name: 'Create DPC Node Pool', module_id: MID, resource: 'dpc_node_pools', verb: 'create', sensitivity: 'standard', required_permissions: ['dpc_node_pools.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const parsed = createNodePoolSchema.parse(input); const data = await svc.createNodePool(sql, ctx.tenantId, parsed); return { data, object_id: data.id, object_type: 'dpc_node_pool', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.pool.list`, display_name: 'List DPC Node Pools', module_id: MID, resource: 'dpc_node_pools', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_node_pools.read'], input_schema: S, output_schema: S },
    async (_input, _ctx, sql) => { const data = await svc.listNodePools(sql); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.pool.get`, display_name: 'Get DPC Node Pool', module_id: MID, resource: 'dpc_node_pools', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_node_pools.read'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.getNodePool(sql, (input as any).id); return { data, object_id: data?.id, object_type: 'dpc_node_pool' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.pool.update`, display_name: 'Update DPC Node Pool', module_id: MID, resource: 'dpc_node_pools', verb: 'update', sensitivity: 'standard', required_permissions: ['dpc_node_pools.update'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const { id, ...rest } = input as any; const parsed = updateNodePoolSchema.parse(rest); const data = await svc.updateNodePool(sql, id, parsed); return { data, object_id: data?.id, object_type: 'dpc_node_pool', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.pool.delete`, display_name: 'Delete DPC Node Pool', module_id: MID, resource: 'dpc_node_pools', verb: 'delete', sensitivity: 'critical', required_permissions: ['dpc_node_pools.delete'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.deleteNodePool(sql, (input as any).id); return { data, object_id: (input as any).id, object_type: 'dpc_node_pool' }; },
  );

  /* ═══════════════════ Resource Quota ═══════════════════ */
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.create`, display_name: 'Create DPC Resource Quota', module_id: MID, resource: 'dpc_resource_quotas', verb: 'create', sensitivity: 'standard', required_permissions: ['dpc_resource_quotas.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const parsed = createResourceQuotaSchema.parse(input); const data = await svc.createResourceQuota(sql, ctx.tenantId, parsed); return { data, object_id: data.id, object_type: 'dpc_resource_quota', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.list`, display_name: 'List DPC Resource Quotas', module_id: MID, resource: 'dpc_resource_quotas', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_resource_quotas.read'], input_schema: S, output_schema: S },
    async (_input, _ctx, sql) => { const data = await svc.listResourceQuotas(sql); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.get`, display_name: 'Get DPC Resource Quota', module_id: MID, resource: 'dpc_resource_quotas', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_resource_quotas.read'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.getResourceQuota(sql, (input as any).id); return { data, object_id: data?.id, object_type: 'dpc_resource_quota' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.update`, display_name: 'Update DPC Resource Quota', module_id: MID, resource: 'dpc_resource_quotas', verb: 'update', sensitivity: 'standard', required_permissions: ['dpc_resource_quotas.update'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const { id, ...rest } = input as any; const parsed = updateResourceQuotaSchema.parse(rest); const data = await svc.updateResourceQuota(sql, id, parsed); return { data, object_id: data?.id, object_type: 'dpc_resource_quota', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.delete`, display_name: 'Delete DPC Resource Quota', module_id: MID, resource: 'dpc_resource_quotas', verb: 'delete', sensitivity: 'critical', required_permissions: ['dpc_resource_quotas.delete'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.deleteResourceQuota(sql, (input as any).id); return { data, object_id: (input as any).id, object_type: 'dpc_resource_quota' }; },
  );

  /* ═══════════════════ Job Priority Tier ═══════════════════ */
  actionRegistry.registerAction(
    { action_id: `${MOD}.priority.create`, display_name: 'Create DPC Job Priority Tier', module_id: MID, resource: 'dpc_job_priorities', verb: 'create', sensitivity: 'standard', required_permissions: ['dpc_job_priorities.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const parsed = createJobPriorityTierSchema.parse(input); const data = await svc.createJobPriorityTier(sql, ctx.tenantId, parsed); return { data, object_id: data.id, object_type: 'dpc_job_priority_tier', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.priority.list`, display_name: 'List DPC Job Priority Tiers', module_id: MID, resource: 'dpc_job_priorities', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_job_priorities.read'], input_schema: S, output_schema: S },
    async (_input, _ctx, sql) => { const data = await svc.listJobPriorityTiers(sql); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.priority.get`, display_name: 'Get DPC Job Priority Tier', module_id: MID, resource: 'dpc_job_priorities', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_job_priorities.read'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.getJobPriorityTier(sql, (input as any).id); return { data, object_id: data?.id, object_type: 'dpc_job_priority_tier' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.priority.update`, display_name: 'Update DPC Job Priority Tier', module_id: MID, resource: 'dpc_job_priorities', verb: 'update', sensitivity: 'standard', required_permissions: ['dpc_job_priorities.update'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const { id, ...rest } = input as any; const parsed = updateJobPriorityTierSchema.parse(rest); const data = await svc.updateJobPriorityTier(sql, id, parsed); return { data, object_id: data?.id, object_type: 'dpc_job_priority_tier', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.priority.delete`, display_name: 'Delete DPC Job Priority Tier', module_id: MID, resource: 'dpc_job_priorities', verb: 'delete', sensitivity: 'critical', required_permissions: ['dpc_job_priorities.delete'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.deleteJobPriorityTier(sql, (input as any).id); return { data, object_id: (input as any).id, object_type: 'dpc_job_priority_tier' }; },
  );

  /* ═══════════════════ Module Slot ═══════════════════ */
  actionRegistry.registerAction(
    { action_id: `${MOD}.slot.create`, display_name: 'Create DPC Module Slot', module_id: MID, resource: 'dpc_module_slots', verb: 'create', sensitivity: 'standard', required_permissions: ['dpc_module_slots.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const parsed = createModuleSlotSchema.parse(input); const data = await svc.createModuleSlot(sql, ctx.tenantId, parsed); return { data, object_id: data.id, object_type: 'dpc_module_slot', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.slot.list`, display_name: 'List DPC Module Slots', module_id: MID, resource: 'dpc_module_slots', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_module_slots.read'], input_schema: S, output_schema: S },
    async (_input, _ctx, sql) => { const data = await svc.listModuleSlots(sql); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.slot.get`, display_name: 'Get DPC Module Slot', module_id: MID, resource: 'dpc_module_slots', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_module_slots.read'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.getModuleSlot(sql, (input as any).id); return { data, object_id: data?.id, object_type: 'dpc_module_slot' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.slot.update`, display_name: 'Update DPC Module Slot', module_id: MID, resource: 'dpc_module_slots', verb: 'update', sensitivity: 'standard', required_permissions: ['dpc_module_slots.update'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const { id, ...rest } = input as any; const parsed = updateModuleSlotSchema.parse(rest); const data = await svc.updateModuleSlot(sql, id, parsed); return { data, object_id: data?.id, object_type: 'dpc_module_slot', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.slot.delete`, display_name: 'Delete DPC Module Slot', module_id: MID, resource: 'dpc_module_slots', verb: 'delete', sensitivity: 'critical', required_permissions: ['dpc_module_slots.delete'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.deleteModuleSlot(sql, (input as any).id); return { data, object_id: (input as any).id, object_type: 'dpc_module_slot' }; },
  );

  /* ═══════════════════ Capacity Snapshot ═══════════════════ */
  actionRegistry.registerAction(
    { action_id: `${MOD}.capacity.create`, display_name: 'Create DPC Capacity Snapshot', module_id: MID, resource: 'dpc_capacity', verb: 'create', sensitivity: 'standard', required_permissions: ['dpc_capacity.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const parsed = createCapacitySnapshotSchema.parse(input); const data = await svc.createCapacitySnapshot(sql, ctx.tenantId, parsed); return { data, object_id: data.id, object_type: 'dpc_capacity_snapshot', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.capacity.list`, display_name: 'List DPC Capacity Snapshots', module_id: MID, resource: 'dpc_capacity', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_capacity.read'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.listCapacitySnapshots(sql, (input as any)?.pool_id); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.capacity.get`, display_name: 'Get DPC Capacity Snapshot', module_id: MID, resource: 'dpc_capacity', verb: 'read', sensitivity: 'standard', required_permissions: ['dpc_capacity.read'], input_schema: S, output_schema: S },
    async (input, _ctx, sql) => { const data = await svc.getCapacitySnapshot(sql, (input as any).id); return { data, object_id: data?.id, object_type: 'dpc_capacity_snapshot' }; },
  );
}

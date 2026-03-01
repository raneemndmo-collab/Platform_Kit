/**
 * DPC — Zod Validation Schemas
 */
import { z } from 'zod';

/* ── Node Pool ── */
export const createNodePoolSchema = z.object({
  name: z.string().min(1).max(100),
  pool_type: z.enum(['cpu', 'gpu']),
  min_nodes: z.number().int().min(0),
  max_nodes: z.number().int().min(1),
  cpu_per_node: z.number().min(0.5),
  memory_gb_per_node: z.number().min(1),
  gpu_per_node: z.number().int().min(0).optional().default(0),
  labels: z.record(z.string()).optional().default({}),
});

export const updateNodePoolSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['active', 'standby', 'draining', 'offline']).optional(),
  min_nodes: z.number().int().min(0).optional(),
  max_nodes: z.number().int().min(1).optional(),
  current_nodes: z.number().int().min(0).optional(),
  labels: z.record(z.string()).optional(),
});

/* ── Resource Quota ── */
export const createResourceQuotaSchema = z.object({
  scope: z.enum(['cluster', 'pool', 'module']),
  scope_ref: z.string().min(1).max(200),
  max_cpu: z.number().min(0),
  max_memory_gb: z.number().min(0),
  max_gpu: z.number().int().min(0).optional().default(0),
  max_concurrent_jobs: z.number().int().min(1),
  description: z.string().max(500).optional().default(''),
});

export const updateResourceQuotaSchema = z.object({
  max_cpu: z.number().min(0).optional(),
  max_memory_gb: z.number().min(0).optional(),
  max_gpu: z.number().int().min(0).optional(),
  max_concurrent_jobs: z.number().int().min(1).optional(),
  description: z.string().max(500).optional(),
});

/* ── Job Priority Tier ── */
export const createJobPriorityTierSchema = z.object({
  level: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  name: z.string().min(1).max(100),
  max_queue_depth: z.number().int().min(1),
  timeout_seconds: z.number().int().min(1),
  concurrency_limit: z.number().int().min(1),
  backpressure_threshold: z.number().int().min(1),
  description: z.string().max(500).optional().default(''),
});

export const updateJobPriorityTierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  max_queue_depth: z.number().int().min(1).optional(),
  timeout_seconds: z.number().int().min(1).optional(),
  concurrency_limit: z.number().int().min(1).optional(),
  backpressure_threshold: z.number().int().min(1).optional(),
  description: z.string().max(500).optional(),
});

/* ── Module Slot ── */
export const createModuleSlotSchema = z.object({
  module_code: z.string().min(1).max(10),
  module_name: z.string().min(1).max(100),
  database_name: z.string().min(1).max(100),
  schema_name: z.string().min(1).max(100),
  pool_type: z.enum(['cpu', 'gpu']),
  event_namespace: z.string().min(1).max(100),
  api_prefix: z.string().min(1).max(200),
  resource_quota_id: z.string().uuid().optional(),
  config: z.record(z.unknown()).optional().default({}),
});

export const updateModuleSlotSchema = z.object({
  status: z.enum(['registered', 'provisioned', 'active', 'suspended', 'decommissioned']).optional(),
  resource_quota_id: z.string().uuid().nullable().optional(),
  config: z.record(z.unknown()).optional(),
});

/* ── Capacity Snapshot ── */
export const createCapacitySnapshotSchema = z.object({
  pool_id: z.string().uuid(),
  total_cpu: z.number().min(0),
  used_cpu: z.number().min(0),
  total_memory_gb: z.number().min(0),
  used_memory_gb: z.number().min(0),
  total_gpu: z.number().int().min(0).optional().default(0),
  used_gpu: z.number().int().min(0).optional().default(0),
  active_jobs: z.number().int().min(0),
  queued_jobs: z.number().int().min(0),
});

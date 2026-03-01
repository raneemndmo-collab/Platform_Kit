/**
 * DPC — Document Processing Cluster Provisioning (Tier X STEP 0)
 *
 * Metadata-only infrastructure isolation layer for Tier X.
 * Tracks DPC node pools, resource quotas, job priority tiers,
 * module registry, and processing capacity metadata.
 *
 * Schema: mod_dpc
 *
 * No actual Kubernetes. No actual cluster management.
 * No scheduler. No background workers. No external providers.
 * All data is metadata/configuration persisted in DB only.
 */

/* ── Node Pool ── */
export type PoolType = 'cpu' | 'gpu';
export type PoolStatus = 'active' | 'standby' | 'draining' | 'offline';

export interface NodePool {
  id: string;
  tenant_id: string;
  name: string;
  pool_type: PoolType;
  status: PoolStatus;
  min_nodes: number;
  max_nodes: number;
  current_nodes: number;
  cpu_per_node: number;
  memory_gb_per_node: number;
  gpu_per_node: number;
  labels: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface CreateNodePoolInput {
  name: string;
  pool_type: PoolType;
  min_nodes: number;
  max_nodes: number;
  cpu_per_node: number;
  memory_gb_per_node: number;
  gpu_per_node?: number;
  labels?: Record<string, string>;
}

export interface UpdateNodePoolInput {
  name?: string;
  status?: PoolStatus;
  min_nodes?: number;
  max_nodes?: number;
  current_nodes?: number;
  labels?: Record<string, string>;
}

/* ── Resource Quota ── */
export type QuotaScope = 'cluster' | 'pool' | 'module';

export interface ResourceQuota {
  id: string;
  tenant_id: string;
  scope: QuotaScope;
  scope_ref: string;
  max_cpu: number;
  max_memory_gb: number;
  max_gpu: number;
  max_concurrent_jobs: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateResourceQuotaInput {
  scope: QuotaScope;
  scope_ref: string;
  max_cpu: number;
  max_memory_gb: number;
  max_gpu?: number;
  max_concurrent_jobs: number;
  description?: string;
}

export interface UpdateResourceQuotaInput {
  max_cpu?: number;
  max_memory_gb?: number;
  max_gpu?: number;
  max_concurrent_jobs?: number;
  description?: string;
}

/* ── Job Priority Tier ── */
export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface JobPriorityTier {
  id: string;
  tenant_id: string;
  level: PriorityLevel;
  name: string;
  max_queue_depth: number;
  timeout_seconds: number;
  concurrency_limit: number;
  backpressure_threshold: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateJobPriorityTierInput {
  level: PriorityLevel;
  name: string;
  max_queue_depth: number;
  timeout_seconds: number;
  concurrency_limit: number;
  backpressure_threshold: number;
  description?: string;
}

export interface UpdateJobPriorityTierInput {
  name?: string;
  max_queue_depth?: number;
  timeout_seconds?: number;
  concurrency_limit?: number;
  backpressure_threshold?: number;
  description?: string;
}

/* ── Module Slot (D-module registry within DPC) ── */
export type ModuleSlotStatus = 'registered' | 'provisioned' | 'active' | 'suspended' | 'decommissioned';

export interface ModuleSlot {
  id: string;
  tenant_id: string;
  module_code: string;
  module_name: string;
  database_name: string;
  schema_name: string;
  pool_type: PoolType;
  event_namespace: string;
  api_prefix: string;
  status: ModuleSlotStatus;
  resource_quota_id: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateModuleSlotInput {
  module_code: string;
  module_name: string;
  database_name: string;
  schema_name: string;
  pool_type: PoolType;
  event_namespace: string;
  api_prefix: string;
  resource_quota_id?: string;
  config?: Record<string, unknown>;
}

export interface UpdateModuleSlotInput {
  status?: ModuleSlotStatus;
  resource_quota_id?: string;
  config?: Record<string, unknown>;
}

/* ── Processing Capacity Snapshot ── */
export interface CapacitySnapshot {
  id: string;
  tenant_id: string;
  pool_id: string;
  total_cpu: number;
  used_cpu: number;
  total_memory_gb: number;
  used_memory_gb: number;
  total_gpu: number;
  used_gpu: number;
  active_jobs: number;
  queued_jobs: number;
  recorded_at: string;
}

export interface CreateCapacitySnapshotInput {
  pool_id: string;
  total_cpu: number;
  used_cpu: number;
  total_memory_gb: number;
  used_memory_gb: number;
  total_gpu?: number;
  used_gpu?: number;
  active_jobs: number;
  queued_jobs: number;
}

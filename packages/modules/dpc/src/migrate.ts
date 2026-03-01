/**
 * DPC — Document Processing Cluster Provisioning Migration
 *
 * Creates mod_dpc schema with RLS-enabled tables.
 * Isolated from kernel schema — no FK to kernel tables.
 * No cross-schema foreign keys.
 * Metadata-only: no actual infrastructure provisioning.
 */
import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModDpc(): Promise<void> {
  console.log('[DPC] Running mod_dpc migration...');

  // ── Create schema ──
  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_dpc`;

  // ── node_pools ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_dpc.node_pools (
      id                  UUID PRIMARY KEY,
      tenant_id           UUID NOT NULL,
      name                TEXT NOT NULL,
      pool_type           TEXT NOT NULL CHECK (pool_type IN ('cpu', 'gpu')),
      status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'standby', 'draining', 'offline')),
      min_nodes           INT NOT NULL DEFAULT 0,
      max_nodes           INT NOT NULL DEFAULT 1,
      current_nodes       INT NOT NULL DEFAULT 0,
      cpu_per_node        DOUBLE PRECISION NOT NULL DEFAULT 4,
      memory_gb_per_node  DOUBLE PRECISION NOT NULL DEFAULT 16,
      gpu_per_node        INT NOT NULL DEFAULT 0,
      labels              JSONB NOT NULL DEFAULT '{}',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── resource_quotas ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_dpc.resource_quotas (
      id                   UUID PRIMARY KEY,
      tenant_id            UUID NOT NULL,
      scope                TEXT NOT NULL CHECK (scope IN ('cluster', 'pool', 'module')),
      scope_ref            TEXT NOT NULL,
      max_cpu              DOUBLE PRECISION NOT NULL,
      max_memory_gb        DOUBLE PRECISION NOT NULL,
      max_gpu              INT NOT NULL DEFAULT 0,
      max_concurrent_jobs  INT NOT NULL DEFAULT 100,
      description          TEXT DEFAULT '',
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── job_priority_tiers ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_dpc.job_priority_tiers (
      id                      UUID PRIMARY KEY,
      tenant_id               UUID NOT NULL,
      level                   TEXT NOT NULL CHECK (level IN ('P0', 'P1', 'P2', 'P3', 'P4')),
      name                    TEXT NOT NULL,
      max_queue_depth         INT NOT NULL,
      timeout_seconds         INT NOT NULL,
      concurrency_limit       INT NOT NULL,
      backpressure_threshold  INT NOT NULL,
      description             TEXT DEFAULT '',
      created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── module_slots (D-module registry within DPC) ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_dpc.module_slots (
      id                UUID PRIMARY KEY,
      tenant_id         UUID NOT NULL,
      module_code       TEXT NOT NULL,
      module_name       TEXT NOT NULL,
      database_name     TEXT NOT NULL,
      schema_name       TEXT NOT NULL,
      pool_type         TEXT NOT NULL CHECK (pool_type IN ('cpu', 'gpu')),
      event_namespace   TEXT NOT NULL,
      api_prefix        TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'provisioned', 'active', 'suspended', 'decommissioned')),
      resource_quota_id UUID,
      config            JSONB NOT NULL DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── capacity_snapshots ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_dpc.capacity_snapshots (
      id              UUID PRIMARY KEY,
      tenant_id       UUID NOT NULL,
      pool_id         UUID NOT NULL,
      total_cpu       DOUBLE PRECISION NOT NULL,
      used_cpu        DOUBLE PRECISION NOT NULL,
      total_memory_gb DOUBLE PRECISION NOT NULL,
      used_memory_gb  DOUBLE PRECISION NOT NULL,
      total_gpu       INT NOT NULL DEFAULT 0,
      used_gpu        INT NOT NULL DEFAULT 0,
      active_jobs     INT NOT NULL DEFAULT 0,
      queued_jobs     INT NOT NULL DEFAULT 0,
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── Indexes ──
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_pools_tenant ON mod_dpc.node_pools(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_pools_type ON mod_dpc.node_pools(pool_type)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_quotas_tenant ON mod_dpc.resource_quotas(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_quotas_scope ON mod_dpc.resource_quotas(scope)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_priorities_tenant ON mod_dpc.job_priority_tiers(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_priorities_level ON mod_dpc.job_priority_tiers(level)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_slots_tenant ON mod_dpc.module_slots(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_slots_code ON mod_dpc.module_slots(module_code)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_slots_status ON mod_dpc.module_slots(status)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_capacity_tenant ON mod_dpc.capacity_snapshots(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dpc_capacity_pool ON mod_dpc.capacity_snapshots(pool_id)`;

  // ── RLS ──
  const tables = ['node_pools', 'resource_quotas', 'job_priority_tiers', 'module_slots', 'capacity_snapshots'];
  for (const t of tables) {
    await adminSql`SELECT set_config('search_path', 'mod_dpc', false)`;
    await adminSql.unsafe(`ALTER TABLE mod_dpc.${t} ENABLE ROW LEVEL SECURITY`);
    await adminSql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON mod_dpc.${t}`);
    await adminSql.unsafe(
      `CREATE POLICY tenant_isolation ON mod_dpc.${t}
       USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`
    );
  }

  // ── Grants for rasid_app (RLS-scoped connection) ──
  await adminSql`GRANT USAGE ON SCHEMA mod_dpc TO rasid_app`;
  await adminSql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mod_dpc TO rasid_app`);
  await adminSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA mod_dpc GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rasid_app`);

  console.log('[DPC] mod_dpc migration complete.');
}

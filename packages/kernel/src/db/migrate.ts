import 'dotenv/config';
import postgres from 'postgres';

const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!adminUrl) {
  throw new Error('DATABASE_ADMIN_URL is not set');
}

const sql = postgres(adminUrl, { max: 1 });

async function migrate(): Promise<void> {
  console.log('Running Phase 0 migration...');

  // Create kernel schema
  await sql`CREATE SCHEMA IF NOT EXISTS kernel`;

  // ─── P0.4.1 tenants ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.tenants (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'suspended')),
      settings JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ─── P0.4.2 users ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.users (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'suspended')),
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, email)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS users_tenant_status_idx ON kernel.users (tenant_id, status)`;

  // ─── P0.4.3 roles ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.roles (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      name VARCHAR(100) NOT NULL,
      description VARCHAR(500),
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, name)
    )
  `;

  // ─── P0.4.4 permissions ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.permissions (
      id UUID PRIMARY KEY,
      resource VARCHAR(100) NOT NULL,
      action VARCHAR(50) NOT NULL,
      description VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (resource, action)
    )
  `;

  // ─── P0.4.5 role_permissions ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.role_permissions (
      role_id UUID NOT NULL REFERENCES kernel.roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES kernel.permissions(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      PRIMARY KEY (role_id, permission_id)
    )
  `;

  // ─── P0.4.6 user_roles ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.user_roles (
      user_id UUID NOT NULL REFERENCES kernel.users(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES kernel.roles(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_by UUID REFERENCES kernel.users(id),
      PRIMARY KEY (user_id, role_id)
    )
  `;

  // ─── P0.4.7 object_types ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.object_types (
      name VARCHAR(100) PRIMARY KEY,
      display_name VARCHAR(255) NOT NULL,
      module_id VARCHAR(100) NOT NULL,
      json_schema JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ─── P0.4.8 objects ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.objects (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      type VARCHAR(100) NOT NULL,
      state VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (state IN ('draft', 'active', 'archived', 'deleted')),
      version INTEGER NOT NULL DEFAULT 1,
      data JSONB NOT NULL,
      created_by UUID NOT NULL REFERENCES kernel.users(id),
      updated_by UUID REFERENCES kernel.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS objects_tenant_type_state_idx ON kernel.objects (tenant_id, type, state)`;
  await sql`CREATE INDEX IF NOT EXISTS objects_tenant_created_idx ON kernel.objects (tenant_id, created_at DESC)`;

  // ─── P0.4.9 action_manifests ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.action_manifests (
      action_id VARCHAR(150) PRIMARY KEY,
      display_name VARCHAR(255) NOT NULL,
      module_id VARCHAR(100) NOT NULL,
      verb VARCHAR(20) NOT NULL
        CHECK (verb IN ('create', 'read', 'update', 'delete')),
      resource VARCHAR(100) NOT NULL,
      input_schema JSONB NOT NULL,
      output_schema JSONB NOT NULL,
      required_permissions JSONB NOT NULL,
      sensitivity VARCHAR(10) NOT NULL DEFAULT 'low'
        CHECK (sensitivity IN ('low', 'medium', 'high')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ─── P0.4.10 audit_log ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.audit_log (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      actor_id UUID NOT NULL,
      actor_type VARCHAR(20) NOT NULL DEFAULT 'user',
      action_id VARCHAR(150) NOT NULL,
      object_id UUID,
      object_type VARCHAR(100),
      status VARCHAR(20) NOT NULL
        CHECK (status IN ('success', 'failure')),
      payload_before JSONB,
      payload_after JSONB,
      error_message VARCHAR(1000),
      ip_address VARCHAR(45),
      session_id UUID,
      correlation_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS audit_tenant_created_idx ON kernel.audit_log (tenant_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS audit_tenant_actor_idx ON kernel.audit_log (tenant_id, actor_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS audit_tenant_object_idx ON kernel.audit_log (tenant_id, object_id)`;
  await sql`CREATE INDEX IF NOT EXISTS audit_tenant_action_idx ON kernel.audit_log (tenant_id, action_id, created_at DESC)`;

  // ─── K7 lineage_edges (Phase 1) ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.lineage_edges (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      source_id VARCHAR(255) NOT NULL,
      source_type VARCHAR(100) NOT NULL,
      target_id VARCHAR(255) NOT NULL,
      target_type VARCHAR(100) NOT NULL,
      relationship VARCHAR(100) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_by UUID NOT NULL REFERENCES kernel.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, source_id, target_id, relationship)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS lineage_edges_source_idx ON kernel.lineage_edges (tenant_id, source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS lineage_edges_target_idx ON kernel.lineage_edges (tenant_id, target_id)`;

  // ─── K8 datasets (Phase 1 — Semantic Data Layer) ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.datasets (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      name VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description VARCHAR(1000),
      source_type VARCHAR(20) NOT NULL
        CHECK (source_type IN ('table', 'view', 'query')),
      source_config JSONB NOT NULL DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
      created_by UUID NOT NULL REFERENCES kernel.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, name)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS datasets_tenant_status_idx ON kernel.datasets (tenant_id, status)`;

  // ─── K8 dataset_fields ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.dataset_fields (
      id UUID PRIMARY KEY,
      dataset_id UUID NOT NULL REFERENCES kernel.datasets(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      name VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      data_type VARCHAR(20) NOT NULL
        CHECK (data_type IN ('string', 'number', 'boolean', 'date', 'timestamp')),
      is_dimension BOOLEAN NOT NULL DEFAULT false,
      is_metric BOOLEAN NOT NULL DEFAULT false,
      expression VARCHAR(1000),
      description VARCHAR(1000),
      ordinal INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (dataset_id, name)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS dataset_fields_tenant_idx ON kernel.dataset_fields (tenant_id)`;

  // ─── K8 metrics ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.metrics (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      dataset_id UUID NOT NULL REFERENCES kernel.datasets(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      expression VARCHAR(1000) NOT NULL,
      aggregation VARCHAR(20) NOT NULL
        CHECK (aggregation IN ('sum', 'avg', 'count', 'min', 'max', 'count_distinct')),
      dimensions JSONB NOT NULL DEFAULT '[]',
      description VARCHAR(1000),
      created_by UUID NOT NULL REFERENCES kernel.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, dataset_id, name)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS metrics_tenant_idx ON kernel.metrics (tenant_id)`;

  // ─── K9 design_tokens (Phase 1 — Design System) ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.design_tokens (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(20) NOT NULL
        CHECK (category IN ('color', 'typography', 'spacing', 'sizing', 'border', 'shadow', 'opacity')),
      value VARCHAR(1000) NOT NULL,
      description VARCHAR(1000),
      created_by UUID NOT NULL REFERENCES kernel.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, name)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS design_tokens_tenant_category_idx ON kernel.design_tokens (tenant_id, category)`;

  // ─── K9 design_themes ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.design_themes (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      name VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description VARCHAR(1000),
      status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
      is_default BOOLEAN NOT NULL DEFAULT false,
      token_overrides JSONB NOT NULL DEFAULT '{}',
      created_by UUID NOT NULL REFERENCES kernel.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, name)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS design_themes_tenant_status_idx ON kernel.design_themes (tenant_id, status)`;

  // ─── K9 design_components ───
  await sql`
    CREATE TABLE IF NOT EXISTS kernel.design_components (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES kernel.tenants(id),
      name VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description VARCHAR(1000),
      category VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'deprecated')),
      variants JSONB NOT NULL DEFAULT '{}',
      default_props JSONB NOT NULL DEFAULT '{}',
      created_by UUID NOT NULL REFERENCES kernel.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, name)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS design_components_tenant_category_idx ON kernel.design_components (tenant_id, category)`;

  // ─── RLS Policies ───
  const rlsTables = ['users', 'roles', 'role_permissions', 'user_roles', 'objects', 'audit_log', 'lineage_edges', 'datasets', 'dataset_fields', 'metrics', 'design_tokens', 'design_themes', 'design_components'];
  for (const table of rlsTables) {
    await sql.unsafe(`ALTER TABLE kernel.${table} ENABLE ROW LEVEL SECURITY`);
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = 'tenant_isolation'
        ) THEN
          CREATE POLICY tenant_isolation ON kernel.${table}
            USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
        END IF;
      END $$
    `);
  }

  // ─── Grants for rasid_app ───
  await sql`GRANT USAGE ON SCHEMA kernel TO rasid_app`;

  // All tables: SELECT, INSERT
  await sql`GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA kernel TO rasid_app`;

  // UPDATE on specific tables (NOT audit_log)
  const updatableTables = ['tenants', 'users', 'roles', 'role_permissions', 'user_roles', 'objects', 'object_types', 'action_manifests', 'permissions', 'lineage_edges', 'datasets', 'dataset_fields', 'metrics', 'design_tokens', 'design_themes', 'design_components'];
  for (const table of updatableTables) {
    await sql.unsafe(`GRANT UPDATE ON kernel.${table} TO rasid_app`);
  }

  // DELETE on junction tables and roles (for custom role deletion)
  const deletableTables = ['role_permissions', 'user_roles', 'roles', 'lineage_edges', 'datasets', 'dataset_fields', 'metrics', 'design_tokens', 'design_themes', 'design_components'];
  for (const table of deletableTables) {
    await sql.unsafe(`GRANT DELETE ON kernel.${table} TO rasid_app`);
  }

  // EXPLICITLY: NO UPDATE, NO DELETE on audit_log for rasid_app
  await sql`REVOKE UPDATE, DELETE ON kernel.audit_log FROM rasid_app`;

  console.log('Migration complete. 17 tables created. RLS enabled on 13 tables.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

/**
 * M9 — Dashboard Engine Migration
 *
 * Creates mod_dashboard schema with RLS-enabled tables.
 * Isolated from kernel schema — no FK to kernel tables.
 * No cross-schema foreign keys.
 */

import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModDashboard(): Promise<void> {
  console.log('[M9] Running mod_dashboard migration...');

  // ── Create schema ──
  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_dashboard`;

  // ── dashboards ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_dashboard.dashboards (
      id            UUID PRIMARY KEY,
      tenant_id     UUID NOT NULL,
      name          TEXT NOT NULL,
      description   TEXT DEFAULT '',
      layout        JSONB NOT NULL DEFAULT '[]',
      filters       JSONB NOT NULL DEFAULT '[]',
      status        TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
      created_by    UUID NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── widgets ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_dashboard.widgets (
      id            UUID PRIMARY KEY,
      dashboard_id  UUID NOT NULL REFERENCES mod_dashboard.dashboards(id) ON DELETE CASCADE,
      tenant_id     UUID NOT NULL,
      title         TEXT NOT NULL,
      widget_type   TEXT NOT NULL
                    CHECK (widget_type IN ('kpi_card', 'bar_chart', 'line_chart', 'pie_chart', 'table', 'metric', 'text')),
      config        JSONB NOT NULL DEFAULT '{}',
      position      JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":4,"h":3}',
      data_source   JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── shared_dashboards ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_dashboard.shared_dashboards (
      id                UUID PRIMARY KEY,
      dashboard_id      UUID NOT NULL REFERENCES mod_dashboard.dashboards(id) ON DELETE CASCADE,
      tenant_id         UUID NOT NULL,
      shared_with_type  TEXT NOT NULL
                        CHECK (shared_with_type IN ('user', 'role', 'tenant')),
      shared_with_id    UUID NOT NULL,
      permission_level  TEXT NOT NULL DEFAULT 'view'
                        CHECK (permission_level IN ('view', 'edit')),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── RLS ──
  for (const table of ['dashboards', 'widgets', 'shared_dashboards']) {
    await adminSql.unsafe(`ALTER TABLE mod_dashboard.${table} ENABLE ROW LEVEL SECURITY`);
    await adminSql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON mod_dashboard.${table}`);
    await adminSql.unsafe(`
      CREATE POLICY tenant_isolation ON mod_dashboard.${table}
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    `);
  }

  // ── GRANTs for app role ──
  await adminSql`GRANT USAGE ON SCHEMA mod_dashboard TO rasid_app`;
  for (const table of ['dashboards', 'widgets', 'shared_dashboards']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_dashboard.${table} TO rasid_app`,
    );
  }

  // ── Indexes ──
  await adminSql`CREATE INDEX IF NOT EXISTS idx_dashboards_tenant ON mod_dashboard.dashboards (tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON mod_dashboard.widgets (dashboard_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_widgets_tenant ON mod_dashboard.widgets (tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_shared_dashboards_dashboard ON mod_dashboard.shared_dashboards (dashboard_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_shared_dashboards_tenant ON mod_dashboard.shared_dashboards (tenant_id)`;

  console.log('[M9] mod_dashboard migration complete — 3 tables, 3 RLS policies.');
}

// Self-execute when run directly
const isDirectRun =
  process.argv[1]?.endsWith('migrate.ts') ||
  process.argv[1]?.endsWith('migrate.js');
if (isDirectRun) {
  migrateModDashboard()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[M9] Migration failed:', err);
      process.exit(1);
    });
}

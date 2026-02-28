/**
 * M13 — Custom Tables Migration
 *
 * Creates mod_connectors schema with RLS-enabled tables.
 * Isolated from kernel schema — no FK to kernel tables.
 */

import 'dotenv/config';
import { adminSql } from '../../../kernel/src/db/connection.js';

export async function migrateModConnectors(): Promise<void> {
  console.log('[M13] Running mod_connectors migration...');

  // ── Create schema ──
  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_connectors`;

  // ── custom_tables ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_connectors.custom_tables (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID NOT NULL,
      name          VARCHAR(64) NOT NULL,
      display_name  VARCHAR(128) NOT NULL,
      description   TEXT,
      columns       JSONB NOT NULL DEFAULT '[]',
      status        VARCHAR(16) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'archived')),
      created_by    UUID NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, name)
    )
  `;

  // ── custom_table_rows ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_connectors.custom_table_rows (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_id      UUID NOT NULL REFERENCES mod_connectors.custom_tables(id) ON DELETE CASCADE,
      tenant_id     UUID NOT NULL,
      row_data      JSONB NOT NULL DEFAULT '{}',
      row_order     INTEGER NOT NULL DEFAULT 0,
      created_by    UUID NOT NULL,
      updated_by    UUID,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── RLS ──
  for (const table of ['custom_tables', 'custom_table_rows']) {
    await adminSql.unsafe(`ALTER TABLE mod_connectors.${table} ENABLE ROW LEVEL SECURITY`);
    await adminSql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON mod_connectors.${table}`);
    await adminSql.unsafe(`
      CREATE POLICY tenant_isolation ON mod_connectors.${table}
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    `);
  }

  // ── GRANTs for app role ──
  await adminSql`GRANT USAGE ON SCHEMA mod_connectors TO rasid_app`;
  for (const table of ['custom_tables', 'custom_table_rows']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_connectors.${table} TO rasid_app`,
    );
  }

  // ── Indexes ──
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_custom_tables_tenant
    ON mod_connectors.custom_tables (tenant_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_custom_table_rows_table
    ON mod_connectors.custom_table_rows (table_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_custom_table_rows_tenant
    ON mod_connectors.custom_table_rows (tenant_id)
  `;

  console.log('[M13] mod_connectors migration complete — 2 tables, 2 RLS policies.');
}

// Self-execute when run directly
const isDirectRun =
  process.argv[1]?.endsWith('migrate.ts') ||
  process.argv[1]?.endsWith('migrate.js');
if (isDirectRun) {
  migrateModConnectors()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[M13] Migration failed:', err);
      process.exit(1);
    });
}

/**
 * M14 Custom Pages — Migration
 *
 * Creates mod_custom_pages schema with a single pages table.
 * Sections stored as JSONB array (no separate table needed).
 * RLS policy for tenant isolation.
 * No cross-schema FK — dashboard/report IDs stored as plain strings in JSONB.
 */
import { adminSql } from '../../../kernel/src/db/connection.js';

export async function migrateModCustomPages(): Promise<void> {
  console.log('[M14] Running mod_custom_pages migration...');

  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_custom_pages`;

  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_custom_pages.pages (
      id          UUID PRIMARY KEY,
      tenant_id   UUID NOT NULL,
      name        VARCHAR(255) NOT NULL,
      slug        VARCHAR(255) NOT NULL,
      description TEXT,
      icon        VARCHAR(100),
      status      VARCHAR(20) NOT NULL DEFAULT 'draft',
      layout      JSONB NOT NULL DEFAULT '{}',
      sections    JSONB NOT NULL DEFAULT '[]',
      created_by  UUID NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // RLS
  await adminSql.unsafe(`ALTER TABLE mod_custom_pages.pages ENABLE ROW LEVEL SECURITY`);
  await adminSql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON mod_custom_pages.pages`);
  await adminSql.unsafe(`
    CREATE POLICY tenant_isolation ON mod_custom_pages.pages
      USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  `);

  // ── GRANTs ──
  await adminSql`GRANT USAGE ON SCHEMA mod_custom_pages TO rasid_app`;
  for (const table of ['pages'] as const) {
    await adminSql`
      GRANT SELECT, INSERT, UPDATE, DELETE ON mod_custom_pages.${adminSql(table)} TO rasid_app`;
  }

  console.log('[M14] mod_custom_pages migration complete — 1 table, 1 RLS policy, GRANTs applied.');
}

// Run directly
const isDirectRun = process.argv[1]?.includes('custom-pages') && process.argv[1]?.includes('migrate');
if (isDirectRun) {
  migrateModCustomPages()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

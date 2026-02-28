/**
 * M16 Presentations — Migration
 *
 * Creates mod_presentations schema with a single presentations table.
 * Slides stored as JSONB array (no separate table needed).
 * RLS policy for tenant isolation.
 * No cross-schema FK — report IDs stored as plain strings in JSONB.
 */
import { adminSql } from '../../../kernel/src/db/connection.js';

export async function migrateModPresentations(): Promise<void> {
  console.log('[M16] Running mod_presentations migration...');

  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_presentations`;

  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_presentations.presentations (
      id          UUID PRIMARY KEY,
      tenant_id   UUID NOT NULL,
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      status      VARCHAR(20) NOT NULL DEFAULT 'draft',
      slides      JSONB NOT NULL DEFAULT '[]',
      created_by  UUID NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // RLS
  await adminSql.unsafe(`ALTER TABLE mod_presentations.presentations ENABLE ROW LEVEL SECURITY`);
  await adminSql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON mod_presentations.presentations`);
  await adminSql.unsafe(`
    CREATE POLICY tenant_isolation ON mod_presentations.presentations
      USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  `);

  // ── GRANTs ──
  await adminSql`GRANT USAGE ON SCHEMA mod_presentations TO rasid_app`;
  await adminSql`GRANT SELECT, INSERT, UPDATE, DELETE ON mod_presentations.presentations TO rasid_app`;

  console.log('[M16] mod_presentations migration complete — 1 table, 1 RLS policy, GRANTs applied.');
}

// Run directly
const isDirectRun = process.argv[1]?.includes('presentations') && process.argv[1]?.includes('migrate');
if (isDirectRun) {
  migrateModPresentations()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

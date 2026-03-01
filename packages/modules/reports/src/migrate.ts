/**
 * M10 — Reports Engine Migration
 *
 * Creates mod_reports schema with RLS-enabled tables.
 * Metadata-driven: stores report definitions and run history only.
 * No cross-schema foreign keys.
 */

import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModReports(): Promise<void> {
  console.log('[M10] Running mod_reports migration...');

  // ── Create schema ──
  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_reports`;

  // ── report_definitions ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_reports.report_definitions (
      id          UUID PRIMARY KEY,
      tenant_id   UUID NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      report_type TEXT NOT NULL DEFAULT 'tabular'
                  CHECK (report_type IN ('tabular','summary','crosstab','narrative','kpi_scorecard')),
      data_source JSONB NOT NULL DEFAULT '{}',
      layout      JSONB NOT NULL DEFAULT '{}',
      parameters  JSONB NOT NULL DEFAULT '[]',
      status      TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','archived')),
      created_by  UUID NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── report_runs ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_reports.report_runs (
      id          UUID PRIMARY KEY,
      report_id   UUID NOT NULL REFERENCES mod_reports.report_definitions(id) ON DELETE CASCADE,
      tenant_id   UUID NOT NULL,
      parameters  JSONB NOT NULL DEFAULT '{}',
      output      JSONB NOT NULL DEFAULT '{}',
      status      TEXT NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('completed','failed')),
      executed_by UUID NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      duration_ms INTEGER NOT NULL DEFAULT 0
    )
  `;

  // ── RLS ──
  for (const table of ['report_definitions', 'report_runs']) {
    await adminSql.unsafe(`ALTER TABLE mod_reports.${table} ENABLE ROW LEVEL SECURITY`);
    await adminSql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON mod_reports.${table}`);
    await adminSql.unsafe(`
      CREATE POLICY tenant_isolation ON mod_reports.${table}
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    `);
  }

  // ── GRANTs ──
  await adminSql`GRANT USAGE ON SCHEMA mod_reports TO rasid_app`;
  for (const table of ['report_definitions', 'report_runs']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_reports.${table} TO rasid_app`,
    );
  }

  // ── Indexes ──
  await adminSql`CREATE INDEX IF NOT EXISTS idx_report_defs_tenant ON mod_reports.report_definitions (tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_report_defs_status ON mod_reports.report_definitions (status)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_report_runs_tenant ON mod_reports.report_runs (tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_report_runs_report ON mod_reports.report_runs (report_id)`;

  console.log('[M10] mod_reports migration complete — 2 tables, 2 RLS policies.');
}

// Self-execute when run directly
const isDirectRun =
  process.argv[1]?.endsWith('migrate.ts') ||
  process.argv[1]?.endsWith('migrate.js');
if (isDirectRun) {
  migrateModReports()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[M10] Migration failed:', err);
      process.exit(1);
    });
}

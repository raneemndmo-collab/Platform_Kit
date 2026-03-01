/**
 * M17 — File Manager Migration
 *
 * Creates mod_file_manager schema with RLS-enabled tables.
 * Metadata-only: no binary storage, no blobs, no object storage.
 * No cross-schema foreign keys.
 */

import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModFileManager(): Promise<void> {
  console.log('[M17] Running mod_file_manager migration...');

  // ── Create schema ──
  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_file_manager`;

  // ── folders ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_file_manager.folders (
      id          UUID PRIMARY KEY,
      tenant_id   UUID NOT NULL,
      parent_id   UUID REFERENCES mod_file_manager.folders(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      created_by  UUID NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── files (metadata only) ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_file_manager.files (
      id          UUID PRIMARY KEY,
      tenant_id   UUID NOT NULL,
      folder_id   UUID REFERENCES mod_file_manager.folders(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      size_bytes  BIGINT NOT NULL DEFAULT 0,
      category    TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('document','image','spreadsheet','presentation','archive','other')),
      status      TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','archived','deleted')),
      tags        JSONB NOT NULL DEFAULT '[]',
      metadata    JSONB NOT NULL DEFAULT '{}',
      created_by  UUID NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── RLS ──
  for (const table of ['folders', 'files']) {
    await adminSql.unsafe(`ALTER TABLE mod_file_manager.${table} ENABLE ROW LEVEL SECURITY`);
    await adminSql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON mod_file_manager.${table}`);
    await adminSql.unsafe(`
      CREATE POLICY tenant_isolation ON mod_file_manager.${table}
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    `);
  }

  // ── GRANTs ──
  await adminSql`GRANT USAGE ON SCHEMA mod_file_manager TO rasid_app`;
  for (const table of ['folders', 'files']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_file_manager.${table} TO rasid_app`,
    );
  }

  // ── Indexes ──
  await adminSql`CREATE INDEX IF NOT EXISTS idx_folders_tenant ON mod_file_manager.folders (tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_folders_parent ON mod_file_manager.folders (parent_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_files_tenant ON mod_file_manager.files (tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_files_folder ON mod_file_manager.files (folder_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_files_status ON mod_file_manager.files (status)`;

  console.log('[M17] mod_file_manager migration complete — 2 tables, 2 RLS policies.');
}

// Self-execute when run directly
const isDirectRun =
  process.argv[1]?.endsWith('migrate.ts') ||
  process.argv[1]?.endsWith('migrate.js');
if (isDirectRun) {
  migrateModFileManager()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[M17] Migration failed:', err);
      process.exit(1);
    });
}

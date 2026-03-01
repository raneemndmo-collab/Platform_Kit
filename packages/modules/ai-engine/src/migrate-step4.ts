/**
 * M21 — AI Engine Migration Step 4 (RAG Engine)
 *
 * Adds rag_sources and rag_retrieval_logs tables to mod_ai schema.
 * No cross-schema foreign keys. RLS-enabled.
 * No embeddings tables. No vector tables. No chunk tables.
 */
import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModAiStep4(): Promise<void> {
  console.log('[M21-S4] Running mod_ai migration (Step 4: RAG Engine)...');

  // ── rag_sources ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.rag_sources (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL,
      name              TEXT NOT NULL,
      description       TEXT NOT NULL DEFAULT '',
      module_id         TEXT NOT NULL,
      object_type       TEXT NOT NULL,
      metadata_filters  JSONB NOT NULL DEFAULT '{}'::jsonb,
      status            TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'disabled')),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // RLS
  await adminSql`ALTER TABLE mod_ai.rag_sources ENABLE ROW LEVEL SECURITY`;
  await adminSql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'rag_sources' AND schemaname = 'mod_ai'
          AND policyname = 'tenant_isolation'
      ) THEN
        EXECUTE 'CREATE POLICY tenant_isolation ON mod_ai.rag_sources
          USING (tenant_id = current_setting(''app.current_tenant_id''))';
      END IF;
    END $$
  `;

  // Unique name per tenant
  await adminSql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_src_tenant_name
      ON mod_ai.rag_sources (tenant_id, name)
  `;

  console.log('[M21-S4] ✓ rag_sources');

  // ── rag_retrieval_logs ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.rag_retrieval_logs (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      query           TEXT NOT NULL,
      source_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
      results_count   INTEGER NOT NULL DEFAULT 0,
      took_ms         INTEGER NOT NULL DEFAULT 0,
      retrieved_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // RLS
  await adminSql`ALTER TABLE mod_ai.rag_retrieval_logs ENABLE ROW LEVEL SECURITY`;
  await adminSql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'rag_retrieval_logs' AND schemaname = 'mod_ai'
          AND policyname = 'tenant_isolation'
      ) THEN
        EXECUTE 'CREATE POLICY tenant_isolation ON mod_ai.rag_retrieval_logs
          USING (tenant_id = current_setting(''app.current_tenant_id''))';
      END IF;
    END $$
  `;

  // Index for listing logs
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_rag_logs_tenant
      ON mod_ai.rag_retrieval_logs (tenant_id, retrieved_at DESC)
  `;

  console.log('[M21-S4] ✓ rag_retrieval_logs');

  // ── GRANTs ──
  for (const table of ['rag_sources', 'rag_retrieval_logs']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_ai.${table} TO rasid_app`,
    );
  }
  console.log('[M21-S4] ✓ GRANTs applied');

  console.log('[M21-S4] Migration complete.');
}

// Direct execution
const isDirectRun = process.argv[1]?.includes('migrate-step4');
if (isDirectRun) {
  migrateModAiStep4()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}

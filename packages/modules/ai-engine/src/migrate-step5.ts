/**
 * M21 — AI Engine Migration Step 5 (Memory Layer)
 *
 * Adds memory_sessions and memory_entries tables to mod_ai schema.
 * Session-scoped memory only. No cross-session sharing.
 * No cross-schema foreign keys. RLS-enabled.
 * No PII storage beyond allowed fields.
 */
import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModAiStep5(): Promise<void> {
  console.log('[M21-S5] Running mod_ai migration (Step 5: Memory Layer)...');

  // ── memory_sessions ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.memory_sessions (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      label       TEXT NOT NULL DEFAULT '',
      metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
      status      TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'closed')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── memory_entries ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.memory_entries (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL,
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content     JSONB NOT NULL DEFAULT '{}'::jsonb,
      seq         INTEGER NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── Indexes ──
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_memory_sessions_tenant
      ON mod_ai.memory_sessions (tenant_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_memory_sessions_user
      ON mod_ai.memory_sessions (tenant_id, user_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_memory_entries_session
      ON mod_ai.memory_entries (session_id, seq)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_memory_entries_tenant
      ON mod_ai.memory_entries (tenant_id)
  `;

  // ── RLS ──
  await adminSql`ALTER TABLE mod_ai.memory_sessions ENABLE ROW LEVEL SECURITY`;
  await adminSql`ALTER TABLE mod_ai.memory_entries ENABLE ROW LEVEL SECURITY`;

  // Create RLS policies (idempotent via DO block)
  for (const table of ['memory_sessions', 'memory_entries']) {
    await adminSql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'mod_ai' AND tablename = '${table}' AND policyname = 'tenant_isolation'
        ) THEN
          EXECUTE 'CREATE POLICY tenant_isolation ON mod_ai.${table}
            USING (tenant_id = current_setting(''app.current_tenant_id''))
            WITH CHECK (tenant_id = current_setting(''app.current_tenant_id''))';
        END IF;
      END $$;
    `);
  }
  console.log('[M21-S5] ✓ RLS policies applied');

  // ── GRANTs ──
  for (const table of ['memory_sessions', 'memory_entries']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_ai.${table} TO rasid_app`,
    );
  }
  console.log('[M21-S5] ✓ GRANTs applied');

  console.log('[M21-S5] ✓ Memory Layer migration complete');
}

// Direct execution
const isMain = process.argv[1]?.includes('migrate-step5');
if (isMain) {
  migrateModAiStep5()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}

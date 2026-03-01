/**
 * M21 — AI Engine Migration Step 3 (Agent Framework Core)
 *
 * Adds agent_definitions and agent_executions tables to mod_ai schema.
 * No cross-schema foreign keys. RLS-enabled.
 * No planner tables. No multi-agent tables. No queue tables.
 */
import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModAiStep3(): Promise<void> {
  console.log('[M21-S3] Running mod_ai migration (Step 3: Agent Framework Core)...');

  // ── agent_definitions ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.agent_definitions (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'disabled')),
      allowed_tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      system_prompt   TEXT NOT NULL DEFAULT '',
      metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // RLS
  await adminSql`ALTER TABLE mod_ai.agent_definitions ENABLE ROW LEVEL SECURITY`;
  await adminSql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'agent_definitions' AND schemaname = 'mod_ai'
          AND policyname = 'tenant_isolation'
      ) THEN
        EXECUTE 'CREATE POLICY tenant_isolation ON mod_ai.agent_definitions
          USING (tenant_id = current_setting(''app.current_tenant_id''))';
      END IF;
    END $$
  `;

  // Unique name per tenant
  await adminSql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_def_tenant_name
      ON mod_ai.agent_definitions (tenant_id, name)
  `;

  console.log('[M21-S3] ✓ agent_definitions');

  // ── agent_executions ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.agent_executions (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      agent_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      tool_id         TEXT NOT NULL,
      action_id       TEXT NOT NULL,
      input           JSONB NOT NULL DEFAULT '{}'::jsonb,
      output          JSONB,
      status          TEXT NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed', 'failed', 'rejected')),
      error_message   TEXT,
      policy_decision TEXT NOT NULL DEFAULT 'allow'
                        CHECK (policy_decision IN ('allow', 'deny')),
      duration_ms     INTEGER NOT NULL DEFAULT 0,
      executed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // RLS
  await adminSql`ALTER TABLE mod_ai.agent_executions ENABLE ROW LEVEL SECURITY`;
  await adminSql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'agent_executions' AND schemaname = 'mod_ai'
          AND policyname = 'tenant_isolation'
      ) THEN
        EXECUTE 'CREATE POLICY tenant_isolation ON mod_ai.agent_executions
          USING (tenant_id = current_setting(''app.current_tenant_id''))';
      END IF;
    END $$
  `;

  // Index for listing executions by agent
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_agent_exec_agent
      ON mod_ai.agent_executions (tenant_id, agent_id, executed_at DESC)
  `;

  console.log('[M21-S3] ✓ agent_executions');

  // ── GRANTs ──
  for (const table of ['agent_definitions', 'agent_executions']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_ai.${table} TO rasid_app`,
    );
  }
  console.log('[M21-S3] ✓ GRANTs applied');

  console.log('[M21-S3] Migration complete.');
}

// Direct execution
const isDirectRun = process.argv[1]?.includes('migrate-step3');
if (isDirectRun) {
  migrateModAiStep3()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}

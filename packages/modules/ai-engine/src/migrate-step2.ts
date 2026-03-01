/**
 * M21 — AI Engine Migration Step 2 (Tool Registry + Action Binding)
 *
 * Adds tool_definitions and tool_bindings tables to mod_ai schema.
 * No cross-schema foreign keys. RLS-enabled.
 */
import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModAiStep2(): Promise<void> {
  console.log('[M21-S2] Running mod_ai migration (Step 2: Tool Registry)...');

  // ── tool_definitions ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.tool_definitions (
      id                    UUID PRIMARY KEY,
      tenant_id             UUID NOT NULL,
      action_id             TEXT NOT NULL,
      name                  TEXT NOT NULL,
      description           TEXT NOT NULL DEFAULT '',
      category              TEXT NOT NULL DEFAULT 'general'
                            CHECK (category IN (
                              'data_management', 'analytics', 'content',
                              'communication', 'administration', 'ai', 'general'
                            )),
      status                TEXT NOT NULL DEFAULT 'enabled'
                            CHECK (status IN ('enabled', 'disabled')),
      parameter_schema      JSONB NOT NULL DEFAULT '{}',
      output_description    TEXT NOT NULL DEFAULT '',
      examples              JSONB NOT NULL DEFAULT '[]',
      tags                  JSONB NOT NULL DEFAULT '[]',
      requires_confirmation BOOLEAN NOT NULL DEFAULT false,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, action_id)
    )
  `;

  // ── tool_bindings ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.tool_bindings (
      id              UUID PRIMARY KEY,
      tenant_id       UUID NOT NULL,
      tool_id         UUID NOT NULL
                      REFERENCES mod_ai.tool_definitions(id) ON DELETE CASCADE,
      action_id       TEXT NOT NULL,
      input_mapping   JSONB NOT NULL DEFAULT '{}',
      output_mapping  JSONB NOT NULL DEFAULT '{}',
      pre_conditions  JSONB NOT NULL DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, tool_id, action_id)
    )
  `;

  // ── RLS ──
  for (const table of ['tool_definitions', 'tool_bindings']) {
    await adminSql.unsafe(
      `ALTER TABLE mod_ai.${table} ENABLE ROW LEVEL SECURITY`,
    );
    await adminSql.unsafe(
      `DROP POLICY IF EXISTS tenant_isolation ON mod_ai.${table}`,
    );
    await adminSql.unsafe(`
      CREATE POLICY tenant_isolation ON mod_ai.${table}
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    `);
  }

  // ── GRANTs ──
  for (const table of ['tool_definitions', 'tool_bindings']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_ai.${table} TO rasid_app`,
    );
  }

  // ── Indexes ──
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_definitions_tenant
    ON mod_ai.tool_definitions (tenant_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_definitions_category
    ON mod_ai.tool_definitions (tenant_id, category)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_definitions_status
    ON mod_ai.tool_definitions (tenant_id, status)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_definitions_action
    ON mod_ai.tool_definitions (action_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_bindings_tenant
    ON mod_ai.tool_bindings (tenant_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_bindings_tool
    ON mod_ai.tool_bindings (tool_id)
  `;

  console.log(
    '[M21-S2] mod_ai Step 2 migration complete — 2 tables, 2 RLS policies.',
  );
}

// Self-execute when run directly
const isDirectRun =
  process.argv[1]?.endsWith('migrate-step2.ts') ||
  process.argv[1]?.endsWith('migrate-step2.js');

if (isDirectRun) {
  migrateModAiStep2()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[M21-S2] Migration failed:', err);
      process.exit(1);
    });
}

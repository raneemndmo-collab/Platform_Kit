/**
 * M21 — AI Engine Migration (Step 1: Core)
 *
 * Creates mod_ai schema with RLS-enabled tables.
 * Tables: conversations, messages, tool_invocations
 * Isolated from kernel schema — no FK to kernel tables.
 * No cross-schema foreign keys.
 */
import 'dotenv/config';
import { adminSql } from '../../../kernel/src/db/connection.js';

export async function migrateModAiEngine(): Promise<void> {
  console.log('[M21] Running mod_ai migration (Step 1: Core)...');

  // ── Create schema ──
  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_ai`;

  // ── conversations ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.conversations (
      id            UUID PRIMARY KEY,
      tenant_id     UUID NOT NULL,
      user_id       UUID NOT NULL,
      title         TEXT NOT NULL DEFAULT 'New Conversation',
      status        TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived')),
      metadata      JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── messages ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.messages (
      id                  UUID PRIMARY KEY,
      conversation_id     UUID NOT NULL
                          REFERENCES mod_ai.conversations(id) ON DELETE CASCADE,
      tenant_id           UUID NOT NULL,
      role                TEXT NOT NULL
                          CHECK (role IN ('user', 'assistant', 'system', 'tool_result')),
      content             TEXT NOT NULL DEFAULT '',
      tool_invocation_id  UUID,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── tool_invocations ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_ai.tool_invocations (
      id                UUID PRIMARY KEY,
      conversation_id   UUID NOT NULL
                        REFERENCES mod_ai.conversations(id) ON DELETE CASCADE,
      tenant_id         UUID NOT NULL,
      action_id         TEXT NOT NULL,
      input             JSONB NOT NULL DEFAULT '{}',
      output            JSONB,
      status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('success', 'failure', 'pending')),
      error_message     TEXT,
      permissions_used  JSONB NOT NULL DEFAULT '[]',
      invoked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at      TIMESTAMPTZ
    )
  `;

  // ── RLS ──
  for (const table of ['conversations', 'messages', 'tool_invocations']) {
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

  // ── GRANTs for app role ──
  await adminSql`GRANT USAGE ON SCHEMA mod_ai TO rasid_app`;
  for (const table of ['conversations', 'messages', 'tool_invocations']) {
    await adminSql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON mod_ai.${table} TO rasid_app`,
    );
  }

  // ── Indexes ──
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant
    ON mod_ai.conversations (tenant_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
    ON mod_ai.conversations (tenant_id, user_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON mod_ai.messages (conversation_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant
    ON mod_ai.messages (tenant_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_invocations_conversation
    ON mod_ai.tool_invocations (conversation_id)
  `;
  await adminSql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_invocations_tenant
    ON mod_ai.tool_invocations (tenant_id)
  `;

  console.log(
    '[M21] mod_ai migration complete — 3 tables, 3 RLS policies.',
  );
}

// Self-execute when run directly
const isDirectRun =
  process.argv[1]?.endsWith('migrate.ts') ||
  process.argv[1]?.endsWith('migrate.js');

if (isDirectRun) {
  migrateModAiEngine()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[M21] Migration failed:', err);
      process.exit(1);
    });
}

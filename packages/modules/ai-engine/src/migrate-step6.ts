/**
 * M21 AI Engine — Guardrails Migration (Step 6)
 *
 * Creates guardrail_rules and guardrail_evaluations tables in mod_ai schema.
 * Enables RLS on both. No cross-schema foreign keys.
 * No modification to Kernel tables.
 */
import type postgres from 'postgres';

export async function migrateStep6(sql: postgres.Sql): Promise<void> {
  console.log('[M21-S6] Running Guardrails migration...');

  // ── guardrail_rules ──
  await sql`
    CREATE TABLE IF NOT EXISTS mod_ai.guardrail_rules (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      name          TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      kind          TEXT NOT NULL CHECK (kind IN ('input_validation', 'sensitivity_flag', 'require_confirmation', 'block')),
      action_pattern TEXT NOT NULL,
      condition     JSONB NOT NULL DEFAULT '{}'::jsonb,
      message       TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── guardrail_evaluations ──
  await sql`
    CREATE TABLE IF NOT EXISTS mod_ai.guardrail_evaluations (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      user_id        TEXT NOT NULL,
      action_id      TEXT NOT NULL,
      rule_id        TEXT NOT NULL,
      rule_name      TEXT NOT NULL,
      rule_kind      TEXT NOT NULL CHECK (rule_kind IN ('input_validation', 'sensitivity_flag', 'require_confirmation', 'block')),
      verdict        TEXT NOT NULL CHECK (verdict IN ('pass', 'flag', 'require_confirmation', 'block')),
      message        TEXT NOT NULL,
      input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── RLS ──
  await sql`ALTER TABLE mod_ai.guardrail_rules ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE mod_ai.guardrail_evaluations ENABLE ROW LEVEL SECURITY`;

  // Drop existing policies if any (idempotent)
  await sql`
    DO $$ BEGIN
      DROP POLICY IF EXISTS tenant_isolation ON mod_ai.guardrail_rules;
      DROP POLICY IF EXISTS tenant_isolation ON mod_ai.guardrail_evaluations;
    END $$
  `;

  await sql`
    CREATE POLICY tenant_isolation ON mod_ai.guardrail_rules
      USING (tenant_id = current_setting('app.current_tenant_id'))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id'))
  `;

  await sql`
    CREATE POLICY tenant_isolation ON mod_ai.guardrail_evaluations
      USING (tenant_id = current_setting('app.current_tenant_id'))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id'))
  `;

  // ── GRANTs ──
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON mod_ai.guardrail_rules TO rasid_app`;
  await sql`GRANT SELECT, INSERT ON mod_ai.guardrail_evaluations TO rasid_app`;

  // ── Indexes ──
  await sql`CREATE INDEX IF NOT EXISTS idx_guardrail_rules_tenant ON mod_ai.guardrail_rules (tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_guardrail_rules_pattern ON mod_ai.guardrail_rules (action_pattern)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_guardrail_evals_tenant ON mod_ai.guardrail_evaluations (tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_guardrail_evals_action ON mod_ai.guardrail_evaluations (action_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_guardrail_evals_rule ON mod_ai.guardrail_evaluations (rule_id)`;

  console.log('[M21-S6] ✓ Guardrails migration complete');
}

/**
 * M21 AI Engine — Proactive Engine Migration (Step 7)
 *
 * Creates proactive_rules and proactive_suggestions tables in mod_ai schema.
 * RLS enforced. No cross-schema foreign keys.
 */
import type postgres from 'postgres';

export async function migrateStep7(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`

    -- ══════════════════════════════════════════
    -- proactive_rules — defines what events trigger what suggestions
    -- ══════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS mod_ai.proactive_rules (
      id              UUID PRIMARY KEY,
      tenant_id       UUID NOT NULL,
      name            VARCHAR(255) NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      event_type      VARCHAR(255) NOT NULL,
      condition       JSONB NOT NULL DEFAULT '{}'::jsonb,
      suggestion_title_template VARCHAR(500) NOT NULL,
      suggestion_body_template  TEXT NOT NULL,
      suggested_action_id       VARCHAR(255),
      priority        VARCHAR(20) NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high')),
      status          VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'disabled')),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- RLS
    ALTER TABLE mod_ai.proactive_rules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE mod_ai.proactive_rules FORCE ROW LEVEL SECURITY;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'mod_ai' AND tablename = 'proactive_rules'
          AND policyname = 'tenant_isolation'
      ) THEN
        CREATE POLICY tenant_isolation ON mod_ai.proactive_rules
          USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    -- GRANTs
    GRANT SELECT, INSERT, UPDATE, DELETE ON mod_ai.proactive_rules TO rasid_app;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_proactive_rules_tenant
      ON mod_ai.proactive_rules (tenant_id);
    CREATE INDEX IF NOT EXISTS idx_proactive_rules_event_type
      ON mod_ai.proactive_rules (tenant_id, event_type)
      WHERE status = 'active';

    -- ══════════════════════════════════════════
    -- proactive_suggestions — generated suggestion records
    -- ══════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS mod_ai.proactive_suggestions (
      id                      UUID PRIMARY KEY,
      tenant_id               UUID NOT NULL,
      user_id                 UUID NOT NULL,
      rule_id                 UUID NOT NULL,
      event_id                VARCHAR(255) NOT NULL,
      title                   VARCHAR(500) NOT NULL,
      body                    TEXT NOT NULL,
      suggested_action_id     VARCHAR(255),
      suggested_action_input  JSONB,
      priority                VARCHAR(20) NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('low', 'medium', 'high')),
      status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'dismissed')),
      dismissed_at            TIMESTAMPTZ,
      accepted_at             TIMESTAMPTZ,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- RLS
    ALTER TABLE mod_ai.proactive_suggestions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE mod_ai.proactive_suggestions FORCE ROW LEVEL SECURITY;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'mod_ai' AND tablename = 'proactive_suggestions'
          AND policyname = 'tenant_isolation'
      ) THEN
        CREATE POLICY tenant_isolation ON mod_ai.proactive_suggestions
          USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    -- GRANTs
    GRANT SELECT, INSERT, UPDATE ON mod_ai.proactive_suggestions TO rasid_app;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_proactive_suggestions_tenant_status
      ON mod_ai.proactive_suggestions (tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_proactive_suggestions_user
      ON mod_ai.proactive_suggestions (tenant_id, user_id, status);

  `);
}

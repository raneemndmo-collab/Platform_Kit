/**
 * M31 Localization — Migration (Metadata Only)
 * No runtime translation engine.
 */
import type postgres from 'postgres';

export async function migrateLocalization(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS mod_localization;

    /* ── Languages ── */
    CREATE TABLE IF NOT EXISTS mod_localization.languages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      code        VARCHAR(10) NOT NULL,
      name        VARCHAR(100) NOT NULL,
      native_name VARCHAR(100) NOT NULL,
      direction   VARCHAR(3) NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr','rtl')),
      is_default  BOOLEAN NOT NULL DEFAULT false,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, code)
    );
    CREATE INDEX IF NOT EXISTS idx_l10n_languages_tenant ON mod_localization.languages(tenant_id);
    ALTER TABLE mod_localization.languages ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='languages' AND schemaname='mod_localization' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_localization.languages USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Translation Keys ── */
    CREATE TABLE IF NOT EXISTS mod_localization.translation_keys (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      namespace   VARCHAR(100) NOT NULL,
      key         VARCHAR(255) NOT NULL,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, namespace, key)
    );
    CREATE INDEX IF NOT EXISTS idx_l10n_keys_tenant ON mod_localization.translation_keys(tenant_id);
    ALTER TABLE mod_localization.translation_keys ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='translation_keys' AND schemaname='mod_localization' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_localization.translation_keys USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Translations ── */
    CREATE TABLE IF NOT EXISTS mod_localization.translations (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      key_id      UUID NOT NULL,
      language_id UUID NOT NULL,
      value       TEXT NOT NULL,
      is_reviewed BOOLEAN NOT NULL DEFAULT false,
      reviewed_by UUID,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, key_id, language_id)
    );
    CREATE INDEX IF NOT EXISTS idx_l10n_translations_tenant ON mod_localization.translations(tenant_id);
    ALTER TABLE mod_localization.translations ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='translations' AND schemaname='mod_localization' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_localization.translations USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── GRANTs ── */
    GRANT USAGE ON SCHEMA mod_localization TO rasid_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mod_localization TO rasid_app;
  `);
}

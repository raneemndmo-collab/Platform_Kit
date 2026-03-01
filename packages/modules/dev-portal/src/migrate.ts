/**
 * M32 Developer Portal — Migration (Metadata Only)
 * No external SDK publishing. No OpenAPI runtime generator.
 */
import type postgres from 'postgres';

export async function migrateDevPortal(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS mod_dev_portal;

    /* ── Portal API Keys ── */
    CREATE TABLE IF NOT EXISTS mod_dev_portal.api_keys (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id    UUID NOT NULL,
      name         VARCHAR(255) NOT NULL,
      key_prefix   VARCHAR(16) NOT NULL,
      key_hash     VARCHAR(128) NOT NULL,
      environment  VARCHAR(20) NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
      scopes       TEXT[] NOT NULL DEFAULT '{}',
      status       VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
      rate_limit   INT NOT NULL DEFAULT 1000,
      expires_at   TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ,
      created_by   UUID NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_portal_keys_tenant ON mod_dev_portal.api_keys(tenant_id);
    ALTER TABLE mod_dev_portal.api_keys ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND schemaname='mod_dev_portal' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_dev_portal.api_keys USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Usage Logs ── */
    CREATE TABLE IF NOT EXISTS mod_dev_portal.usage_logs (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id        UUID NOT NULL,
      api_key_id       UUID NOT NULL,
      endpoint         VARCHAR(500) NOT NULL,
      method           VARCHAR(10) NOT NULL,
      status_code      INT NOT NULL,
      response_time_ms INT NOT NULL DEFAULT 0,
      ip_address       VARCHAR(45),
      metadata         JSONB NOT NULL DEFAULT '{}',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_portal_logs_tenant ON mod_dev_portal.usage_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_portal_logs_key ON mod_dev_portal.usage_logs(api_key_id);
    ALTER TABLE mod_dev_portal.usage_logs ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usage_logs' AND schemaname='mod_dev_portal' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_dev_portal.usage_logs USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Doc Pages ── */
    CREATE TABLE IF NOT EXISTS mod_dev_portal.doc_pages (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id    UUID NOT NULL,
      slug         VARCHAR(200) NOT NULL,
      title        VARCHAR(255) NOT NULL,
      category     VARCHAR(100) NOT NULL,
      content_ref  VARCHAR(500),
      version      VARCHAR(20) NOT NULL DEFAULT '1.0',
      is_published BOOLEAN NOT NULL DEFAULT false,
      sort_order   INT NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, slug, version)
    );
    CREATE INDEX IF NOT EXISTS idx_portal_docs_tenant ON mod_dev_portal.doc_pages(tenant_id);
    ALTER TABLE mod_dev_portal.doc_pages ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='doc_pages' AND schemaname='mod_dev_portal' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_dev_portal.doc_pages USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Webhooks ── */
    CREATE TABLE IF NOT EXISTS mod_dev_portal.webhooks (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      name        VARCHAR(255) NOT NULL,
      url         VARCHAR(1000) NOT NULL,
      events      TEXT[] NOT NULL DEFAULT '{}',
      secret_hash VARCHAR(128) NOT NULL,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_by  UUID NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_portal_webhooks_tenant ON mod_dev_portal.webhooks(tenant_id);
    ALTER TABLE mod_dev_portal.webhooks ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='webhooks' AND schemaname='mod_dev_portal' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_dev_portal.webhooks USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── GRANTs ── */
    GRANT USAGE ON SCHEMA mod_dev_portal TO rasid_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mod_dev_portal TO rasid_app;
  `);
}

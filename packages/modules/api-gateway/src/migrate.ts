/**
 * M29 API Gateway Hardening — Migration (Metadata Only)
 */
import type postgres from 'postgres';

export async function migrateGateway(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS mod_gateway;

    CREATE TABLE IF NOT EXISTS mod_gateway.api_keys (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      name        VARCHAR(255) NOT NULL,
      key_prefix  VARCHAR(16) NOT NULL,
      key_hash    VARCHAR(128) NOT NULL,
      scopes      TEXT[] NOT NULL DEFAULT '{}',
      status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
      expires_at  TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ,
      created_by  UUID NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON mod_gateway.api_keys(tenant_id);
    ALTER TABLE mod_gateway.api_keys ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND schemaname='mod_gateway' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_gateway.api_keys USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS mod_gateway.ip_allowlist (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      cidr        VARCHAR(45) NOT NULL,
      label       VARCHAR(255) NOT NULL,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ip_allowlist_tenant ON mod_gateway.ip_allowlist(tenant_id);
    ALTER TABLE mod_gateway.ip_allowlist ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ip_allowlist' AND schemaname='mod_gateway' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_gateway.ip_allowlist USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS mod_gateway.rate_limit_configs (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id        UUID NOT NULL,
      name             VARCHAR(255) NOT NULL,
      endpoint_pattern VARCHAR(500) NOT NULL,
      max_requests     INT NOT NULL,
      window_seconds   INT NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT true,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_tenant ON mod_gateway.rate_limit_configs(tenant_id);
    ALTER TABLE mod_gateway.rate_limit_configs ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rate_limit_configs' AND schemaname='mod_gateway' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_gateway.rate_limit_configs USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    GRANT USAGE ON SCHEMA mod_gateway TO rasid_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mod_gateway TO rasid_app;
  `);
}

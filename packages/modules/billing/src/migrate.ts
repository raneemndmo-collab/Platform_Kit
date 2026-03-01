/**
 * M30 Billing / Licensing — Migration (Metadata Only)
 * No payment gateway. No invoice engine. No Stripe/PayPal.
 */
import type postgres from 'postgres';

export async function migrateBilling(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS mod_billing;

    /* ── Plans ── */
    CREATE TABLE IF NOT EXISTS mod_billing.plans (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id               UUID NOT NULL,
      name                    VARCHAR(255) NOT NULL,
      slug                    VARCHAR(100) NOT NULL,
      description             TEXT,
      tier                    VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free','starter','professional','enterprise')),
      max_users               INT NOT NULL DEFAULT 5,
      max_storage_mb          INT NOT NULL DEFAULT 100,
      max_api_calls_per_month INT NOT NULL DEFAULT 1000,
      features                JSONB NOT NULL DEFAULT '{}',
      is_active               BOOLEAN NOT NULL DEFAULT true,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_billing_plans_tenant ON mod_billing.plans(tenant_id);
    ALTER TABLE mod_billing.plans ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plans' AND schemaname='mod_billing' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_billing.plans USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Feature Flags ── */
    CREATE TABLE IF NOT EXISTS mod_billing.feature_flags (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      plan_id     UUID,
      key         VARCHAR(100) NOT NULL,
      label       VARCHAR(255) NOT NULL,
      description TEXT,
      is_enabled  BOOLEAN NOT NULL DEFAULT true,
      metadata    JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, key)
    );
    CREATE INDEX IF NOT EXISTS idx_billing_flags_tenant ON mod_billing.feature_flags(tenant_id);
    ALTER TABLE mod_billing.feature_flags ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feature_flags' AND schemaname='mod_billing' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_billing.feature_flags USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Usage Records ── */
    CREATE TABLE IF NOT EXISTS mod_billing.usage_records (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id   VARCHAR(255),
      quantity      NUMERIC NOT NULL DEFAULT 0,
      unit          VARCHAR(50) NOT NULL,
      period_start  TIMESTAMPTZ NOT NULL,
      period_end    TIMESTAMPTZ NOT NULL,
      recorded_by   UUID NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_billing_usage_tenant ON mod_billing.usage_records(tenant_id);
    ALTER TABLE mod_billing.usage_records ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usage_records' AND schemaname='mod_billing' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_billing.usage_records USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Quota Configs ── */
    CREATE TABLE IF NOT EXISTS mod_billing.quota_configs (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id        UUID NOT NULL,
      plan_id          UUID,
      resource_type    VARCHAR(100) NOT NULL,
      max_quantity     INT NOT NULL,
      unit             VARCHAR(50) NOT NULL,
      enforcement_mode VARCHAR(10) NOT NULL DEFAULT 'soft' CHECK (enforcement_mode IN ('soft','hard')),
      is_active        BOOLEAN NOT NULL DEFAULT true,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_billing_quota_tenant ON mod_billing.quota_configs(tenant_id);
    ALTER TABLE mod_billing.quota_configs ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quota_configs' AND schemaname='mod_billing' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_billing.quota_configs USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Subscriptions ── */
    CREATE TABLE IF NOT EXISTS mod_billing.subscriptions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      plan_id     UUID NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','trial')),
      started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at  TIMESTAMPTZ,
      metadata    JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_billing_subs_tenant ON mod_billing.subscriptions(tenant_id);
    ALTER TABLE mod_billing.subscriptions ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND schemaname='mod_billing' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_billing.subscriptions USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── GRANTs ── */
    GRANT USAGE ON SCHEMA mod_billing TO rasid_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mod_billing TO rasid_app;
  `);
}

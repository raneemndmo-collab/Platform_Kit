/**
 * M28 Backup & Recovery — Migration (Metadata Only)
 *
 * Creates mod_backup schema with retention_policies, backup_jobs, restore_points.
 * RLS tenant_isolation on all tables. No cross-schema foreign keys.
 */
import type postgres from 'postgres';

export async function migrateBackup(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS mod_backup;

    /* ── Retention Policies ── */
    CREATE TABLE IF NOT EXISTS mod_backup.retention_policies (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID NOT NULL,
      name          VARCHAR(255) NOT NULL,
      description   TEXT,
      retention_days INT NOT NULL DEFAULT 30,
      max_backups   INT NOT NULL DEFAULT 10,
      target_type   VARCHAR(20) NOT NULL DEFAULT 'full'
                    CHECK (target_type IN ('full','schema','table','tenant')),
      target_ref    VARCHAR(255),
      is_active     BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant
      ON mod_backup.retention_policies(tenant_id);

    ALTER TABLE mod_backup.retention_policies ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='retention_policies' AND schemaname='mod_backup' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_backup.retention_policies USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Backup Jobs ── */
    CREATE TABLE IF NOT EXISTS mod_backup.backup_jobs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID NOT NULL,
      policy_id     UUID,
      label         VARCHAR(255) NOT NULL,
      target_type   VARCHAR(20) NOT NULL DEFAULT 'full'
                    CHECK (target_type IN ('full','schema','table','tenant')),
      target_ref    VARCHAR(255),
      status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','failed')),
      size_bytes    BIGINT,
      metadata      JSONB NOT NULL DEFAULT '{}',
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ,
      error_message TEXT,
      created_by    UUID NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_backup_jobs_tenant
      ON mod_backup.backup_jobs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_backup_jobs_status
      ON mod_backup.backup_jobs(tenant_id, status);

    ALTER TABLE mod_backup.backup_jobs ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='backup_jobs' AND schemaname='mod_backup' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_backup.backup_jobs USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── Restore Points ── */
    CREATE TABLE IF NOT EXISTS mod_backup.restore_points (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID NOT NULL,
      backup_job_id   UUID NOT NULL,
      label           VARCHAR(255) NOT NULL,
      status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','completed','failed')),
      metadata        JSONB NOT NULL DEFAULT '{}',
      requested_by    UUID NOT NULL,
      requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at    TIMESTAMPTZ,
      error_message   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_restore_points_tenant
      ON mod_backup.restore_points(tenant_id);

    ALTER TABLE mod_backup.restore_points ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restore_points' AND schemaname='mod_backup' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON mod_backup.restore_points USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
      END IF;
    END $$;

    /* ── GRANTs ── */
    GRANT USAGE ON SCHEMA mod_backup TO rasid_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mod_backup TO rasid_app;
  `);
}

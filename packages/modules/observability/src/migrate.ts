/**
 * M27 — Observability Layer Migration
 *
 * Creates mod_observability schema with RLS-enabled tables.
 * Isolated from kernel schema — no FK to kernel tables.
 * No cross-schema foreign keys.
 * Metrics stored in DB tables only — no external monitoring.
 */
import 'dotenv/config';
import { adminSql } from '../../../kernel/src/index.js';

export async function migrateModObservability(): Promise<void> {
  console.log('[M27] Running mod_observability migration...');

  // ── Create schema ──
  await adminSql`CREATE SCHEMA IF NOT EXISTS mod_observability`;

  // ── metrics ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_observability.metrics (
      id              UUID PRIMARY KEY,
      tenant_id       UUID NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT DEFAULT '',
      metric_type     TEXT NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
      labels          JSONB NOT NULL DEFAULT '[]',
      unit            TEXT DEFAULT '',
      retention_days  INT NOT NULL DEFAULT 90,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── alerts ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_observability.alerts (
      id          UUID PRIMARY KEY,
      tenant_id   UUID NOT NULL,
      metric_id   UUID NOT NULL REFERENCES mod_observability.metrics(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      condition   TEXT NOT NULL CHECK (condition IN ('gt', 'gte', 'lt', 'lte', 'eq', 'neq')),
      threshold   DOUBLE PRECISION NOT NULL,
      channels    JSONB NOT NULL DEFAULT '[]',
      status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'silenced', 'disabled')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── alert_history ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_observability.alert_history (
      id              UUID PRIMARY KEY,
      alert_id        UUID NOT NULL REFERENCES mod_observability.alerts(id) ON DELETE CASCADE,
      tenant_id       UUID NOT NULL,
      value           DOUBLE PRECISION NOT NULL,
      status          TEXT NOT NULL DEFAULT 'fired' CHECK (status IN ('fired', 'acknowledged', 'resolved')),
      fired_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      acknowledged_at TIMESTAMPTZ,
      resolved_at     TIMESTAMPTZ
    )
  `;

  // ── slo_definitions ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_observability.slo_definitions (
      id              UUID PRIMARY KEY,
      tenant_id       UUID NOT NULL,
      name            TEXT NOT NULL,
      service         TEXT NOT NULL,
      metric_id       UUID NOT NULL REFERENCES mod_observability.metrics(id) ON DELETE CASCADE,
      target_percent  DOUBLE PRECISION NOT NULL CHECK (target_percent >= 0 AND target_percent <= 100),
      window_days     INT NOT NULL DEFAULT 30,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── status_incidents ──
  await adminSql`
    CREATE TABLE IF NOT EXISTS mod_observability.status_incidents (
      id          UUID PRIMARY KEY,
      tenant_id   UUID NOT NULL,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      severity    TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
      status      TEXT NOT NULL DEFAULT 'investigating'
                  CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
      started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ,
      created_by  UUID NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // ── Indexes ──
  await adminSql`CREATE INDEX IF NOT EXISTS idx_obs_metrics_tenant ON mod_observability.metrics(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_obs_alerts_tenant ON mod_observability.alerts(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_obs_alerts_metric ON mod_observability.alerts(metric_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_obs_alert_history_tenant ON mod_observability.alert_history(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_obs_alert_history_alert ON mod_observability.alert_history(alert_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_obs_slo_tenant ON mod_observability.slo_definitions(tenant_id)`;
  await adminSql`CREATE INDEX IF NOT EXISTS idx_obs_incidents_tenant ON mod_observability.status_incidents(tenant_id)`;

  // ── RLS ──
  const tables = ['metrics', 'alerts', 'alert_history', 'slo_definitions', 'status_incidents'];
  for (const t of tables) {
    await adminSql`${adminSql.unsafe(`ALTER TABLE mod_observability.${t} ENABLE ROW LEVEL SECURITY`)}`;
    await adminSql`${adminSql.unsafe(`ALTER TABLE mod_observability.${t} FORCE ROW LEVEL SECURITY`)}`;
    // Drop existing policy to avoid conflict on re-run
    await adminSql`${adminSql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON mod_observability.${t}`)}`;
    await adminSql`${adminSql.unsafe(`
      CREATE POLICY tenant_isolation ON mod_observability.${t}
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    `)}`;
  }

  // ── GRANTs ──
  const appRole = process.env.DB_APP_ROLE || 'rasid_app';
  await adminSql`${adminSql.unsafe(`GRANT USAGE ON SCHEMA mod_observability TO ${appRole}`)}`;
  for (const t of tables) {
    await adminSql`${adminSql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON mod_observability.${t} TO ${appRole}`)}`;
  }

  console.log('[M27] mod_observability migration complete.');
}

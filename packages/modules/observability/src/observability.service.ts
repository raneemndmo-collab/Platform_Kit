/**
 * M27 Observability Layer — Service
 *
 * Data operations for metrics, alerts, SLOs, incidents.
 * All writes called from K3 action handlers only.
 * Schema: mod_observability — no cross-schema queries.
 * No external monitoring services. Metrics stored in DB tables only.
 */
import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type {
  Metric, Alert, AlertHistoryEntry, SloDefinition, StatusIncident,
  CreateMetricInput, UpdateMetricInput,
  CreateAlertInput, UpdateAlertInput,
  CreateSloInput, UpdateSloInput,
  CreateIncidentInput, UpdateIncidentInput,
} from './observability.types.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export class ObservabilityService {

  /* ═══════════════════════════════════════════
   * METRICS
   * ═══════════════════════════════════════════ */

  async listMetrics(sql: Sql, tenantId: string): Promise<Metric[]> {
    const rows = await sql`
      SELECT * FROM mod_observability.metrics
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map(this.mapMetric);
  }

  async getMetric(sql: Sql, tenantId: string, id: string): Promise<Metric | null> {
    const rows = await sql`
      SELECT * FROM mod_observability.metrics
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapMetric(rows[0]) : null;
  }

  async createMetric(
    sql: Sql, tenantId: string, input: CreateMetricInput,
  ): Promise<Metric> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_observability.metrics
        (id, tenant_id, name, description, metric_type, labels, unit, retention_days, created_at, updated_at)
      VALUES (
        ${id}, ${tenantId}, ${input.name}, ${input.description || ''},
        ${input.metric_type},
        ${JSON.stringify(input.labels || [])}::jsonb,
        ${input.unit || ''}, ${input.retention_days || 90},
        ${now}, ${now}
      )
      RETURNING *
    `;
    return this.mapMetric(rows[0]);
  }

  async updateMetric(
    sql: Sql, tenantId: string, id: string, input: UpdateMetricInput,
  ): Promise<Metric | null> {
    const existing = await this.getMetric(sql, tenantId, id);
    if (!existing) return null;
    const rows = await sql`
      UPDATE mod_observability.metrics SET
        description    = ${input.description ?? existing.description},
        labels         = ${JSON.stringify(input.labels ?? existing.labels)}::jsonb,
        unit           = ${input.unit ?? existing.unit},
        retention_days = ${input.retention_days ?? existing.retention_days},
        updated_at     = ${new Date().toISOString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return rows.length ? this.mapMetric(rows[0]) : null;
  }

  async deleteMetric(sql: Sql, tenantId: string, id: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM mod_observability.metrics
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return result.count > 0;
  }

  /* ═══════════════════════════════════════════
   * ALERTS
   * ═══════════════════════════════════════════ */

  async listAlerts(sql: Sql, tenantId: string): Promise<Alert[]> {
    const rows = await sql`
      SELECT * FROM mod_observability.alerts
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map(this.mapAlert);
  }

  async getAlert(sql: Sql, tenantId: string, id: string): Promise<Alert | null> {
    const rows = await sql`
      SELECT * FROM mod_observability.alerts
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapAlert(rows[0]) : null;
  }

  async createAlert(
    sql: Sql, tenantId: string, input: CreateAlertInput,
  ): Promise<Alert> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_observability.alerts
        (id, tenant_id, metric_id, name, condition, threshold, channels, status, created_at, updated_at)
      VALUES (
        ${id}, ${tenantId}, ${input.metric_id}, ${input.name},
        ${input.condition}, ${input.threshold},
        ${JSON.stringify(input.channels || [])}::jsonb,
        'active', ${now}, ${now}
      )
      RETURNING *
    `;
    return this.mapAlert(rows[0]);
  }

  async updateAlert(
    sql: Sql, tenantId: string, id: string, input: UpdateAlertInput,
  ): Promise<Alert | null> {
    const existing = await this.getAlert(sql, tenantId, id);
    if (!existing) return null;
    const rows = await sql`
      UPDATE mod_observability.alerts SET
        name       = ${input.name ?? existing.name},
        condition  = ${input.condition ?? existing.condition},
        threshold  = ${input.threshold ?? existing.threshold},
        channels   = ${JSON.stringify(input.channels ?? existing.channels)}::jsonb,
        status     = ${input.status ?? existing.status},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return rows.length ? this.mapAlert(rows[0]) : null;
  }

  async deleteAlert(sql: Sql, tenantId: string, id: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM mod_observability.alerts
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return result.count > 0;
  }

  /* ═══════════════════════════════════════════
   * ALERT HISTORY
   * ═══════════════════════════════════════════ */

  async listAlertHistory(
    sql: Sql, tenantId: string, alertId?: string,
  ): Promise<AlertHistoryEntry[]> {
    if (alertId) {
      const rows = await sql`
        SELECT * FROM mod_observability.alert_history
        WHERE tenant_id = ${tenantId} AND alert_id = ${alertId}
        ORDER BY fired_at DESC
      `;
      return rows.map(this.mapAlertHistory);
    }
    const rows = await sql`
      SELECT * FROM mod_observability.alert_history
      WHERE tenant_id = ${tenantId}
      ORDER BY fired_at DESC
    `;
    return rows.map(this.mapAlertHistory);
  }

  async fireAlert(
    sql: Sql, tenantId: string, alertId: string, value: number,
  ): Promise<AlertHistoryEntry> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_observability.alert_history
        (id, alert_id, tenant_id, value, status, fired_at)
      VALUES (${id}, ${alertId}, ${tenantId}, ${value}, 'fired', ${now})
      RETURNING *
    `;
    return this.mapAlertHistory(rows[0]);
  }

  async acknowledgeAlert(
    sql: Sql, tenantId: string, historyId: string,
  ): Promise<AlertHistoryEntry | null> {
    const rows = await sql`
      UPDATE mod_observability.alert_history SET
        status = 'acknowledged',
        acknowledged_at = ${new Date().toISOString()}
      WHERE id = ${historyId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return rows.length ? this.mapAlertHistory(rows[0]) : null;
  }

  async resolveAlertHistory(
    sql: Sql, tenantId: string, historyId: string,
  ): Promise<AlertHistoryEntry | null> {
    const rows = await sql`
      UPDATE mod_observability.alert_history SET
        status = 'resolved',
        resolved_at = ${new Date().toISOString()}
      WHERE id = ${historyId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return rows.length ? this.mapAlertHistory(rows[0]) : null;
  }

  /* ═══════════════════════════════════════════
   * SLO DEFINITIONS
   * ═══════════════════════════════════════════ */

  async listSlos(sql: Sql, tenantId: string): Promise<SloDefinition[]> {
    const rows = await sql`
      SELECT * FROM mod_observability.slo_definitions
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map(this.mapSlo);
  }

  async getSlo(sql: Sql, tenantId: string, id: string): Promise<SloDefinition | null> {
    const rows = await sql`
      SELECT * FROM mod_observability.slo_definitions
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapSlo(rows[0]) : null;
  }

  async createSlo(
    sql: Sql, tenantId: string, input: CreateSloInput,
  ): Promise<SloDefinition> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_observability.slo_definitions
        (id, tenant_id, name, service, metric_id, target_percent, window_days, created_at, updated_at)
      VALUES (
        ${id}, ${tenantId}, ${input.name}, ${input.service},
        ${input.metric_id}, ${input.target_percent},
        ${input.window_days || 30}, ${now}, ${now}
      )
      RETURNING *
    `;
    return this.mapSlo(rows[0]);
  }

  async updateSlo(
    sql: Sql, tenantId: string, id: string, input: UpdateSloInput,
  ): Promise<SloDefinition | null> {
    const existing = await this.getSlo(sql, tenantId, id);
    if (!existing) return null;
    const rows = await sql`
      UPDATE mod_observability.slo_definitions SET
        name           = ${input.name ?? existing.name},
        target_percent = ${input.target_percent ?? existing.target_percent},
        window_days    = ${input.window_days ?? existing.window_days},
        updated_at     = ${new Date().toISOString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return rows.length ? this.mapSlo(rows[0]) : null;
  }

  async deleteSlo(sql: Sql, tenantId: string, id: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM mod_observability.slo_definitions
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return result.count > 0;
  }

  /* ═══════════════════════════════════════════
   * STATUS INCIDENTS
   * ═══════════════════════════════════════════ */

  async listIncidents(sql: Sql, tenantId: string): Promise<StatusIncident[]> {
    const rows = await sql`
      SELECT * FROM mod_observability.status_incidents
      WHERE tenant_id = ${tenantId}
      ORDER BY started_at DESC
    `;
    return rows.map(this.mapIncident);
  }

  async getIncident(
    sql: Sql, tenantId: string, id: string,
  ): Promise<StatusIncident | null> {
    const rows = await sql`
      SELECT * FROM mod_observability.status_incidents
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapIncident(rows[0]) : null;
  }

  async createIncident(
    sql: Sql, tenantId: string, userId: string, input: CreateIncidentInput,
  ): Promise<StatusIncident> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_observability.status_incidents
        (id, tenant_id, title, description, severity, status, started_at, created_by, updated_at)
      VALUES (
        ${id}, ${tenantId}, ${input.title}, ${input.description || ''},
        ${input.severity}, 'investigating', ${now}, ${userId}, ${now}
      )
      RETURNING *
    `;
    return this.mapIncident(rows[0]);
  }

  async updateIncident(
    sql: Sql, tenantId: string, id: string, input: UpdateIncidentInput,
  ): Promise<StatusIncident | null> {
    const existing = await this.getIncident(sql, tenantId, id);
    if (!existing) return null;
    const resolvedAt = input.status === 'resolved' && existing.status !== 'resolved'
      ? new Date().toISOString()
      : existing.resolved_at;
    const rows = await sql`
      UPDATE mod_observability.status_incidents SET
        title       = ${input.title ?? existing.title},
        description = ${input.description ?? existing.description},
        severity    = ${input.severity ?? existing.severity},
        status      = ${input.status ?? existing.status},
        resolved_at = ${resolvedAt},
        updated_at  = ${new Date().toISOString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return rows.length ? this.mapIncident(rows[0]) : null;
  }

  /* ═══════════════════════════════════════════
   * MAPPERS
   * ═══════════════════════════════════════════ */

  private mapMetric(r: Record<string, unknown>): Metric {
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      name: String(r.name),
      description: String(r.description ?? ''),
      metric_type: String(r.metric_type) as Metric['metric_type'],
      labels: Array.isArray(r.labels) ? r.labels.map(String) : [],
      unit: String(r.unit ?? ''),
      retention_days: Number(r.retention_days),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }

  private mapAlert(r: Record<string, unknown>): Alert {
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      metric_id: String(r.metric_id),
      name: String(r.name),
      condition: String(r.condition) as Alert['condition'],
      threshold: Number(r.threshold),
      channels: Array.isArray(r.channels) ? r.channels.map(String) : [],
      status: String(r.status) as Alert['status'],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }

  private mapAlertHistory(r: Record<string, unknown>): AlertHistoryEntry {
    return {
      id: String(r.id),
      alert_id: String(r.alert_id),
      tenant_id: String(r.tenant_id),
      value: Number(r.value),
      status: String(r.status) as AlertHistoryEntry['status'],
      fired_at: String(r.fired_at),
      acknowledged_at: r.acknowledged_at ? String(r.acknowledged_at) : null,
      resolved_at: r.resolved_at ? String(r.resolved_at) : null,
    };
  }

  private mapSlo(r: Record<string, unknown>): SloDefinition {
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      name: String(r.name),
      service: String(r.service),
      metric_id: String(r.metric_id),
      target_percent: Number(r.target_percent),
      window_days: Number(r.window_days),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }

  private mapIncident(r: Record<string, unknown>): StatusIncident {
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      title: String(r.title),
      description: String(r.description ?? ''),
      severity: String(r.severity) as StatusIncident['severity'],
      status: String(r.status) as StatusIncident['status'],
      started_at: String(r.started_at),
      resolved_at: r.resolved_at ? String(r.resolved_at) : null,
      created_by: String(r.created_by),
      updated_at: String(r.updated_at),
    };
  }
}

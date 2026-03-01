/**
 * M27 Observability Layer — Type Definitions
 *
 * Log aggregation metadata, structured logging, metrics in DB tables.
 * No external monitoring integration. Metrics stored in DB tables only.
 * Schema: mod_observability
 */

/* ── Metric ── */
export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface Metric {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  metric_type: MetricType;
  labels: string[];
  unit: string;
  retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMetricInput {
  name: string;
  description?: string;
  metric_type: MetricType;
  labels?: string[];
  unit?: string;
  retention_days?: number;
}

export interface UpdateMetricInput {
  description?: string;
  labels?: string[];
  unit?: string;
  retention_days?: number;
}

/* ── Alert ── */
export type AlertStatus = 'active' | 'silenced' | 'disabled';
export type AlertCondition = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

export interface Alert {
  id: string;
  tenant_id: string;
  metric_id: string;
  name: string;
  condition: AlertCondition;
  threshold: number;
  channels: string[];
  status: AlertStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertInput {
  metric_id: string;
  name: string;
  condition: AlertCondition;
  threshold: number;
  channels?: string[];
}

export interface UpdateAlertInput {
  name?: string;
  condition?: AlertCondition;
  threshold?: number;
  channels?: string[];
  status?: AlertStatus;
}

/* ── Alert History ── */
export type AlertHistoryStatus = 'fired' | 'acknowledged' | 'resolved';

export interface AlertHistoryEntry {
  id: string;
  alert_id: string;
  tenant_id: string;
  value: number;
  status: AlertHistoryStatus;
  fired_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

/* ── SLO ── */
export interface SloDefinition {
  id: string;
  tenant_id: string;
  name: string;
  service: string;
  metric_id: string;
  target_percent: number;
  window_days: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSloInput {
  name: string;
  service: string;
  metric_id: string;
  target_percent: number;
  window_days?: number;
}

export interface UpdateSloInput {
  name?: string;
  target_percent?: number;
  window_days?: number;
}

/* ── Status Incident ── */
export type IncidentSeverity = 'minor' | 'major' | 'critical';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface StatusIncident {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  started_at: string;
  resolved_at: string | null;
  created_by: string;
  updated_at: string;
}

export interface CreateIncidentInput {
  title: string;
  description?: string;
  severity: IncidentSeverity;
}

export interface UpdateIncidentInput {
  title?: string;
  description?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
}

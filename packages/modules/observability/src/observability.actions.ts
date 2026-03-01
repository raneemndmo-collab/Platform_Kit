/**
 * M27 Observability Layer — K3 Action Registration
 *
 * Every operation registered as a K3 action via registerAction(manifest, handler).
 * Handler signature: (input, ctx, sql) matching ActionHandler type.
 * Schema: mod_observability — no cross-schema queries.
 * No external monitoring. Metrics in DB tables only.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { ObservabilityService } from './observability.service.js';
import { ValidationError } from '@rasid/shared';
import {
  createMetricSchema, updateMetricSchema,
  createAlertSchema, updateAlertSchema,
  createSloSchema, updateSloSchema,
  createIncidentSchema, updateIncidentSchema,
} from './observability.schema.js';
import type {
  CreateMetricInput, UpdateMetricInput,
  CreateAlertInput, UpdateAlertInput,
  CreateSloInput, UpdateSloInput,
  CreateIncidentInput, UpdateIncidentInput,
} from './observability.types.js';

const svc = new ObservabilityService();

export function registerObservabilityActions() {

  /* ═══════════════════════════════════════════
   * METRICS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.metric.list',
      display_name: 'List Metrics',
      module_id: 'mod_observability',
      verb: 'read',
      resource: 'obs_metrics',
      input_schema: { type: 'object', properties: {} },
      output_schema: {},
      required_permissions: ['obs_metrics.read'],
      sensitivity: 'low',
    },
    async (_input, ctx, sql) => {
      const data = await svc.listMetrics(sql, ctx.tenantId);
      return { data, object_id: null, object_type: 'obs_metric', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.metric.get',
      display_name: 'Get Metric',
      module_id: 'mod_observability',
      verb: 'read',
      resource: 'obs_metrics',
      input_schema: { type: 'object', properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['obs_metrics.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const data = await svc.getMetric(sql, ctx.tenantId, String(input.id));
      if (!data) throw new ValidationError('Metric not found');
      return { data, object_id: data.id, object_type: 'obs_metric', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.metric.create',
      display_name: 'Create Metric',
      module_id: 'mod_observability',
      verb: 'create',
      resource: 'obs_metrics',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_metrics.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const parsed = createMetricSchema.parse(input) as CreateMetricInput;
      const data = await svc.createMetric(sql, ctx.tenantId, parsed);
      return { data, object_id: data.id, object_type: 'obs_metric', before: null, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.metric.update',
      display_name: 'Update Metric',
      module_id: 'mod_observability',
      verb: 'update',
      resource: 'obs_metrics',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_metrics.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & UpdateMetricInput;
      const parsed = updateMetricSchema.parse(rest) as UpdateMetricInput;
      const before = await svc.getMetric(sql, ctx.tenantId, id);
      if (!before) throw new ValidationError('Metric not found');
      const data = await svc.updateMetric(sql, ctx.tenantId, id, parsed);
      return { data, object_id: id, object_type: 'obs_metric', before, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.metric.delete',
      display_name: 'Delete Metric',
      module_id: 'mod_observability',
      verb: 'delete',
      resource: 'obs_metrics',
      input_schema: { type: 'object', properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['obs_metrics.delete'],
      sensitivity: 'high',
    },
    async (input, ctx, sql) => {
      const before = await svc.getMetric(sql, ctx.tenantId, String(input.id));
      if (!before) throw new ValidationError('Metric not found');
      await svc.deleteMetric(sql, ctx.tenantId, String(input.id));
      return { data: { deleted: true }, object_id: String(input.id), object_type: 'obs_metric', before, after: null };
    },
  );

  /* ═══════════════════════════════════════════
   * ALERTS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.alert.list',
      display_name: 'List Alerts',
      module_id: 'mod_observability',
      verb: 'read',
      resource: 'obs_alerts',
      input_schema: { type: 'object', properties: {} },
      output_schema: {},
      required_permissions: ['obs_alerts.read'],
      sensitivity: 'low',
    },
    async (_input, ctx, sql) => {
      const data = await svc.listAlerts(sql, ctx.tenantId);
      return { data, object_id: null, object_type: 'obs_alert', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.alert.create',
      display_name: 'Create Alert',
      module_id: 'mod_observability',
      verb: 'create',
      resource: 'obs_alerts',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_alerts.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const parsed = createAlertSchema.parse(input) as CreateAlertInput;
      const data = await svc.createAlert(sql, ctx.tenantId, parsed);
      return { data, object_id: data.id, object_type: 'obs_alert', before: null, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.alert.update',
      display_name: 'Update Alert',
      module_id: 'mod_observability',
      verb: 'update',
      resource: 'obs_alerts',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_alerts.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & UpdateAlertInput;
      const parsed = updateAlertSchema.parse(rest) as UpdateAlertInput;
      const before = await svc.getAlert(sql, ctx.tenantId, id);
      if (!before) throw new ValidationError('Alert not found');
      const data = await svc.updateAlert(sql, ctx.tenantId, id, parsed);
      return { data, object_id: id, object_type: 'obs_alert', before, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.alert.delete',
      display_name: 'Delete Alert',
      module_id: 'mod_observability',
      verb: 'delete',
      resource: 'obs_alerts',
      input_schema: { type: 'object', properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['obs_alerts.delete'],
      sensitivity: 'high',
    },
    async (input, ctx, sql) => {
      const before = await svc.getAlert(sql, ctx.tenantId, String(input.id));
      if (!before) throw new ValidationError('Alert not found');
      await svc.deleteAlert(sql, ctx.tenantId, String(input.id));
      return { data: { deleted: true }, object_id: String(input.id), object_type: 'obs_alert', before, after: null };
    },
  );

  /* ═══════════════════════════════════════════
   * ALERT HISTORY
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.alert.fire',
      display_name: 'Fire Alert',
      module_id: 'mod_observability',
      verb: 'create',
      resource: 'obs_alert_history',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_alert_history.create'],
      sensitivity: 'high',
    },
    async (input, ctx, sql) => {
      const alertId = String(input.alert_id);
      const value = Number(input.value);
      if (!alertId || isNaN(value)) throw new ValidationError('alert_id and value required');
      const data = await svc.fireAlert(sql, ctx.tenantId, alertId, value);
      return { data, object_id: data.id, object_type: 'obs_alert_history', before: null, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.alert.acknowledge',
      display_name: 'Acknowledge Alert',
      module_id: 'mod_observability',
      verb: 'update',
      resource: 'obs_alert_history',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_alert_history.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = await svc.acknowledgeAlert(sql, ctx.tenantId, String(input.id));
      if (!data) throw new ValidationError('Alert history entry not found');
      return { data, object_id: data.id, object_type: 'obs_alert_history', before: null, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.alert.resolve',
      display_name: 'Resolve Alert',
      module_id: 'mod_observability',
      verb: 'update',
      resource: 'obs_alert_history',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_alert_history.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = await svc.resolveAlertHistory(sql, ctx.tenantId, String(input.id));
      if (!data) throw new ValidationError('Alert history entry not found');
      return { data, object_id: data.id, object_type: 'obs_alert_history', before: null, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.alert.history',
      display_name: 'List Alert History',
      module_id: 'mod_observability',
      verb: 'read',
      resource: 'obs_alert_history',
      input_schema: { type: 'object', properties: {} },
      output_schema: {},
      required_permissions: ['obs_alert_history.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const alertId = input.alert_id ? String(input.alert_id) : undefined;
      const data = await svc.listAlertHistory(sql, ctx.tenantId, alertId);
      return { data, object_id: null, object_type: 'obs_alert_history', before: null, after: null };
    },
  );

  /* ═══════════════════════════════════════════
   * SLO DEFINITIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.slo.list',
      display_name: 'List SLOs',
      module_id: 'mod_observability',
      verb: 'read',
      resource: 'obs_slos',
      input_schema: { type: 'object', properties: {} },
      output_schema: {},
      required_permissions: ['obs_slos.read'],
      sensitivity: 'low',
    },
    async (_input, ctx, sql) => {
      const data = await svc.listSlos(sql, ctx.tenantId);
      return { data, object_id: null, object_type: 'obs_slo', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.slo.create',
      display_name: 'Create SLO',
      module_id: 'mod_observability',
      verb: 'create',
      resource: 'obs_slos',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_slos.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const parsed = createSloSchema.parse(input) as CreateSloInput;
      const data = await svc.createSlo(sql, ctx.tenantId, parsed);
      return { data, object_id: data.id, object_type: 'obs_slo', before: null, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.slo.update',
      display_name: 'Update SLO',
      module_id: 'mod_observability',
      verb: 'update',
      resource: 'obs_slos',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_slos.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & UpdateSloInput;
      const parsed = updateSloSchema.parse(rest) as UpdateSloInput;
      const before = await svc.getSlo(sql, ctx.tenantId, id);
      if (!before) throw new ValidationError('SLO not found');
      const data = await svc.updateSlo(sql, ctx.tenantId, id, parsed);
      return { data, object_id: id, object_type: 'obs_slo', before, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.slo.delete',
      display_name: 'Delete SLO',
      module_id: 'mod_observability',
      verb: 'delete',
      resource: 'obs_slos',
      input_schema: { type: 'object', properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['obs_slos.delete'],
      sensitivity: 'high',
    },
    async (input, ctx, sql) => {
      const before = await svc.getSlo(sql, ctx.tenantId, String(input.id));
      if (!before) throw new ValidationError('SLO not found');
      await svc.deleteSlo(sql, ctx.tenantId, String(input.id));
      return { data: { deleted: true }, object_id: String(input.id), object_type: 'obs_slo', before, after: null };
    },
  );

  /* ═══════════════════════════════════════════
   * STATUS INCIDENTS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.incident.list',
      display_name: 'List Incidents',
      module_id: 'mod_observability',
      verb: 'read',
      resource: 'obs_incidents',
      input_schema: { type: 'object', properties: {} },
      output_schema: {},
      required_permissions: ['obs_incidents.read'],
      sensitivity: 'low',
    },
    async (_input, ctx, sql) => {
      const data = await svc.listIncidents(sql, ctx.tenantId);
      return { data, object_id: null, object_type: 'obs_incident', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.incident.create',
      display_name: 'Create Incident',
      module_id: 'mod_observability',
      verb: 'create',
      resource: 'obs_incidents',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_incidents.create'],
      sensitivity: 'high',
    },
    async (input, ctx, sql) => {
      const parsed = createIncidentSchema.parse(input) as CreateIncidentInput;
      const data = await svc.createIncident(sql, ctx.tenantId, ctx.userId, parsed);
      return { data, object_id: data.id, object_type: 'obs_incident', before: null, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.incident.update',
      display_name: 'Update Incident',
      module_id: 'mod_observability',
      verb: 'update',
      resource: 'obs_incidents',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_incidents.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & UpdateIncidentInput;
      const parsed = updateIncidentSchema.parse(rest) as UpdateIncidentInput;
      const before = await svc.getIncident(sql, ctx.tenantId, id);
      if (!before) throw new ValidationError('Incident not found');
      const data = await svc.updateIncident(sql, ctx.tenantId, id, parsed);
      return { data, object_id: id, object_type: 'obs_incident', before, after: data };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.observability.incident.resolve',
      display_name: 'Resolve Incident',
      module_id: 'mod_observability',
      verb: 'update',
      resource: 'obs_incidents',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['obs_incidents.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const before = await svc.getIncident(sql, ctx.tenantId, String(input.id));
      if (!before) throw new ValidationError('Incident not found');
      const data = await svc.updateIncident(sql, ctx.tenantId, String(input.id), { status: 'resolved' });
      return { data, object_id: String(input.id), object_type: 'obs_incident', before, after: data };
    },
  );
}

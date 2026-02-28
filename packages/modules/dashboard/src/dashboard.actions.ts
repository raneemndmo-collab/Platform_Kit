/**
 * M9 Dashboard Engine -- K3 Action Registration
 *
 * Every operation is registered as a K3 action via registerAction(manifest, handler).
 * Each handler returns ActionHandlerResult for audit + event pipeline.
 * Handler signature: (input, ctx, sql) matching ActionHandler type.
 * Dashboard is read-only consumer of semantic layer -- no cross-schema queries.
 * Schema: mod_dashboard
 */

import { actionRegistry } from '../../../kernel/src/action-registry/action-registry.service.js';
import { DashboardService } from './dashboard.service.js';
import { ValidationError } from '@rasid/shared';
import {
  createDashboardSchema, updateDashboardSchema,
  addWidgetSchema, updateWidgetSchema, shareDashboardSchema,
} from './dashboard.schema.js';
import type {
  CreateDashboardInput, UpdateDashboardInput,
  AddWidgetInput, UpdateWidgetInput, ShareDashboardInput,
} from './dashboard.types.js';

const svc = new DashboardService();

export function registerDashboardActions() {

  // ═══════════════════════════════════════════
  // DASHBOARD CRUD
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.list',
      display_name: 'List Dashboards',
      module_id: 'mod_dashboard',
      verb: 'read',
      resource: 'dashboards',
      input_schema: { type: 'object', properties: {} },
      output_schema: {},
      required_permissions: ['dashboards.read'],
      sensitivity: 'low',
    },
    async (_input, ctx, sql) => {
      const data = await svc.listDashboards(sql, ctx.tenantId);
      return {
        data,
        object_id: null,
        object_type: 'dashboard',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.get',
      display_name: 'Get Dashboard',
      module_id: 'mod_dashboard',
      verb: 'read',
      resource: 'dashboards',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboards.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const data = await svc.getDashboard(sql, ctx.tenantId, id);
      return {
        data,
        object_id: id,
        object_type: 'dashboard',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.create',
      display_name: 'Create Dashboard',
      module_id: 'mod_dashboard',
      verb: 'create',
      resource: 'dashboards',
      input_schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboards.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const parsed = createDashboardSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const data = parsed.data as CreateDashboardInput;
      const dashboard = await svc.createDashboard(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: dashboard,
        object_id: dashboard.id,
        object_type: 'dashboard',
        before: null,
        after: dashboard,
        event_type: 'rasid.mod.dashboard.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.update',
      display_name: 'Update Dashboard',
      module_id: 'mod_dashboard',
      verb: 'update',
      resource: 'dashboards',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboards.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      const parsed = updateDashboardSchema.safeParse(rest);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const dashboard = await svc.updateDashboard(sql, ctx.tenantId, id, parsed.data as UpdateDashboardInput);
      return {
        data: dashboard,
        object_id: dashboard.id,
        object_type: 'dashboard',
        before: null,
        after: dashboard,
        event_type: 'rasid.mod.dashboard.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.delete',
      display_name: 'Delete Dashboard',
      module_id: 'mod_dashboard',
      verb: 'delete',
      resource: 'dashboards',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboards.delete'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      await svc.deleteDashboard(sql, ctx.tenantId, id);
      return {
        data: null,
        object_id: id,
        object_type: 'dashboard',
        before: null,
        after: null,
        event_type: 'rasid.mod.dashboard.deleted',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.publish',
      display_name: 'Publish Dashboard',
      module_id: 'mod_dashboard',
      verb: 'update',
      resource: 'dashboards',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboards.publish'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const dashboard = await svc.publishDashboard(sql, ctx.tenantId, id);
      return {
        data: dashboard,
        object_id: dashboard.id,
        object_type: 'dashboard',
        before: null,
        after: dashboard,
        event_type: 'rasid.mod.dashboard.published',
      };
    },
  );

  // ═══════════════════════════════════════════
  // WIDGET CRUD
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.widget.list',
      display_name: 'List Dashboard Widgets',
      module_id: 'mod_dashboard',
      verb: 'read',
      resource: 'dashboard_widgets',
      input_schema: { type: 'object', required: ['dashboard_id'], properties: { dashboard_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboard_widgets.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { dashboard_id } = input as { dashboard_id: string };
      const data = await svc.listWidgets(sql, ctx.tenantId, dashboard_id);
      return {
        data,
        object_id: null,
        object_type: 'dashboard_widget',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.widget.get',
      display_name: 'Get Dashboard Widget',
      module_id: 'mod_dashboard',
      verb: 'read',
      resource: 'dashboard_widgets',
      input_schema: { type: 'object', required: ['widget_id'], properties: { widget_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboard_widgets.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { widget_id } = input as { widget_id: string };
      const data = await svc.getWidget(sql, ctx.tenantId, widget_id);
      return {
        data,
        object_id: widget_id,
        object_type: 'dashboard_widget',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.widget.add',
      display_name: 'Add Widget to Dashboard',
      module_id: 'mod_dashboard',
      verb: 'create',
      resource: 'dashboard_widgets',
      input_schema: { type: 'object', required: ['dashboard_id', 'input'], properties: { dashboard_id: { type: 'string' }, input: { type: 'object' } } },
      output_schema: {},
      required_permissions: ['dashboard_widgets.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { dashboard_id, input: widgetInput } = input as { dashboard_id: string; input: Record<string, unknown> };
      const parsed = addWidgetSchema.safeParse(widgetInput);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const widget = await svc.addWidget(sql, ctx.tenantId, dashboard_id, parsed.data as AddWidgetInput);
      return {
        data: widget,
        object_id: widget.id,
        object_type: 'dashboard_widget',
        before: null,
        after: widget,
        event_type: 'rasid.mod.dashboard.widget.added',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.widget.update',
      display_name: 'Update Dashboard Widget',
      module_id: 'mod_dashboard',
      verb: 'update',
      resource: 'dashboard_widgets',
      input_schema: { type: 'object', required: ['widget_id'], properties: { widget_id: { type: 'string' }, input: { type: 'object' } } },
      output_schema: {},
      required_permissions: ['dashboard_widgets.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { widget_id, input: widgetInput } = input as { widget_id: string; input: Record<string, unknown> };
      const parsed = updateWidgetSchema.safeParse(widgetInput);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const widget = await svc.updateWidget(sql, ctx.tenantId, widget_id, parsed.data as UpdateWidgetInput);
      return {
        data: widget,
        object_id: widget.id,
        object_type: 'dashboard_widget',
        before: null,
        after: widget,
        event_type: 'rasid.mod.dashboard.widget.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.widget.remove',
      display_name: 'Remove Dashboard Widget',
      module_id: 'mod_dashboard',
      verb: 'delete',
      resource: 'dashboard_widgets',
      input_schema: { type: 'object', required: ['widget_id'], properties: { widget_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboard_widgets.delete'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { widget_id } = input as { widget_id: string };
      await svc.removeWidget(sql, ctx.tenantId, widget_id);
      return {
        data: null,
        object_id: widget_id,
        object_type: 'dashboard_widget',
        before: null,
        after: null,
        event_type: 'rasid.mod.dashboard.widget.removed',
      };
    },
  );

  // ═══════════════════════════════════════════
  // WIDGET DATA QUERY (via semantic layer)
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.widget.query',
      display_name: 'Query Widget Data',
      module_id: 'mod_dashboard',
      verb: 'read',
      resource: 'dashboard_widgets',
      input_schema: { type: 'object', required: ['widget_id'], properties: { widget_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboard_widgets.query'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { widget_id } = input as { widget_id: string };
      const data = await svc.queryWidgetData(sql, ctx.tenantId, widget_id);
      return {
        data,
        object_id: widget_id,
        object_type: 'dashboard_widget',
        before: null,
        after: null,
        event_type: 'rasid.mod.dashboard.widget.queried',
      };
    },
  );

  // ═══════════════════════════════════════════
  // SHARING
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.share',
      display_name: 'Share Dashboard',
      module_id: 'mod_dashboard',
      verb: 'update',
      resource: 'dashboards',
      input_schema: { type: 'object', required: ['dashboard_id', 'input'], properties: { dashboard_id: { type: 'string' }, input: { type: 'object' } } },
      output_schema: {},
      required_permissions: ['dashboards.share'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { dashboard_id, input: shareInput } = input as { dashboard_id: string; input: Record<string, unknown> };
      const parsed = shareDashboardSchema.safeParse(shareInput);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const share = await svc.shareDashboard(sql, ctx.tenantId, dashboard_id, parsed.data as ShareDashboardInput);
      return {
        data: share,
        object_id: share.id,
        object_type: 'shared_dashboard',
        before: null,
        after: share,
        event_type: 'rasid.mod.dashboard.shared',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.share.list',
      display_name: 'List Dashboard Shares',
      module_id: 'mod_dashboard',
      verb: 'read',
      resource: 'dashboards',
      input_schema: { type: 'object', required: ['dashboard_id'], properties: { dashboard_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboards.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { dashboard_id } = input as { dashboard_id: string };
      const data = await svc.listShares(sql, ctx.tenantId, dashboard_id);
      return {
        data,
        object_id: null,
        object_type: 'shared_dashboard',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.dashboard.share.remove',
      display_name: 'Remove Dashboard Share',
      module_id: 'mod_dashboard',
      verb: 'update',
      resource: 'dashboards',
      input_schema: { type: 'object', required: ['share_id'], properties: { share_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['dashboards.share'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { share_id } = input as { share_id: string };
      await svc.removeShare(sql, ctx.tenantId, share_id);
      return {
        data: null,
        object_id: share_id,
        object_type: 'shared_dashboard',
        before: null,
        after: null,
        event_type: 'rasid.mod.dashboard.share.removed',
      };
    },
  );
}

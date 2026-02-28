/**
 * M10 Reports Engine — K3 Action Registration
 *
 * Metadata-driven report definitions + simulated execution.
 * All actions registered via K3 pipeline for RBAC + audit.
 * Handler signature: (input, ctx, sql) matching ActionHandler type.
 * Schema: mod_reports
 */

import { actionRegistry } from '../../../kernel/src/action-registry/action-registry.service.js';
import { ReportsService } from './reports.service.js';
import { ValidationError } from '@rasid/shared';
import {
  createReportSchema, updateReportSchema, executeReportSchema,
} from './reports.schema.js';
import type { CreateReportInput, UpdateReportInput } from './reports.types.js';

const svc = new ReportsService();

export function registerReportsActions() {

  // ═══════════════════════════════════════
  // Report Definition CRUD
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.report.create',
      display_name: 'Create Report Definition',
      module_id: 'mod_reports',
      verb: 'create',
      resource: 'reports',
      input_schema: { type: 'object', required: ['name', 'report_type', 'data_source'] },
      output_schema: {},
      required_permissions: ['reports.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const parsed = createReportSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const report = await svc.createReport(sql, ctx.tenantId, ctx.userId, parsed.data as CreateReportInput);
      return {
        data: report,
        object_id: report.id,
        object_type: 'report_definition',
        before: null,
        after: report,
        event_type: 'rasid.mod.reports.report.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.report.list',
      display_name: 'List Reports',
      module_id: 'mod_reports',
      verb: 'read',
      resource: 'reports',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['reports.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const data = await svc.listReports(sql, ctx.tenantId);
      return {
        data,
        object_id: null,
        object_type: 'report_definition',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.report.get',
      display_name: 'Get Report Definition',
      module_id: 'mod_reports',
      verb: 'read',
      resource: 'reports',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['reports.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const data = await svc.getReport(sql, ctx.tenantId, id);
      return {
        data,
        object_id: id,
        object_type: 'report_definition',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.report.update',
      display_name: 'Update Report Definition',
      module_id: 'mod_reports',
      verb: 'update',
      resource: 'reports',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['reports.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      const parsed = updateReportSchema.safeParse(rest);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const report = await svc.updateReport(sql, ctx.tenantId, id, parsed.data as UpdateReportInput);
      return {
        data: report,
        object_id: report.id,
        object_type: 'report_definition',
        before: null,
        after: report,
        event_type: 'rasid.mod.reports.report.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.report.publish',
      display_name: 'Publish Report',
      module_id: 'mod_reports',
      verb: 'update',
      resource: 'reports',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['reports.publish'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const report = await svc.publishReport(sql, ctx.tenantId, id);
      return {
        data: report,
        object_id: report.id,
        object_type: 'report_definition',
        before: null,
        after: report,
        event_type: 'rasid.mod.reports.report.published',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.report.archive',
      display_name: 'Archive Report',
      module_id: 'mod_reports',
      verb: 'update',
      resource: 'reports',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['reports.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const report = await svc.archiveReport(sql, ctx.tenantId, id);
      return {
        data: report,
        object_id: report.id,
        object_type: 'report_definition',
        before: null,
        after: report,
        event_type: 'rasid.mod.reports.report.archived',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.report.delete',
      display_name: 'Delete Report',
      module_id: 'mod_reports',
      verb: 'delete',
      resource: 'reports',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['reports.delete'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      await svc.deleteReport(sql, ctx.tenantId, id);
      return {
        data: null,
        object_id: id,
        object_type: 'report_definition',
        before: null,
        after: null,
        event_type: 'rasid.mod.reports.report.deleted',
      };
    },
  );

  // ═══════════════════════════════════════
  // Report Execution (simulated)
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.report.execute',
      display_name: 'Execute Report',
      module_id: 'mod_reports',
      verb: 'create',
      resource: 'report_runs',
      input_schema: { type: 'object', required: ['report_id'] },
      output_schema: {},
      required_permissions: ['report_runs.execute'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { report_id, ...rest } = input as { report_id: string } & Record<string, unknown>;
      const parsed = executeReportSchema.safeParse(rest);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const output = await svc.executeReport(sql, ctx.tenantId, ctx.userId, report_id, parsed.data.parameters || {});
      return {
        data: output,
        object_id: report_id,
        object_type: 'report_run',
        before: null,
        after: output,
        event_type: 'rasid.mod.reports.report.executed',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.run.list',
      display_name: 'List Report Runs',
      module_id: 'mod_reports',
      verb: 'read',
      resource: 'report_runs',
      input_schema: { type: 'object', required: ['report_id'] },
      output_schema: {},
      required_permissions: ['report_runs.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { report_id } = input as { report_id: string };
      const data = await svc.getRunHistory(sql, ctx.tenantId, report_id);
      return {
        data,
        object_id: null,
        object_type: 'report_run',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.reports.run.get',
      display_name: 'Get Report Run',
      module_id: 'mod_reports',
      verb: 'read',
      resource: 'report_runs',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['report_runs.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const data = await svc.getRun(sql, ctx.tenantId, id);
      return {
        data,
        object_id: id,
        object_type: 'report_run',
        before: null,
        after: null,
      };
    },
  );
}

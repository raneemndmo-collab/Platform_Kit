/**
 * M13 — Custom Tables Action Handlers
 *
 * Registers all mutation actions with K3 Action Registry.
 * Each handler returns ActionHandlerResult for audit + event emission.
 */

import { actionRegistry } from '../../../kernel/src/index.js';
import { CustomTablesService } from './custom-tables.service.js';
import type {
  CreateCustomTableInput,
  UpdateCustomTableInput,
  CreateRowInput,
  UpdateRowInput,
} from './custom-tables.types.js';

const service = new CustomTablesService();

export function registerCustomTableActions(): void {

  /* ═══════════════════════════════════════════
   * TABLE ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.connectors.table.create',
      display_name: 'Create Custom Table',
      module_id: 'mod_connectors',
      verb: 'create',
      resource: 'custom_tables',
      input_schema: {
        type: 'object',
        required: ['name', 'display_name', 'columns'],
        properties: {
          name: { type: 'string' },
          display_name: { type: 'string' },
          columns: { type: 'array' },
        },
      },
      output_schema: {},
      required_permissions: ['custom_tables.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as CreateCustomTableInput;
      const table = await service.createTable(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: table,
        object_id: table.id,
        object_type: 'custom_table',
        before: null,
        after: table,
        event_type: 'rasid.mod.connectors.table.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.connectors.table.update',
      display_name: 'Update Custom Table',
      module_id: 'mod_connectors',
      verb: 'update',
      resource: 'custom_tables',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['custom_tables.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as UpdateCustomTableInput;
      const before = await service.getTable(sql, id);
      const table = await service.updateTable(sql, id, rest);
      return {
        data: table,
        object_id: table.id,
        object_type: 'custom_table',
        before,
        after: table,
        event_type: 'rasid.mod.connectors.table.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.connectors.table.delete',
      display_name: 'Delete Custom Table',
      module_id: 'mod_connectors',
      verb: 'delete',
      resource: 'custom_tables',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['custom_tables.delete'],
      sensitivity: 'critical',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const before = await service.getTable(sql, id);
      await service.deleteTable(sql, id);
      return {
        data: null,
        object_id: id,
        object_type: 'custom_table',
        before,
        after: null,
        event_type: 'rasid.mod.connectors.table.deleted',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * ROW ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.connectors.table.row.create',
      display_name: 'Create Row',
      module_id: 'mod_connectors',
      verb: 'create',
      resource: 'custom_table_rows',
      input_schema: {
        type: 'object',
        required: ['table_id', 'row_data'],
        properties: {
          table_id: { type: 'string' },
          row_data: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['custom_table_rows.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as CreateRowInput;
      const row = await service.createRow(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: row,
        object_id: row.id,
        object_type: 'custom_table_row',
        before: null,
        after: row,
        event_type: 'rasid.mod.connectors.table.row.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.connectors.table.row.update',
      display_name: 'Update Row',
      module_id: 'mod_connectors',
      verb: 'update',
      resource: 'custom_table_rows',
      input_schema: {
        type: 'object',
        required: ['id', 'table_id', 'row_data'],
        properties: {
          id: { type: 'string' },
          table_id: { type: 'string' },
          row_data: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['custom_table_rows.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as UpdateRowInput;
      const before = await service.getRow(sql, data.id);
      const row = await service.updateRow(sql, ctx.userId, data);
      return {
        data: row,
        object_id: row.id,
        object_type: 'custom_table_row',
        before,
        after: row,
        event_type: 'rasid.mod.connectors.table.row.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.connectors.table.row.delete',
      display_name: 'Delete Row',
      module_id: 'mod_connectors',
      verb: 'delete',
      resource: 'custom_table_rows',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['custom_table_rows.delete'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const before = await service.getRow(sql, id);
      await service.deleteRow(sql, id);
      return {
        data: null,
        object_id: id,
        object_type: 'custom_table_row',
        before,
        after: null,
        event_type: 'rasid.mod.connectors.table.row.deleted',
      };
    },
  );
}

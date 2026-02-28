/**
 * M13 — Data Connectors + Custom Tables
 *
 * Phase 2 module. Schema: mod_connectors.
 * Public exports: types, interface, routes, action registration.
 */

export type {
  ColumnDefinition,
  CustomTableStatus,
  CustomTable,
  CustomTableRow,
  CreateCustomTableInput,
  UpdateCustomTableInput,
  CreateRowInput,
  UpdateRowInput,
} from './custom-tables.types.js';

export type { ICustomTablesService } from './custom-tables.interface.js';

export { customTablesRoutes } from './custom-tables.routes.js';
export { registerCustomTableActions } from './custom-tables.actions.js';

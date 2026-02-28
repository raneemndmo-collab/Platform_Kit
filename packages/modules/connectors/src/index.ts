/**
 * M13 — Data Connectors + Custom Tables
 *
 * Phase 2 module. Schema: mod_connectors.
 *
 * Exports a RasidModule contract object for automatic discovery
 * by the kernel module-loader. No hardcoded wiring needed in server.ts.
 */

import type { RasidModule } from '@rasid/shared';
import { customTablesRoutes } from './custom-tables.routes.js';
import { registerCustomTableActions } from './custom-tables.actions.js';

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

/**
 * Module Contract — the single entry point consumed by module-loader.
 */
export const rasidModule: RasidModule = {
  id: 'mod_connectors',
  name: 'Custom Tables (Data Studio)',
  routes: customTablesRoutes,
  registerActions: registerCustomTableActions,
};

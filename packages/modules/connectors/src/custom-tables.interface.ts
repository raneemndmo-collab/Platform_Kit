/**
 * M13 — Custom Tables Interface
 *
 * Defines the public contract for the Custom Tables service.
 * All mutations are routed through K3.executeAction() at the route level;
 * this interface describes the underlying data operations.
 */

import type postgres from 'postgres';
import type {
  CustomTable,
  CustomTableRow,
  CreateCustomTableInput,
  UpdateCustomTableInput,
  CreateRowInput,
  UpdateRowInput,
} from './custom-tables.types.js';

export interface ICustomTablesService {
  /* ── Table operations ── */
  createTable(sql: postgres.Sql | postgres.ReservedSql, tenantId: string, userId: string, input: CreateCustomTableInput): Promise<CustomTable>;
  getTable(sql: postgres.Sql | postgres.ReservedSql, tableId: string): Promise<CustomTable | null>;
  listTables(sql: postgres.Sql | postgres.ReservedSql, tenantId: string, status?: string): Promise<CustomTable[]>;
  updateTable(sql: postgres.Sql | postgres.ReservedSql, tableId: string, input: Omit<UpdateCustomTableInput, 'id'>): Promise<CustomTable>;
  deleteTable(sql: postgres.Sql | postgres.ReservedSql, tableId: string): Promise<void>;

  /* ── Row operations ── */
  createRow(sql: postgres.Sql | postgres.ReservedSql, tenantId: string, userId: string, input: CreateRowInput): Promise<CustomTableRow>;
  getRow(sql: postgres.Sql | postgres.ReservedSql, rowId: string): Promise<CustomTableRow | null>;
  listRows(sql: postgres.Sql | postgres.ReservedSql, tableId: string, limit?: number, offset?: number): Promise<CustomTableRow[]>;
  updateRow(sql: postgres.Sql | postgres.ReservedSql, userId: string, input: UpdateRowInput): Promise<CustomTableRow>;
  deleteRow(sql: postgres.Sql | postgres.ReservedSql, rowId: string): Promise<void>;
}

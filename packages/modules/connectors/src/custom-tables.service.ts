/**
 * M13 — Custom Tables Service
 *
 * Data operations for custom tables and rows.
 * All writes are called from K3 action handlers (not directly from routes).
 * Schema: mod_connectors
 */

import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import { ConflictError } from '@rasid/shared';
import type { ICustomTablesService } from './custom-tables.interface.js';
import type {
  CustomTable,
  CustomTableRow,
  CreateCustomTableInput,
  UpdateCustomTableInput,
  CreateRowInput,
  UpdateRowInput,
} from './custom-tables.types.js';

export class CustomTablesService implements ICustomTablesService {

  /* ═══════════════════════════════════════════
   * TABLE OPERATIONS
   * ═══════════════════════════════════════════ */

  async createTable(
    sql: postgres.Sql | postgres.ReservedSql,
    tenantId: string,
    userId: string,
    input: CreateCustomTableInput,
  ): Promise<CustomTable> {
    const id = uuidv7();
    const now = new Date().toISOString();
    try {
      const [row] = await sql`
        INSERT INTO mod_connectors.custom_tables
          (id, tenant_id, name, display_name, description, columns, status, created_by, created_at, updated_at)
        VALUES
          (${id}, ${tenantId}, ${input.name}, ${input.display_name},
           ${input.description ?? null}, ${JSON.stringify(input.columns)},
           'draft', ${userId}, ${now}, ${now})
        RETURNING *
      `;
      return this.mapTable(row);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError(`Custom table with name '${input.name}' already exists`);
      }
      throw err;
    }
  }

  async getTable(
    sql: postgres.Sql | postgres.ReservedSql,
    tableId: string,
  ): Promise<CustomTable | null> {
    const [row] = await sql`
      SELECT * FROM mod_connectors.custom_tables WHERE id = ${tableId}
    `;
    return row ? this.mapTable(row) : null;
  }

  async listTables(
    sql: postgres.Sql | postgres.ReservedSql,
    tenantId: string,
    status?: string,
  ): Promise<CustomTable[]> {
    const rows = status
      ? await sql`
          SELECT * FROM mod_connectors.custom_tables
          WHERE tenant_id = ${tenantId} AND status = ${status}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT * FROM mod_connectors.custom_tables
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC
        `;
    return rows.map((r) => this.mapTable(r));
  }

  async updateTable(
    sql: postgres.Sql | postgres.ReservedSql,
    tableId: string,
    input: Omit<UpdateCustomTableInput, 'id'>,
  ): Promise<CustomTable> {
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_connectors.custom_tables SET
        display_name = COALESCE(${input.display_name ?? null}, display_name),
        description  = COALESCE(${input.description ?? null}, description),
        columns      = COALESCE(${input.columns ? JSON.stringify(input.columns) : null}, columns),
        status       = COALESCE(${input.status ?? null}, status),
        updated_at   = ${now}
      WHERE id = ${tableId}
      RETURNING *
    `;
    return this.mapTable(row);
  }

  async deleteTable(
    sql: postgres.Sql | postgres.ReservedSql,
    tableId: string,
  ): Promise<void> {
    await sql`DELETE FROM mod_connectors.custom_table_rows WHERE table_id = ${tableId}`;
    await sql`DELETE FROM mod_connectors.custom_tables WHERE id = ${tableId}`;
  }

  /* ═══════════════════════════════════════════
   * ROW OPERATIONS
   * ═══════════════════════════════════════════ */

  async createRow(
    sql: postgres.Sql | postgres.ReservedSql,
    tenantId: string,
    userId: string,
    input: CreateRowInput,
  ): Promise<CustomTableRow> {
    const id = uuidv7();
    const now = new Date().toISOString();

    // Get next row_order
    const [maxRow] = await sql`
      SELECT COALESCE(MAX(row_order), 0) + 1 AS next_order
      FROM mod_connectors.custom_table_rows
      WHERE table_id = ${input.table_id}
    `;

    const [row] = await sql`
      INSERT INTO mod_connectors.custom_table_rows
        (id, table_id, tenant_id, row_data, row_order, created_by, updated_by, created_at, updated_at)
      VALUES
        (${id}, ${input.table_id}, ${tenantId},
         ${JSON.stringify(input.row_data)}, ${maxRow.next_order},
         ${userId}, ${null}, ${now}, ${now})
      RETURNING *
    `;
    return this.mapRow(row);
  }

  async getRow(
    sql: postgres.Sql | postgres.ReservedSql,
    rowId: string,
  ): Promise<CustomTableRow | null> {
    const [row] = await sql`
      SELECT * FROM mod_connectors.custom_table_rows WHERE id = ${rowId}
    `;
    return row ? this.mapRow(row) : null;
  }

  async listRows(
    sql: postgres.Sql | postgres.ReservedSql,
    tableId: string,
    limit = 100,
    offset = 0,
  ): Promise<CustomTableRow[]> {
    const rows = await sql`
      SELECT * FROM mod_connectors.custom_table_rows
      WHERE table_id = ${tableId}
      ORDER BY row_order ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows.map((r) => this.mapRow(r));
  }

  async updateRow(
    sql: postgres.Sql | postgres.ReservedSql,
    userId: string,
    input: UpdateRowInput,
  ): Promise<CustomTableRow> {
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_connectors.custom_table_rows SET
        row_data   = ${JSON.stringify(input.row_data)},
        updated_by = ${userId},
        updated_at = ${now}
      WHERE id = ${input.id}
      RETURNING *
    `;
    return this.mapRow(row);
  }

  async deleteRow(
    sql: postgres.Sql | postgres.ReservedSql,
    rowId: string,
  ): Promise<void> {
    await sql`DELETE FROM mod_connectors.custom_table_rows WHERE id = ${rowId}`;
  }

  /* ── Mappers ── */

  private mapTable(row: Record<string, unknown>): CustomTable {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      display_name: row.display_name as string,
      description: row.description as string | null,
      columns: typeof row.columns === 'string' ? JSON.parse(row.columns) : row.columns,
      status: row.status as CustomTable['status'],
      created_by: row.created_by as string,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapRow(row: Record<string, unknown>): CustomTableRow {
    return {
      id: row.id as string,
      table_id: row.table_id as string,
      tenant_id: row.tenant_id as string,
      row_data: typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data,
      row_order: Number(row.row_order),
      created_by: row.created_by as string,
      updated_by: row.updated_by as string | null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }
}

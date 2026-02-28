/**
 * M13 — Custom Tables (Data Studio) — Type Definitions
 *
 * Phase 2, Module tier.
 * Schema: mod_connectors
 * No Kernel modification. All mutations via K3 pipeline.
 */

/* ── Column definition stored in custom_tables.columns JSONB ── */
export interface ColumnDefinition {
  name: string;
  display_name: string;
  data_type: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select';
  required: boolean;
  options?: string[];          // only for 'select' type
  default_value?: unknown;
}

/* ── Custom Table ── */
export type CustomTableStatus = 'draft' | 'active' | 'archived';

export interface CustomTable {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  description: string | null;
  columns: ColumnDefinition[];
  status: CustomTableStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomTableInput {
  name: string;
  display_name: string;
  description?: string;
  columns: ColumnDefinition[];
}

export interface UpdateCustomTableInput {
  id: string;
  display_name?: string;
  description?: string;
  columns?: ColumnDefinition[];
  status?: CustomTableStatus;
}

/* ── Custom Table Row ── */
export interface CustomTableRow {
  id: string;
  table_id: string;
  tenant_id: string;
  row_data: Record<string, unknown>;
  row_order: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRowInput {
  table_id: string;
  row_data: Record<string, unknown>;
}

export interface UpdateRowInput {
  id: string;
  table_id: string;
  row_data: Record<string, unknown>;
}

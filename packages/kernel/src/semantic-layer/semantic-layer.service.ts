/** K8 — Semantic Data Layer service (Phase 1) */

import type { Sql } from 'postgres';
import { randomUUID } from 'crypto';
import type { ISemanticLayer } from './semantic-layer.interface.js';
import type {
  Dataset,
  DatasetField,
  Metric,
  RegisterDatasetInput,
  UpdateDatasetInput,
  DefineMetricInput,
  DatasetSchema,
  SemanticQueryInput,
  ResultSet,
  QueryFilter,
} from './semantic-layer.types.js';
import { NotFoundError, ConflictError, ValidationError } from '@rasid/shared';

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? '');
}

function toDataset(row: Record<string, unknown>): Dataset {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    display_name: String(row.display_name),
    description: row.description ? String(row.description) : null,
    source_type: String(row.source_type) as Dataset['source_type'],
    source_config: (row.source_config ?? {}) as Record<string, unknown>,
    status: String(row.status) as Dataset['status'],
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function toField(row: Record<string, unknown>): DatasetField {
  return {
    id: String(row.id),
    dataset_id: String(row.dataset_id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    display_name: String(row.display_name),
    data_type: String(row.data_type) as DatasetField['data_type'],
    is_dimension: Boolean(row.is_dimension),
    is_metric: Boolean(row.is_metric),
    expression: row.expression ? String(row.expression) : null,
    description: row.description ? String(row.description) : null,
    ordinal: Number(row.ordinal ?? 0),
    created_at: toIso(row.created_at),
  };
}

function toMetric(row: Record<string, unknown>): Metric {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    dataset_id: String(row.dataset_id),
    name: String(row.name),
    display_name: String(row.display_name),
    expression: String(row.expression),
    aggregation: String(row.aggregation) as Metric['aggregation'],
    dimensions: Array.isArray(row.dimensions) ? row.dimensions as string[] : [],
    description: row.description ? String(row.description) : null,
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export class SemanticLayerService implements ISemanticLayer {

  async registerDataset(
    sql: Sql, tenantId: string, userId: string, input: RegisterDatasetInput,
  ): Promise<Dataset> {
    const id = randomUUID();
    const now = new Date().toISOString();

    // Check duplicate name
    const existing = await sql`
      SELECT id FROM kernel.datasets WHERE tenant_id = ${tenantId} AND name = ${input.name}
    `;
    if (existing.length > 0) {
      throw new ConflictError(`Dataset "${input.name}" already exists`);
    }

    // Validate at least one field
    if (!input.fields || input.fields.length === 0) {
      throw new ValidationError('At least one field is required');
    }

    // Insert dataset
    const rows = await sql`
      INSERT INTO kernel.datasets (id, tenant_id, name, display_name, description, source_type, source_config, status, created_by, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${input.name}, ${input.display_name}, ${input.description ?? null}, ${input.source_type}, ${JSON.stringify(input.source_config ?? {})}, 'draft', ${userId}, ${now}, ${now})
      RETURNING *
    `;

    // Insert fields
    for (let i = 0; i < input.fields.length; i++) {
      const field = input.fields[i];
      if (!field) continue;
      await sql`
        INSERT INTO kernel.dataset_fields (id, dataset_id, tenant_id, name, display_name, data_type, is_dimension, is_metric, expression, description, ordinal, created_at)
        VALUES (${randomUUID()}, ${id}, ${tenantId}, ${field.name}, ${field.display_name}, ${field.data_type}, ${field.is_dimension ?? false}, ${field.is_metric ?? false}, ${field.expression ?? null}, ${field.description ?? null}, ${field.ordinal ?? i}, ${now})
      `;
    }

    const row = rows[0];
    if (!row) throw new Error('Failed to insert dataset');
    return toDataset(row);
  }

  async getDataset(sql: Sql, id: string): Promise<Dataset | null> {
    const rows = await sql`SELECT * FROM kernel.datasets WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    return toDataset(row);
  }

  async listDatasets(sql: Sql, _tenantId: string, status?: string): Promise<Dataset[]> {
    if (status) {
      const rows = await sql`
        SELECT * FROM kernel.datasets WHERE status = ${status} ORDER BY created_at DESC
      `;
      return rows.map(toDataset);
    }
    const rows = await sql`SELECT * FROM kernel.datasets ORDER BY created_at DESC`;
    return rows.map(toDataset);
  }

  async updateDataset(sql: Sql, id: string, input: UpdateDatasetInput): Promise<Dataset> {
    const existing = await sql`SELECT * FROM kernel.datasets WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Dataset not found');

    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE kernel.datasets SET
        display_name = COALESCE(${input.display_name ?? null}, display_name),
        description = COALESCE(${input.description ?? null}, description),
        source_config = COALESCE(${input.source_config ? JSON.stringify(input.source_config) : null}::jsonb, source_config),
        status = COALESCE(${input.status ?? null}, status),
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError('Dataset not found');
    return toDataset(row);
  }

  async deleteDataset(sql: Sql, id: string): Promise<void> {
    const existing = await sql`SELECT id FROM kernel.datasets WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Dataset not found');
    await sql`DELETE FROM kernel.metrics WHERE dataset_id = ${id}`;
    await sql`DELETE FROM kernel.dataset_fields WHERE dataset_id = ${id}`;
    await sql`DELETE FROM kernel.datasets WHERE id = ${id}`;
  }

  async getSchema(sql: Sql, datasetId: string): Promise<DatasetSchema> {
    const ds = await sql`SELECT * FROM kernel.datasets WHERE id = ${datasetId}`;
    const dsRow = ds[0];
    if (!dsRow) throw new NotFoundError('Dataset not found');

    const fields = await sql`
      SELECT * FROM kernel.dataset_fields WHERE dataset_id = ${datasetId} ORDER BY ordinal ASC
    `;
    const mets = await sql`
      SELECT * FROM kernel.metrics WHERE dataset_id = ${datasetId} ORDER BY created_at ASC
    `;

    return {
      dataset_id: datasetId,
      name: String(dsRow.name),
      fields: fields.map(toField),
      metrics: mets.map(toMetric),
    };
  }

  async defineMetric(
    sql: Sql, tenantId: string, userId: string, datasetId: string, input: DefineMetricInput,
  ): Promise<Metric> {
    // Verify dataset exists
    const ds = await sql`SELECT id FROM kernel.datasets WHERE id = ${datasetId}`;
    if (ds.length === 0) throw new NotFoundError('Dataset not found');

    // Check duplicate
    const existing = await sql`
      SELECT id FROM kernel.metrics WHERE tenant_id = ${tenantId} AND dataset_id = ${datasetId} AND name = ${input.name}
    `;
    if (existing.length > 0) throw new ConflictError(`Metric "${input.name}" already exists`);

    // Validate dimensions reference actual fields
    if (input.dimensions && input.dimensions.length > 0) {
      const fields = await sql`
        SELECT name FROM kernel.dataset_fields WHERE dataset_id = ${datasetId} AND is_dimension = true
      `;
      const dimNames = new Set(fields.map((f) => String(f.name)));
      for (const d of input.dimensions) {
        if (!dimNames.has(d)) {
          throw new ValidationError(`Dimension "${d}" is not a dimension field in this dataset`);
        }
      }
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO kernel.metrics (id, tenant_id, dataset_id, name, display_name, expression, aggregation, dimensions, description, created_by, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${datasetId}, ${input.name}, ${input.display_name}, ${input.expression}, ${input.aggregation}, ${JSON.stringify(input.dimensions ?? [])}, ${input.description ?? null}, ${userId}, ${now}, ${now})
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error('Failed to insert metric');
    return toMetric(row);
  }

  async listMetrics(sql: Sql, datasetId: string): Promise<Metric[]> {
    const rows = await sql`
      SELECT * FROM kernel.metrics WHERE dataset_id = ${datasetId} ORDER BY created_at ASC
    `;
    return rows.map(toMetric);
  }

  async deleteMetric(sql: Sql, metricId: string): Promise<void> {
    const existing = await sql`SELECT id FROM kernel.metrics WHERE id = ${metricId}`;
    if (existing.length === 0) throw new NotFoundError('Metric not found');
    await sql`DELETE FROM kernel.metrics WHERE id = ${metricId}`;
  }

  async query(
    sql: Sql, _tenantId: string, datasetId: string, input: SemanticQueryInput,
  ): Promise<ResultSet> {
    // Get dataset
    const ds = await sql`SELECT * FROM kernel.datasets WHERE id = ${datasetId}`;
    if (ds.length === 0) throw new NotFoundError('Dataset not found');

    // Get all fields and metrics for validation
    const allFields = await sql`
      SELECT * FROM kernel.dataset_fields WHERE dataset_id = ${datasetId}
    `;
    const allMetrics = await sql`
      SELECT * FROM kernel.metrics WHERE dataset_id = ${datasetId}
    `;

    const fieldMap = new Map(allFields.map((f) => [String(f.name), f]));
    const metricMap = new Map(allMetrics.map((m) => [String(m.name), m]));

    // Validate requested dimensions
    for (const dim of input.dimensions) {
      const field = fieldMap.get(dim);
      if (!field) throw new ValidationError(`Unknown dimension: "${dim}"`);
      if (!field.is_dimension) throw new ValidationError(`"${dim}" is not a dimension`);
    }

    // Validate requested metrics
    for (const met of input.metrics) {
      if (!metricMap.has(met)) throw new ValidationError(`Unknown metric: "${met}"`);
    }

    // Build semantic query — Phase 1 returns mock result set based on schema
    // Real query execution requires actual data tables (Phase 2+)
    const columns = [...input.dimensions, ...input.metrics];
    return {
      columns,
      rows: [],
      total: 0,
    };
  }
}

/** Build WHERE clause fragments from filters (utility for future phases) */
export function buildFilterClause(filters: QueryFilter[]): { clause: string; values: unknown[] } {
  if (!filters || filters.length === 0) return { clause: '', values: [] };

  const parts: string[] = [];
  const values: unknown[] = [];

  for (const f of filters) {
    const paramIdx = values.length + 1;
    switch (f.operator) {
      case 'eq':  parts.push(`"${f.field}" = $${paramIdx}`); values.push(f.value); break;
      case 'neq': parts.push(`"${f.field}" != $${paramIdx}`); values.push(f.value); break;
      case 'gt':  parts.push(`"${f.field}" > $${paramIdx}`); values.push(f.value); break;
      case 'gte': parts.push(`"${f.field}" >= $${paramIdx}`); values.push(f.value); break;
      case 'lt':  parts.push(`"${f.field}" < $${paramIdx}`); values.push(f.value); break;
      case 'lte': parts.push(`"${f.field}" <= $${paramIdx}`); values.push(f.value); break;
      case 'in':  parts.push(`"${f.field}" = ANY($${paramIdx})`); values.push(f.value); break;
      case 'like': parts.push(`"${f.field}" LIKE $${paramIdx}`); values.push(f.value); break;
    }
  }

  return { clause: parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '', values };
}

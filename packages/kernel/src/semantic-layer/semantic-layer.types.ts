/** K8 — Semantic Data Layer types (Phase 1) */

export type SourceType = 'table' | 'view' | 'query';
export type DatasetStatus = 'draft' | 'active' | 'archived';
export type FieldDataType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp';
export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';

export interface Dataset {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  description: string | null;
  source_type: SourceType;
  source_config: Record<string, unknown>;
  status: DatasetStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetField {
  id: string;
  dataset_id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  data_type: FieldDataType;
  is_dimension: boolean;
  is_metric: boolean;
  expression: string | null;
  description: string | null;
  ordinal: number;
  created_at: string;
}

export interface Metric {
  id: string;
  tenant_id: string;
  dataset_id: string;
  name: string;
  display_name: string;
  expression: string;
  aggregation: AggregationType;
  dimensions: string[];
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterDatasetInput {
  name: string;
  display_name: string;
  description?: string;
  source_type: SourceType;
  source_config?: Record<string, unknown>;
  fields: CreateFieldInput[];
}

export interface CreateFieldInput {
  name: string;
  display_name: string;
  data_type: FieldDataType;
  is_dimension?: boolean;
  is_metric?: boolean;
  expression?: string;
  description?: string;
  ordinal?: number;
}

export interface UpdateDatasetInput {
  display_name?: string;
  description?: string;
  source_config?: Record<string, unknown>;
  status?: DatasetStatus;
}

export interface DefineMetricInput {
  name: string;
  display_name: string;
  expression: string;
  aggregation: AggregationType;
  dimensions?: string[];
  description?: string;
}

export interface SemanticQueryInput {
  dimensions: string[];
  metrics: string[];
  filters?: QueryFilter[];
  limit?: number;
  offset?: number;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  value: unknown;
}

export interface DatasetSchema {
  dataset_id: string;
  name: string;
  fields: DatasetField[];
  metrics: Metric[];
}

export interface ResultSet {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
}

/** M11 Semantic Model + KPI Hub -- Type Definitions */

export type ModelStatus = 'draft' | 'published' | 'archived';
export type KpiStatus = 'draft' | 'active' | 'approved' | 'deprecated';
export type DimensionType = 'standard' | 'time' | 'geographic' | 'hierarchy';
export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct_count' | 'custom';
export type RelationshipType = 'one_to_one' | 'one_to_many' | 'many_to_many';

export interface SemanticModel {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  version: number;
  status: ModelStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Dimension {
  id: string;
  model_id: string;
  tenant_id: string;
  name: string;
  source_column: string | null;
  dim_type: DimensionType;
  hierarchy: Record<string, unknown> | null;
  description: string | null;
  created_at: string;
}

export interface Fact {
  id: string;
  model_id: string;
  tenant_id: string;
  name: string;
  expression: string;
  aggregation: AggregationType;
  format: string;
  description: string | null;
  created_at: string;
}

export interface Relationship {
  id: string;
  model_id: string;
  tenant_id: string;
  source_dimension_id: string;
  target_dimension_id: string;
  rel_type: RelationshipType;
  join_expression: string | null;
  created_at: string;
}

export interface Kpi {
  id: string;
  tenant_id: string;
  model_id: string | null;
  name: string;
  description: string | null;
  formula: string;
  dimensions: string[];
  target_value: number | null;
  threshold_warning: number | null;
  threshold_critical: number | null;
  version: number;
  status: KpiStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KpiVersion {
  id: string;
  kpi_id: string;
  tenant_id: string;
  version: number;
  formula: string;
  dimensions: string[];
  target_value: number | null;
  threshold_warning: number | null;
  threshold_critical: number | null;
  change_reason: string | null;
  changed_by: string;
  changed_at: string;
}

/** Input types */

export interface CreateModelInput {
  name: string;
  description?: string;
}

export interface UpdateModelInput {
  id: string;
  name?: string;
  description?: string;
  status?: ModelStatus;
}

export interface DefineDimensionInput {
  model_id: string;
  name: string;
  source_column?: string;
  dim_type?: DimensionType;
  hierarchy?: Record<string, unknown>;
  description?: string;
}

export interface DefineFactInput {
  model_id: string;
  name: string;
  expression: string;
  aggregation?: AggregationType;
  format?: string;
  description?: string;
}

export interface CreateRelationshipInput {
  model_id: string;
  source_dimension_id: string;
  target_dimension_id: string;
  rel_type?: RelationshipType;
  join_expression?: string;
}

export interface CreateKpiInput {
  name: string;
  description?: string;
  model_id?: string;
  formula: string;
  dimensions?: string[];
  target_value?: number;
  threshold_warning?: number;
  threshold_critical?: number;
}

export interface UpdateKpiInput {
  id: string;
  name?: string;
  description?: string;
  formula?: string;
  dimensions?: string[];
  target_value?: number;
  threshold_warning?: number;
  threshold_critical?: number;
  change_reason?: string;
}

export interface ApproveKpiInput {
  id: string;
}

export interface DeprecateKpiInput {
  id: string;
}

export interface PublishModelInput {
  id: string;
}

export interface ImpactPreviewInput {
  kpi_id: string;
}

export interface ImpactPreviewResult {
  kpi_id: string;
  kpi_name: string;
  current_version: number;
  dependent_dashboards: number;
  dependent_kpis: string[];
  version_history_count: number;
}

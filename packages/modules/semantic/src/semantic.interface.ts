/** M11 Semantic Model + KPI Hub -- Service Interface */

import type postgres from 'postgres';
import type {
  SemanticModel,
  Dimension,
  Fact,
  Relationship,
  Kpi,
  KpiVersion,
  CreateModelInput,
  UpdateModelInput,
  DefineDimensionInput,
  DefineFactInput,
  CreateRelationshipInput,
  CreateKpiInput,
  UpdateKpiInput,
  ImpactPreviewResult,
} from './semantic.types.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export interface ISemanticService {
  // Model CRUD
  createModel(sql: Sql, tenantId: string, userId: string, input: CreateModelInput): Promise<SemanticModel>;
  getModel(sql: Sql, modelId: string): Promise<SemanticModel | null>;
  listModels(sql: Sql, tenantId: string): Promise<SemanticModel[]>;
  updateModel(sql: Sql, modelId: string, input: Omit<UpdateModelInput, 'id'>): Promise<SemanticModel>;
  publishModel(sql: Sql, modelId: string): Promise<SemanticModel>;
  deleteModel(sql: Sql, modelId: string): Promise<void>;

  // Dimensions
  defineDimension(sql: Sql, tenantId: string, input: DefineDimensionInput): Promise<Dimension>;
  listDimensions(sql: Sql, modelId: string): Promise<Dimension[]>;
  deleteDimension(sql: Sql, dimensionId: string): Promise<void>;

  // Facts
  defineFact(sql: Sql, tenantId: string, input: DefineFactInput): Promise<Fact>;
  listFacts(sql: Sql, modelId: string): Promise<Fact[]>;
  deleteFact(sql: Sql, factId: string): Promise<void>;

  // Relationships
  createRelationship(sql: Sql, tenantId: string, input: CreateRelationshipInput): Promise<Relationship>;
  listRelationships(sql: Sql, modelId: string): Promise<Relationship[]>;
  deleteRelationship(sql: Sql, relationshipId: string): Promise<void>;

  // KPI CRUD
  createKpi(sql: Sql, tenantId: string, userId: string, input: CreateKpiInput): Promise<Kpi>;
  getKpi(sql: Sql, kpiId: string): Promise<Kpi | null>;
  listKpis(sql: Sql, tenantId: string): Promise<Kpi[]>;
  updateKpi(sql: Sql, userId: string, input: UpdateKpiInput): Promise<Kpi>;
  approveKpi(sql: Sql, kpiId: string, userId: string): Promise<Kpi>;
  deprecateKpi(sql: Sql, kpiId: string): Promise<Kpi>;

  // KPI Versions
  getKpiVersions(sql: Sql, kpiId: string): Promise<KpiVersion[]>;

  // Impact Preview
  previewImpact(sql: Sql, kpiId: string): Promise<ImpactPreviewResult>;
}

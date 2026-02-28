/** K8 — Semantic Data Layer interface (Phase 1) */

import type { Sql } from 'postgres';
import type {
  Dataset,
  RegisterDatasetInput,
  UpdateDatasetInput,
  DefineMetricInput,
  Metric,
  DatasetSchema,
  SemanticQueryInput,
  ResultSet,
} from './semantic-layer.types.js';

export interface ISemanticLayer {
  registerDataset(sql: Sql, tenantId: string, userId: string, input: RegisterDatasetInput): Promise<Dataset>;
  getDataset(sql: Sql, id: string): Promise<Dataset | null>;
  listDatasets(sql: Sql, tenantId: string, status?: string): Promise<Dataset[]>;
  updateDataset(sql: Sql, id: string, input: UpdateDatasetInput): Promise<Dataset>;
  deleteDataset(sql: Sql, id: string): Promise<void>;
  getSchema(sql: Sql, datasetId: string): Promise<DatasetSchema>;
  defineMetric(sql: Sql, tenantId: string, userId: string, datasetId: string, input: DefineMetricInput): Promise<Metric>;
  listMetrics(sql: Sql, datasetId: string): Promise<Metric[]>;
  deleteMetric(sql: Sql, metricId: string): Promise<void>;
  query(sql: Sql, tenantId: string, datasetId: string, input: SemanticQueryInput): Promise<ResultSet>;
}

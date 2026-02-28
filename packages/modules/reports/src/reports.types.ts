/**
 * M10 Reports Engine — Types
 *
 * Metadata-driven report definitions. No PDF, no export, no scheduling.
 * Reports consume Semantic Layer only. Output is simulated.
 */

// ─── Report Definition ───

export interface ReportDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  report_type: ReportType;
  /** Semantic layer references: model_id, kpi_ids, dimensions, facts, filters */
  data_source: Record<string, unknown>;
  /** Column/section layout metadata */
  layout: Record<string, unknown>;
  /** Parameterized filters that can be applied at run-time */
  parameters: ReportParameter[];
  status: ReportStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ReportType = 'tabular' | 'summary' | 'crosstab' | 'narrative' | 'kpi_scorecard';
export type ReportStatus = 'draft' | 'published' | 'archived';

export interface ReportParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  default_value?: unknown;
  options?: unknown[];
  required: boolean;
}

// ─── Report Run (simulated execution) ───

export interface ReportRun {
  id: string;
  report_id: string;
  tenant_id: string;
  /** Parameters supplied at run-time */
  parameters: Record<string, unknown>;
  /** Simulated output from semantic layer */
  output: Record<string, unknown>;
  status: RunStatus;
  executed_by: string;
  executed_at: string;
  duration_ms: number;
}

export type RunStatus = 'completed' | 'failed';

// ─── Inputs ───

export interface CreateReportInput {
  name: string;
  description?: string;
  report_type: ReportType;
  data_source: Record<string, unknown>;
  layout?: Record<string, unknown>;
  parameters?: ReportParameter[];
}

export interface UpdateReportInput {
  name?: string;
  description?: string;
  report_type?: ReportType;
  data_source?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  parameters?: ReportParameter[];
}

export interface ExecuteReportInput {
  parameters?: Record<string, unknown>;
}

// ─── Simulated Output ───

export interface ReportOutput {
  report_id: string;
  report_name: string;
  report_type: ReportType;
  data_source: Record<string, unknown>;
  parameters_applied: Record<string, unknown>;
  result: unknown;
  generated_at: string;
  source: 'semantic_layer_simulated';
}

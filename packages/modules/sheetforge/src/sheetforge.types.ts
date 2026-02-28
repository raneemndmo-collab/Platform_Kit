/** M8 SheetForge — Type Definitions */

export type LibraryStatus = 'uploaded' | 'indexing' | 'indexed' | 'error';
export type CompositionStatus = 'draft' | 'composed' | 'published' | 'error';

export interface Library {
  id: string;
  tenant_id: string;
  name: string;
  file_url: string | null;
  file_type: string;
  file_size: number;
  row_count: number;
  column_count: number;
  indexed_at: string | null;
  status: LibraryStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Sheet {
  id: string;
  library_id: string;
  tenant_id: string;
  sheet_name: string;
  headers: string[];
  data_types: Record<string, string>;
  row_count: number;
  sample_data: Record<string, unknown>[];
  created_at: string;
}

export interface Composition {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  source_sheets: SourceSheetRef[];
  join_config: JoinConfig;
  output_schema: OutputColumn[];
  output_data: Record<string, unknown>[];
  status: CompositionStatus;
  published_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GapAnalysis {
  id: string;
  composition_id: string;
  tenant_id: string;
  missing_cells: number;
  duplicate_rows: number;
  type_mismatches: number;
  details: GapDetails;
  created_at: string;
}

/** Sub-types */

export interface SourceSheetRef {
  sheet_id: string;
  alias: string;
  selected_columns: string[];
}

export interface JoinConfig {
  type: 'inner' | 'left' | 'right' | 'full' | 'none';
  left_key?: string;
  right_key?: string;
}

export interface OutputColumn {
  name: string;
  source_sheet_alias: string;
  source_column: string;
  data_type: string;
}

export interface GapDetails {
  missing_by_column?: Record<string, number>;
  duplicate_indices?: number[];
  mismatch_columns?: string[];
}

/** Input types */

export interface UploadLibraryInput {
  name: string;
  file_type?: string;
  file_url?: string;
  simulated_sheets?: SimulatedSheet[];
}

export interface SimulatedSheet {
  sheet_name: string;
  headers: string[];
  data_types: Record<string, string>;
  row_count: number;
  sample_data: Record<string, unknown>[];
}

export interface IndexLibraryInput {
  id: string;
}

export interface UpdateLibraryInput {
  id: string;
  name?: string;
  status?: LibraryStatus;
}

export interface CreateCompositionInput {
  name: string;
  description?: string;
  source_sheets: SourceSheetRef[];
  join_config: JoinConfig;
}

export interface UpdateCompositionInput {
  id: string;
  name?: string;
  description?: string;
  source_sheets?: SourceSheetRef[];
  join_config?: JoinConfig;
  status?: CompositionStatus;
}

export interface RunGapAnalysisInput {
  composition_id: string;
}

export interface PublishCompositionInput {
  id: string;
}

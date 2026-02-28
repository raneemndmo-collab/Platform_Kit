/**
 * M14 Custom Pages — Type Definitions
 *
 * Metadata-only page definitions. No rendering logic.
 * Pages store layout metadata and reference dashboards/reports by ID only.
 * No cross-schema FK — IDs are stored as plain strings.
 */

/* ── Section types ── */
export type SectionType =
  | 'dashboard_embed'
  | 'report_embed'
  | 'text_block'
  | 'spacer'
  | 'divider';

export interface PageSection {
  id: string;
  section_type: SectionType;
  order: number;
  reference_id?: string;
  config: Record<string, unknown>;
}

/* ── Page definition ── */
export interface PageRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  status: 'draft' | 'published' | 'archived';
  layout: Record<string, unknown>;
  sections: PageSection[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

/* ── Inputs ── */
export interface CreatePageInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  layout?: Record<string, unknown>;
  sections?: PageSection[];
}

export interface UpdatePageInput {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  layout?: Record<string, unknown>;
  sections?: PageSection[];
}

export interface AddSectionInput {
  section_type: SectionType;
  order?: number;
  reference_id?: string;
  config?: Record<string, unknown>;
}

export interface UpdateSectionInput {
  order?: number;
  reference_id?: string;
  config?: Record<string, unknown>;
}

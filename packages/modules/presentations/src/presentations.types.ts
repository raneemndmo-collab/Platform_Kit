/**
 * M16 Presentations — Types
 *
 * Metadata-only slide definitions. No PPTX, no PDF, no rendering.
 * Slides reference reports by ID only (plain string in content JSONB, no FK).
 */

/** A single slide definition — metadata only */
export interface SlideDefinition {
  id: string;
  title: string;
  layout: string | null;
  content: Record<string, unknown>;
  notes: string | null;
  sort_order: number;
}

/** Presentation row from DB */
export interface PresentationRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  slides: SlideDefinition[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Input for creating a presentation */
export interface CreatePresentationInput {
  name: string;
  description?: string;
}

/** Input for updating a presentation */
export interface UpdatePresentationInput {
  name?: string;
  description?: string;
}

/** Input for adding a slide */
export interface AddSlideInput {
  title: string;
  layout?: string;
  content?: Record<string, unknown>;
  notes?: string;
}

/** Input for updating a slide */
export interface UpdateSlideInput {
  title?: string;
  layout?: string;
  content?: Record<string, unknown>;
  notes?: string;
}

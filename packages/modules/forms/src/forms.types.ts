/**
 * M15 Forms Builder — Type Definitions
 *
 * Metadata-only form definitions + submission storage.
 * No email, no notification, no workflow, no conditional logic.
 * Page references by ID only (plain string, no FK).
 */

/* ── Form Field Definition (stored in JSONB) ── */
export interface FormFieldDef {
  field_id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'date' | 'select' | 'checkbox' | 'textarea' | 'radio';
  required?: boolean;
  placeholder?: string;
  options?: string[];           // for select / radio / checkbox
  default_value?: string;
}

/* ── Form Row ── */
export interface FormRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  fields: FormFieldDef[];
  page_id: string | null;       // reference to custom page by ID only (no FK)
  created_by: string;
  created_at: string;
  updated_at: string;
}

/* ── Submission Row ── */
export interface SubmissionRow {
  id: string;
  tenant_id: string;
  form_id: string;
  data: Record<string, unknown>;  // submitted field values
  submitted_by: string | null;
  submitted_at: string;
}

/* ── Input Types ── */
export interface CreateFormInput {
  name: string;
  description?: string;
  fields: FormFieldDef[];
  page_id?: string;
}

export interface UpdateFormInput {
  name?: string;
  description?: string;
  fields?: FormFieldDef[];
  page_id?: string;
}

export interface CreateSubmissionInput {
  data: Record<string, unknown>;
  submitted_by?: string;
}

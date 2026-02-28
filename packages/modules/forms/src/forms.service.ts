/**
 * M15 Forms Builder — Service Implementation
 *
 * Metadata-only form definitions + submission storage.
 * No email, no notification, no workflow, no conditional logic.
 * All DB access scoped to mod_forms schema only.
 * Page references stored as plain string (no FK, no cross-schema query).
 */
import { v7 as uuidv7 } from 'uuid';
import type { IFormsService } from './forms.interface.js';
import type { FormRow, SubmissionRow, CreateFormInput, UpdateFormInput, CreateSubmissionInput } from './forms.types.js';

export class FormsService implements IFormsService {

  /* ═══════════════════════════════════════
   * Form CRUD
   * ═══════════════════════════════════════ */

  async createForm(sql: any, tenantId: string, userId: string, input: CreateFormInput): Promise<FormRow> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const [row] = await sql`
      INSERT INTO mod_forms.forms (id, tenant_id, name, description, status, fields, page_id, created_by, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${input.name}, ${input.description || null}, 'draft',
              ${JSON.stringify(input.fields)}::jsonb, ${input.page_id || null}, ${userId}, ${now}, ${now})
      RETURNING *`;
    return row;
  }

  async listForms(sql: any, tenantId: string): Promise<FormRow[]> {
    return sql`SELECT * FROM mod_forms.forms WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
  }

  async getForm(sql: any, tenantId: string, id: string): Promise<FormRow | null> {
    const [row] = await sql`SELECT * FROM mod_forms.forms WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return row || null;
  }

  async updateForm(sql: any, tenantId: string, id: string, input: UpdateFormInput): Promise<FormRow | null> {
    const existing = await this.getForm(sql, tenantId, id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const name = input.name ?? existing.name;
    const description = input.description !== undefined ? input.description : existing.description;
    const fields = input.fields ?? existing.fields;
    const page_id = input.page_id !== undefined ? input.page_id : existing.page_id;
    const [row] = await sql`
      UPDATE mod_forms.forms
      SET name = ${name}, description = ${description}, fields = ${JSON.stringify(fields)}::jsonb,
          page_id = ${page_id}, updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return row || null;
  }

  async deleteForm(sql: any, tenantId: string, id: string): Promise<boolean> {
    // Delete submissions first, then form
    await sql`DELETE FROM mod_forms.submissions WHERE form_id = ${id} AND tenant_id = ${tenantId}`;
    const result = await sql`DELETE FROM mod_forms.forms WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id`;
    return result.length > 0;
  }

  async publishForm(sql: any, tenantId: string, id: string): Promise<FormRow | null> {
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_forms.forms SET status = 'published', updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`;
    return row || null;
  }

  async archiveForm(sql: any, tenantId: string, id: string): Promise<FormRow | null> {
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_forms.forms SET status = 'archived', updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`;
    return row || null;
  }

  /* ═══════════════════════════════════════
   * Submission CRUD
   * ═══════════════════════════════════════ */

  async createSubmission(sql: any, tenantId: string, formId: string, input: CreateSubmissionInput): Promise<SubmissionRow> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const [row] = await sql`
      INSERT INTO mod_forms.submissions (id, tenant_id, form_id, data, submitted_by, submitted_at)
      VALUES (${id}, ${tenantId}, ${formId}, ${JSON.stringify(input.data)}::jsonb,
              ${input.submitted_by || null}, ${now})
      RETURNING *`;
    return row;
  }

  async listSubmissions(sql: any, tenantId: string, formId: string): Promise<SubmissionRow[]> {
    return sql`SELECT * FROM mod_forms.submissions WHERE form_id = ${formId} AND tenant_id = ${tenantId} ORDER BY submitted_at DESC`;
  }

  async getSubmission(sql: any, tenantId: string, formId: string, submissionId: string): Promise<SubmissionRow | null> {
    const [row] = await sql`
      SELECT * FROM mod_forms.submissions
      WHERE id = ${submissionId} AND form_id = ${formId} AND tenant_id = ${tenantId}`;
    return row || null;
  }

  async deleteSubmission(sql: any, tenantId: string, formId: string, submissionId: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM mod_forms.submissions
      WHERE id = ${submissionId} AND form_id = ${formId} AND tenant_id = ${tenantId}
      RETURNING id`;
    return result.length > 0;
  }
}

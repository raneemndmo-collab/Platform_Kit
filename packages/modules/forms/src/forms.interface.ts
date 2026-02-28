/**
 * M15 Forms Builder — Service Interface
 */
import type { FormRow, SubmissionRow, CreateFormInput, UpdateFormInput, CreateSubmissionInput } from './forms.types.js';

export interface IFormsService {
  createForm(sql: any, tenantId: string, userId: string, input: CreateFormInput): Promise<FormRow>;
  listForms(sql: any, tenantId: string): Promise<FormRow[]>;
  getForm(sql: any, tenantId: string, id: string): Promise<FormRow | null>;
  updateForm(sql: any, tenantId: string, id: string, input: UpdateFormInput): Promise<FormRow | null>;
  deleteForm(sql: any, tenantId: string, id: string): Promise<boolean>;
  publishForm(sql: any, tenantId: string, id: string): Promise<FormRow | null>;
  archiveForm(sql: any, tenantId: string, id: string): Promise<FormRow | null>;

  createSubmission(sql: any, tenantId: string, formId: string, input: CreateSubmissionInput): Promise<SubmissionRow>;
  listSubmissions(sql: any, tenantId: string, formId: string): Promise<SubmissionRow[]>;
  getSubmission(sql: any, tenantId: string, formId: string, submissionId: string): Promise<SubmissionRow | null>;
  deleteSubmission(sql: any, tenantId: string, formId: string, submissionId: string): Promise<boolean>;
}

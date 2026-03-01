/**
 * M15 Forms Builder — K3 Action Registration
 *
 * Metadata-only form definitions + submission storage.
 * No email, no notification, no workflow, no conditional logic.
 * All actions registered via K3 pipeline for RBAC + audit.
 * Handler signature: (input, ctx, sql) => ActionHandlerResult
 * Schema: mod_forms
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { FormsService } from './forms.service.js';
import { ValidationError } from '@rasid/shared';
import { createFormSchema, updateFormSchema, createSubmissionSchema } from './forms.schema.js';
import type { CreateFormInput, UpdateFormInput } from './forms.types.js';

const svc = new FormsService();

export function registerFormsActions() {

  // ═══════════════════════════════════════
  // Form CRUD
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.form.create',
      display_name: 'Create Form',
      module_id: 'mod_forms',
      verb: 'create',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['forms.create'],
    },
    async (input: any, ctx: any, sql: any) => {
      const parsed = createFormSchema.safeParse(input);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const row = await svc.createForm(sql, ctx.tenantId, ctx.userId, parsed.data as CreateFormInput);
      return {
        data: row,
        object_id: row.id,
        object_type: 'form',
        before: null,
        after: row,
        event_type: 'forms.form.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.form.list',
      display_name: 'List Forms',
      module_id: 'mod_forms',
      verb: 'read',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['forms.read'],
    },
    async (_input: any, ctx: any, sql: any) => {
      const rows = await svc.listForms(sql, ctx.tenantId);
      return {
        data: rows,
        object_id: null,
        object_type: 'form',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.form.get',
      display_name: 'Get Form',
      module_id: 'mod_forms',
      verb: 'read',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['forms.read'],
    },
    async (input: any, ctx: any, sql: any) => {
      const row = await svc.getForm(sql, ctx.tenantId, input.id);
      if (!row) throw new Error('Form not found');
      return {
        data: row,
        object_id: row.id,
        object_type: 'form',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.form.update',
      display_name: 'Update Form',
      module_id: 'mod_forms',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['forms.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      const { id, ...body } = input;
      const parsed = updateFormSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const row = await svc.updateForm(sql, ctx.tenantId, id, parsed.data as UpdateFormInput);
      if (!row) throw new Error('Form not found');
      return {
        data: row,
        object_id: row.id,
        object_type: 'form',
        before: null,
        after: row,
        event_type: 'forms.form.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.form.delete',
      display_name: 'Delete Form',
      module_id: 'mod_forms',
      verb: 'delete',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['forms.delete'],
    },
    async (input: any, ctx: any, sql: any) => {
      const ok = await svc.deleteForm(sql, ctx.tenantId, input.id);
      if (!ok) throw new Error('Form not found');
      return {
        data: { deleted: true },
        object_id: input.id,
        object_type: 'form',
        before: null,
        after: null,
        event_type: 'forms.form.deleted',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.form.publish',
      display_name: 'Publish Form',
      module_id: 'mod_forms',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['forms.publish'],
    },
    async (input: any, ctx: any, sql: any) => {
      const row = await svc.publishForm(sql, ctx.tenantId, input.id);
      if (!row) throw new Error('Form not found');
      return {
        data: row,
        object_id: row.id,
        object_type: 'form',
        before: null,
        after: row,
        event_type: 'forms.form.published',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.form.archive',
      display_name: 'Archive Form',
      module_id: 'mod_forms',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['forms.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      const row = await svc.archiveForm(sql, ctx.tenantId, input.id);
      if (!row) throw new Error('Form not found');
      return {
        data: row,
        object_id: row.id,
        object_type: 'form',
        before: null,
        after: row,
        event_type: 'forms.form.archived',
      };
    },
  );

  // ═══════════════════════════════════════
  // Submission CRUD
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.submission.create',
      display_name: 'Create Submission',
      module_id: 'mod_forms',
      verb: 'create',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['submissions.create'],
    },
    async (input: any, ctx: any, sql: any) => {
      const { form_id, ...body } = input;
      const parsed = createSubmissionSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const row = await svc.createSubmission(sql, ctx.tenantId, form_id, parsed.data);
      return {
        data: row,
        object_id: row.id,
        object_type: 'submission',
        before: null,
        after: row,
        event_type: 'forms.submission.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.submission.list',
      display_name: 'List Submissions',
      module_id: 'mod_forms',
      verb: 'read',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['submissions.read'],
    },
    async (input: any, ctx: any, sql: any) => {
      const rows = await svc.listSubmissions(sql, ctx.tenantId, input.form_id);
      return {
        data: rows,
        object_id: null,
        object_type: 'submission',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.submission.get',
      display_name: 'Get Submission',
      module_id: 'mod_forms',
      verb: 'read',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['submissions.read'],
    },
    async (input: any, ctx: any, sql: any) => {
      const row = await svc.getSubmission(sql, ctx.tenantId, input.form_id, input.submission_id);
      if (!row) throw new Error('Submission not found');
      return {
        data: row,
        object_id: row.id,
        object_type: 'submission',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.forms.submission.delete',
      display_name: 'Delete Submission',
      module_id: 'mod_forms',
      verb: 'delete',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['submissions.delete'],
    },
    async (input: any, ctx: any, sql: any) => {
      const ok = await svc.deleteSubmission(sql, ctx.tenantId, input.form_id, input.submission_id);
      if (!ok) throw new Error('Submission not found');
      return {
        data: { deleted: true },
        object_id: input.submission_id,
        object_type: 'submission',
        before: null,
        after: null,
        event_type: 'forms.submission.deleted',
      };
    },
  );
}

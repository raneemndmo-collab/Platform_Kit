/**
 * M16 Presentations — K3 Action Registration
 *
 * Metadata-only slide definitions. No PPTX, no PDF, no rendering.
 * All actions registered via K3 pipeline for RBAC + audit.
 * Handler signature: (input, ctx, sql) => ActionHandlerResult
 * Schema: mod_presentations
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { PresentationsService } from './presentations.service.js';
import { ValidationError } from '@rasid/shared';
import {
  createPresentationSchema, updatePresentationSchema,
  addSlideSchema, updateSlideSchema,
} from './presentations.schema.js';
import type { CreatePresentationInput, UpdatePresentationInput } from './presentations.types.js';

const svc = new PresentationsService();

export function registerPresentationsActions() {

  // ═══════════════════════════════════════
  // Presentation CRUD
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.presentation.create',
      display_name: 'Create Presentation',
      module_id: 'mod_presentations',
      verb: 'create',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['presentations.create'],
    },
    async (input: any, ctx: any, sql: any) => {
      const parsed = createPresentationSchema.safeParse(input);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const row = await svc.createPresentation(sql, ctx.tenantId, ctx.userId, parsed.data as CreatePresentationInput);
      return {
        data: row,
        object_id: row.id,
        object_type: 'presentation',
        before: null,
        after: row,
        event_type: 'presentations.presentation.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.presentation.list',
      display_name: 'List Presentations',
      module_id: 'mod_presentations',
      verb: 'read',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['presentations.read'],
    },
    async (_input: any, ctx: any, sql: any) => {
      const data = await svc.listPresentations(sql, ctx.tenantId);
      return { data, object_id: null, object_type: 'presentation', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.presentation.get',
      display_name: 'Get Presentation',
      module_id: 'mod_presentations',
      verb: 'read',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['presentations.read'],
    },
    async (input: any, ctx: any, sql: any) => {
      const data = await svc.getPresentation(sql, ctx.tenantId, input.id);
      return { data, object_id: input.id, object_type: 'presentation', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.presentation.update',
      display_name: 'Update Presentation',
      module_id: 'mod_presentations',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['presentations.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      const { id, ...body } = input;
      const parsed = updatePresentationSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const data = await svc.updatePresentation(sql, ctx.tenantId, id, parsed.data as UpdatePresentationInput);
      return {
        data,
        object_id: id,
        object_type: 'presentation',
        before: null,
        after: data,
        event_type: 'presentations.presentation.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.presentation.delete',
      display_name: 'Delete Presentation',
      module_id: 'mod_presentations',
      verb: 'delete',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['presentations.delete'],
    },
    async (input: any, ctx: any, sql: any) => {
      const deleted = await svc.deletePresentation(sql, ctx.tenantId, input.id);
      return {
        data: deleted,
        object_id: input.id,
        object_type: 'presentation',
        before: null,
        after: null,
        event_type: 'presentations.presentation.deleted',
      };
    },
  );

  // ═══════════════════════════════════════
  // Status transitions
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.presentation.publish',
      display_name: 'Publish Presentation',
      module_id: 'mod_presentations',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['presentations.publish'],
    },
    async (input: any, ctx: any, sql: any) => {
      const data = await svc.publishPresentation(sql, ctx.tenantId, input.id);
      return {
        data,
        object_id: input.id,
        object_type: 'presentation',
        before: null,
        after: data,
        event_type: 'presentations.presentation.published',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.presentation.archive',
      display_name: 'Archive Presentation',
      module_id: 'mod_presentations',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['presentations.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      const data = await svc.archivePresentation(sql, ctx.tenantId, input.id);
      return {
        data,
        object_id: input.id,
        object_type: 'presentation',
        before: null,
        after: data,
        event_type: 'presentations.presentation.archived',
      };
    },
  );

  // ═══════════════════════════════════════
  // Slide management
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.slide.add',
      display_name: 'Add Slide to Presentation',
      module_id: 'mod_presentations',
      verb: 'create',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['slides.create'],
    },
    async (input: any, ctx: any, sql: any) => {
      const { presentation_id, ...body } = input;
      const parsed = addSlideSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const result = await svc.addSlide(sql, ctx.tenantId, presentation_id, parsed.data);
      return {
        data: result ? result.slide : null,
        object_id: presentation_id,
        object_type: 'presentation',
        before: null,
        after: result,
        event_type: 'presentations.slide.added',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.slide.update',
      display_name: 'Update Slide',
      module_id: 'mod_presentations',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['slides.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      const { presentation_id, slide_id, ...body } = input;
      const parsed = updateSlideSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const result = await svc.updateSlide(sql, ctx.tenantId, presentation_id, slide_id, parsed.data);
      return {
        data: result ? result.slide : null,
        object_id: presentation_id,
        object_type: 'presentation',
        before: null,
        after: result,
        event_type: 'presentations.slide.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.slide.remove',
      display_name: 'Remove Slide',
      module_id: 'mod_presentations',
      verb: 'delete',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['slides.delete'],
    },
    async (input: any, ctx: any, sql: any) => {
      const data = await svc.removeSlide(sql, ctx.tenantId, input.presentation_id, input.slide_id);
      return {
        data,
        object_id: input.presentation_id,
        object_type: 'presentation',
        before: null,
        after: null,
        event_type: 'presentations.slide.removed',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.presentations.slide.reorder',
      display_name: 'Reorder Slides',
      module_id: 'mod_presentations',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['slides.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      if (!Array.isArray(input.slide_ids)) throw new ValidationError('slide_ids must be an array', {});
      const data = await svc.reorderSlides(sql, ctx.tenantId, input.presentation_id, input.slide_ids);
      return {
        data,
        object_id: input.presentation_id,
        object_type: 'presentation',
        before: null,
        after: data,
        event_type: 'presentations.slide.reordered',
      };
    },
  );
}

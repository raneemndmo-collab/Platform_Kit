/**
 * M14 Custom Pages — K3 Action Registration
 *
 * Metadata-only page definitions. No rendering, no templating.
 * All actions registered via K3 pipeline for RBAC + audit.
 * Handler signature: (input, ctx, sql) => ActionHandlerResult
 * Schema: mod_custom_pages
 */
import { actionRegistry } from '../../../kernel/src/action-registry/action-registry.service.js';
import { CustomPagesService } from './custom-pages.service.js';
import { ValidationError } from '@rasid/shared';
import {
  createPageSchema, updatePageSchema, addSectionSchema, updateSectionSchema,
} from './custom-pages.schema.js';
import type { CreatePageInput, UpdatePageInput } from './custom-pages.types.js';

const svc = new CustomPagesService();

export function registerCustomPagesActions() {

  // ═══════════════════════════════════════
  // Page CRUD
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.page.create',
      display_name: 'Create Custom Page',
      module_id: 'mod_custom_pages',
      verb: 'create',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['pages.create'],
    },
    async (input: any, ctx: any, sql: any) => {
      const parsed = createPageSchema.safeParse(input);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const row = await svc.createPage(sql, ctx.tenantId, ctx.userId, parsed.data as CreatePageInput);
      return {
        data: row,
        object_id: row.id,
        object_type: 'page',
        before: null,
        after: row,
        event_type: 'custom_pages.page.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.page.list',
      display_name: 'List Custom Pages',
      module_id: 'mod_custom_pages',
      verb: 'read',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['pages.read'],
    },
    async (_input: any, ctx: any, sql: any) => {
      const data = await svc.listPages(sql, ctx.tenantId);
      return { data, object_id: null, object_type: 'page', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.page.get',
      display_name: 'Get Custom Page',
      module_id: 'mod_custom_pages',
      verb: 'read',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['pages.read'],
    },
    async (input: any, ctx: any, sql: any) => {
      const data = await svc.getPage(sql, ctx.tenantId, input.id);
      return { data, object_id: input.id, object_type: 'page', before: null, after: null };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.page.update',
      display_name: 'Update Custom Page',
      module_id: 'mod_custom_pages',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['pages.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      const { id, ...body } = input;
      const parsed = updatePageSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const data = await svc.updatePage(sql, ctx.tenantId, id, parsed.data as UpdatePageInput);
      return {
        data,
        object_id: id,
        object_type: 'page',
        before: null,
        after: data,
        event_type: 'custom_pages.page.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.page.delete',
      display_name: 'Delete Custom Page',
      module_id: 'mod_custom_pages',
      verb: 'delete',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['pages.delete'],
    },
    async (input: any, ctx: any, sql: any) => {
      const deleted = await svc.deletePage(sql, ctx.tenantId, input.id);
      return {
        data: deleted,
        object_id: input.id,
        object_type: 'page',
        before: null,
        after: null,
        event_type: 'custom_pages.page.deleted',
      };
    },
  );

  // ═══════════════════════════════════════
  // Status transitions
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.page.publish',
      display_name: 'Publish Custom Page',
      module_id: 'mod_custom_pages',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['pages.publish'],
    },
    async (input: any, ctx: any, sql: any) => {
      const data = await svc.publishPage(sql, ctx.tenantId, input.id);
      return {
        data,
        object_id: input.id,
        object_type: 'page',
        before: null,
        after: data,
        event_type: 'custom_pages.page.published',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.page.archive',
      display_name: 'Archive Custom Page',
      module_id: 'mod_custom_pages',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['pages.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      const data = await svc.archivePage(sql, ctx.tenantId, input.id);
      return {
        data,
        object_id: input.id,
        object_type: 'page',
        before: null,
        after: data,
        event_type: 'custom_pages.page.archived',
      };
    },
  );

  // ═══════════════════════════════════════
  // Section management
  // ═══════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.section.add',
      display_name: 'Add Section to Page',
      module_id: 'mod_custom_pages',
      verb: 'create',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['page_sections.create'],
    },
    async (input: any, ctx: any, sql: any) => {
      const { page_id, ...body } = input;
      const parsed = addSectionSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const data = await svc.addSection(sql, ctx.tenantId, page_id, parsed.data);
      return {
        data,
        object_id: page_id,
        object_type: 'page',
        before: null,
        after: data,
        event_type: 'custom_pages.section.added',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.section.update',
      display_name: 'Update Page Section',
      module_id: 'mod_custom_pages',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['page_sections.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      const { page_id, section_id, ...body } = input;
      const parsed = updateSectionSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors);
      const data = await svc.updateSection(sql, ctx.tenantId, page_id, section_id, parsed.data);
      return {
        data,
        object_id: page_id,
        object_type: 'page',
        before: null,
        after: data,
        event_type: 'custom_pages.section.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.section.remove',
      display_name: 'Remove Page Section',
      module_id: 'mod_custom_pages',
      verb: 'delete',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['page_sections.delete'],
    },
    async (input: any, ctx: any, sql: any) => {
      const data = await svc.removeSection(sql, ctx.tenantId, input.page_id, input.section_id);
      return {
        data,
        object_id: input.page_id,
        object_type: 'page',
        before: null,
        after: null,
        event_type: 'custom_pages.section.removed',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.custom_pages.section.reorder',
      display_name: 'Reorder Page Sections',
      module_id: 'mod_custom_pages',
      verb: 'update',
      sensitivity: 'low',
      input_schema: {},
      output_schema: {},
      required_permissions: ['page_sections.update'],
    },
    async (input: any, ctx: any, sql: any) => {
      if (!Array.isArray(input.section_ids)) throw new ValidationError('section_ids must be an array', {});
      const data = await svc.reorderSections(sql, ctx.tenantId, input.page_id, input.section_ids);
      return {
        data,
        object_id: input.page_id,
        object_type: 'page',
        before: null,
        after: data,
        event_type: 'custom_pages.section.reordered',
      };
    },
  );
}

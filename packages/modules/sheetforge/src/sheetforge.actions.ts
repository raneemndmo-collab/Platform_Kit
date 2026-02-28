/**
 * M8 SheetForge — K3 Action Handlers
 *
 * Registers all mutation actions with K3 Action Registry.
 * Each handler returns ActionHandlerResult for audit + event emission.
 */

import { actionRegistry } from '../../../kernel/src/action-registry/action-registry.service.js';
import { SheetForgeService } from './sheetforge.service.js';
import type {
  UploadLibraryInput,
  UpdateLibraryInput,
  IndexLibraryInput,
  CreateCompositionInput,
  UpdateCompositionInput,
  RunGapAnalysisInput,
  PublishCompositionInput,
} from './sheetforge.types.js';

const service = new SheetForgeService();

export function registerSheetForgeActions(): void {

  /* ═══════════════════════════════════════════
   * LIBRARY ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.library.upload',
      display_name: 'Upload Library',
      module_id: 'mod_sheetforge',
      verb: 'create',
      resource: 'libraries',
      input_schema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          file_type: { type: 'string' },
          file_url: { type: 'string' },
        },
      },
      output_schema: {},
      required_permissions: ['libraries.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as UploadLibraryInput;
      const library = await service.uploadLibrary(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: library,
        object_id: library.id,
        object_type: 'library',
        before: null,
        after: library,
        event_type: 'rasid.mod.sheetforge.library.uploaded',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.library.index',
      display_name: 'Index Library',
      module_id: 'mod_sheetforge',
      verb: 'update',
      resource: 'libraries',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['libraries.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id } = input as IndexLibraryInput;
      const before = await service.getLibrary(sql, id);
      const library = await service.indexLibrary(sql, id);
      return {
        data: library,
        object_id: library.id,
        object_type: 'library',
        before,
        after: library,
        event_type: 'rasid.mod.sheetforge.library.indexed',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.library.update',
      display_name: 'Update Library',
      module_id: 'mod_sheetforge',
      verb: 'update',
      resource: 'libraries',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['libraries.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as UpdateLibraryInput;
      const before = await service.getLibrary(sql, id);
      const library = await service.updateLibrary(sql, id, rest);
      return {
        data: library,
        object_id: library.id,
        object_type: 'library',
        before,
        after: library,
        event_type: 'rasid.mod.sheetforge.library.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.library.delete',
      display_name: 'Delete Library',
      module_id: 'mod_sheetforge',
      verb: 'delete',
      resource: 'libraries',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['libraries.delete'],
      sensitivity: 'critical',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const before = await service.getLibrary(sql, id);
      await service.deleteLibrary(sql, id);
      return {
        data: null,
        object_id: id,
        object_type: 'library',
        before,
        after: null,
        event_type: 'rasid.mod.sheetforge.library.deleted',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * COMPOSITION ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.compose',
      display_name: 'Create Composition',
      module_id: 'mod_sheetforge',
      verb: 'create',
      resource: 'compositions',
      input_schema: {
        type: 'object',
        required: ['name', 'source_sheets', 'join_config'],
        properties: {
          name: { type: 'string' },
          source_sheets: { type: 'array' },
          join_config: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['compositions.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as CreateCompositionInput;
      const comp = await service.createComposition(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: comp,
        object_id: comp.id,
        object_type: 'composition',
        before: null,
        after: comp,
        event_type: 'rasid.mod.sheetforge.composition.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.compose.update',
      display_name: 'Update Composition',
      module_id: 'mod_sheetforge',
      verb: 'update',
      resource: 'compositions',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['compositions.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as UpdateCompositionInput;
      const before = await service.getComposition(sql, id);
      const comp = await service.updateComposition(sql, id, rest);
      return {
        data: comp,
        object_id: comp.id,
        object_type: 'composition',
        before,
        after: comp,
        event_type: 'rasid.mod.sheetforge.composition.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.compose.delete',
      display_name: 'Delete Composition',
      module_id: 'mod_sheetforge',
      verb: 'delete',
      resource: 'compositions',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['compositions.delete'],
      sensitivity: 'critical',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const before = await service.getComposition(sql, id);
      await service.deleteComposition(sql, id);
      return {
        data: null,
        object_id: id,
        object_type: 'composition',
        before,
        after: null,
        event_type: 'rasid.mod.sheetforge.composition.deleted',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.publish',
      display_name: 'Publish Composition',
      module_id: 'mod_sheetforge',
      verb: 'update',
      resource: 'compositions',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['compositions.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id } = input as PublishCompositionInput;
      const before = await service.getComposition(sql, id);
      const comp = await service.publishComposition(sql, id);
      return {
        data: comp,
        object_id: comp.id,
        object_type: 'composition',
        before,
        after: comp,
        event_type: 'rasid.mod.sheetforge.composition.published',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * GAP ANALYSIS ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.sheetforge.analyze',
      display_name: 'Run Gap Analysis',
      module_id: 'mod_sheetforge',
      verb: 'create',
      resource: 'gap_analyses',
      input_schema: {
        type: 'object',
        required: ['composition_id'],
        properties: { composition_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['gap_analyses.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { composition_id } = input as RunGapAnalysisInput;
      const gap = await service.runGapAnalysis(sql, ctx.tenantId, composition_id);
      return {
        data: gap,
        object_id: gap.id,
        object_type: 'gap_analysis',
        before: null,
        after: gap,
        event_type: 'rasid.mod.sheetforge.gap.detected',
      };
    },
  );
}

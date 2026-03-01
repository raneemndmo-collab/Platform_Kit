/**
 * M21 AI Engine — Tool Registry K3 Actions (Step 2)
 *
 * All mutations go through K3 pipeline.
 * No external calls. No LLM. No embeddings.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { toolRegistryService as svc } from './tool-registry.service.js';
import {
  createToolDefinitionSchema,
  updateToolDefinitionSchema,
  createToolBindingSchema,
} from './tool-registry.schema.js';
import type {
  CreateToolDefinitionInput,
  UpdateToolDefinitionInput,
  CreateToolBindingInput,
} from './tool-registry.types.js';
import { ValidationError, NotFoundError } from '@rasid/shared';

export function registerToolRegistryActions(): void {
  // ═══════════════════════════════════════════
  // TOOL DEFINITIONS CRUD
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_def.create',
      display_name: 'Create AI Tool Definition',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_tool_definitions',
      input_schema: {
        type: 'object',
        required: ['action_id', 'name', 'description'],
        properties: {
          action_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_tool_definitions.create'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const parsed = createToolDefinitionSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; '),
        );
      }
      const tool = await svc.createToolDefinition(
        sql, ctx.tenantId, parsed.data as CreateToolDefinitionInput,
      );
      return {
        data: tool,
        object_id: tool.id,
        object_type: 'ai_tool_definition',
        before: null,
        after: tool,
        event_type: 'rasid.mod.ai.tool_def.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_def.list',
      display_name: 'List AI Tool Definitions',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_tool_definitions',
      input_schema: { type: 'object', required: [], properties: {} },
      output_schema: {},
      required_permissions: ['ai_tool_definitions.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { category, status, tag } = (input ?? {}) as {
        category?: string;
        status?: string;
        tag?: string;
      };
      const data = await svc.listToolDefinitions(
        sql, ctx.tenantId, { category, status, tag },
      );
      return {
        data,
        object_id: null,
        object_type: 'ai_tool_definition',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_def.get',
      display_name: 'Get AI Tool Definition',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_tool_definitions',
      input_schema: {
        type: 'object',
        required: ['tool_id'],
        properties: { tool_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_tool_definitions.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { tool_id } = input as { tool_id: string };
      const tool = await svc.getToolDefinition(sql, ctx.tenantId, tool_id);
      if (!tool) {
        throw new NotFoundError(`Tool definition ${tool_id} not found`);
      }
      return {
        data: tool,
        object_id: tool.id,
        object_type: 'ai_tool_definition',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_def.update',
      display_name: 'Update AI Tool Definition',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_tool_definitions',
      input_schema: {
        type: 'object',
        required: ['tool_id'],
        properties: {
          tool_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_tool_definitions.update'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const { tool_id, ...updateFields } = input as {
        tool_id: string;
        [key: string]: unknown;
      };
      const parsed = updateToolDefinitionSchema.safeParse(updateFields);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; '),
        );
      }
      const tool = await svc.updateToolDefinition(
        sql, ctx.tenantId, tool_id,
        parsed.data as UpdateToolDefinitionInput,
      );
      return {
        data: tool,
        object_id: tool.id,
        object_type: 'ai_tool_definition',
        before: null,
        after: tool,
        event_type: 'rasid.mod.ai.tool_def.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_def.delete',
      display_name: 'Delete AI Tool Definition',
      module_id: 'mod_ai',
      verb: 'delete',
      resource: 'ai_tool_definitions',
      input_schema: {
        type: 'object',
        required: ['tool_id'],
        properties: { tool_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_tool_definitions.delete'],
      sensitivity: 'high',
    },
    async (input, ctx, sql) => {
      const { tool_id } = input as { tool_id: string };
      await svc.deleteToolDefinition(sql, ctx.tenantId, tool_id);
      return {
        data: null,
        object_id: tool_id,
        object_type: 'ai_tool_definition',
        before: null,
        after: null,
        event_type: 'rasid.mod.ai.tool_def.deleted',
      };
    },
  );

  // ═══════════════════════════════════════════
  // TOOL BINDINGS
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_binding.create',
      display_name: 'Create AI Tool Binding',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_tool_bindings',
      input_schema: {
        type: 'object',
        required: ['tool_id', 'action_id'],
        properties: {
          tool_id: { type: 'string' },
          action_id: { type: 'string' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_tool_bindings.create'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const parsed = createToolBindingSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; '),
        );
      }
      const binding = await svc.createToolBinding(
        sql, ctx.tenantId, parsed.data as CreateToolBindingInput,
      );
      return {
        data: binding,
        object_id: binding.id,
        object_type: 'ai_tool_binding',
        before: null,
        after: binding,
        event_type: 'rasid.mod.ai.tool_binding.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_binding.list',
      display_name: 'List AI Tool Bindings',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_tool_bindings',
      input_schema: {
        type: 'object',
        required: [],
        properties: { tool_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_tool_bindings.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { tool_id } = (input ?? {}) as { tool_id?: string };
      const data = await svc.listToolBindings(sql, ctx.tenantId, tool_id);
      return {
        data,
        object_id: null,
        object_type: 'ai_tool_binding',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_binding.delete',
      display_name: 'Delete AI Tool Binding',
      module_id: 'mod_ai',
      verb: 'delete',
      resource: 'ai_tool_bindings',
      input_schema: {
        type: 'object',
        required: ['binding_id'],
        properties: { binding_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_tool_bindings.delete'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const { binding_id } = input as { binding_id: string };
      await svc.deleteToolBinding(sql, ctx.tenantId, binding_id);
      return {
        data: null,
        object_id: binding_id,
        object_type: 'ai_tool_binding',
        before: null,
        after: null,
        event_type: 'rasid.mod.ai.tool_binding.deleted',
      };
    },
  );

  // ═══════════════════════════════════════════
  // SYNC FROM REGISTRY
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool_registry.sync',
      display_name: 'Sync AI Tool Registry from Actions',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_tool_definitions',
      input_schema: { type: 'object', required: [], properties: {} },
      output_schema: {},
      required_permissions: ['ai_tool_definitions.create'],
      sensitivity: 'medium',
    },
    async (_input, ctx, sql) => {
      const result = await svc.syncFromRegistry(sql, ctx.tenantId);
      return {
        data: result,
        object_id: null,
        object_type: 'ai_tool_registry',
        before: null,
        after: result,
        event_type: 'rasid.mod.ai.tool_registry.synced',
      };
    },
  );
}

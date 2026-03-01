/**
 * M21 AI Engine — RAG Engine K3 Actions (Step 4)
 *
 * All actions go through K3 pipeline (validateInput → checkPermission → handler → audit → event).
 * K3 handles audit and event emission automatically via handler return values.
 * No external calls. No embeddings. No vector DB.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { ragService } from './rag.service.js';
import { CreateRagSourceSchema, UpdateRagSourceSchema, RagRetrieveSchema } from './rag.schema.js';
import { NotFoundError, ValidationError } from '@rasid/shared';
import type { RequestContext } from '@rasid/shared';
import type postgres from 'postgres';

export function registerRagActions(): void {
  // ── source.create ──
  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.rag.source.create',
      display_name: 'Create RAG Source',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_rag_sources',
      input_schema: {
        type: 'object',
        required: ['name', 'module_id', 'object_type'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          module_id: { type: 'string' },
          object_type: { type: 'string' },
          metadata_filters: { type: 'object' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['ai_rag_sources.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const parsed = CreateRagSourceSchema.parse(input);
      const source = await ragService.createSource(sql, ctx.tenantId, parsed);
      return {
        data: source,
        object_id: source.id,
        object_type: 'rag_source',
        before: null,
        after: source,
        event_type: 'rasid.mod.ai.rag.source.created',
      };
    },
  );

  // ── source.list ──
  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.rag.source.list',
      display_name: 'List RAG Sources',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_rag_sources',
      input_schema: { type: 'object', properties: {} },
      output_schema: { type: 'object' },
      required_permissions: ['ai_rag_sources.read'],
      sensitivity: 'low',
    },
    async (_input, ctx, sql) => {
      const sources = await ragService.listSources(sql, ctx.tenantId);
      return {
        data: sources,
        object_id: null,
        object_type: 'rag_source',
        before: null,
        after: null,
      };
    },
  );

  // ── source.get ──
  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.rag.source.get',
      display_name: 'Get RAG Source',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_rag_sources',
      input_schema: {
        type: 'object',
        required: ['source_id'],
        properties: { source_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      required_permissions: ['ai_rag_sources.read'],
      sensitivity: 'low',
    },
    async (input, _ctx, sql) => {
      const { source_id } = input as { source_id: string };
      const source = await ragService.getSource(sql, source_id);
      return {
        data: source,
        object_id: source.id,
        object_type: 'rag_source',
        before: null,
        after: null,
      };
    },
  );

  // ── source.update ──
  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.rag.source.update',
      display_name: 'Update RAG Source',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_rag_sources',
      input_schema: {
        type: 'object',
        required: ['source_id'],
        properties: {
          source_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          module_id: { type: 'string' },
          object_type: { type: 'string' },
          metadata_filters: { type: 'object' },
          status: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['ai_rag_sources.update'],
      sensitivity: 'low',
    },
    async (input, _ctx, sql) => {
      const { source_id, ...rest } = input as Record<string, unknown>;
      const parsed = UpdateRagSourceSchema.parse(rest);
      const source = await ragService.updateSource(sql, source_id as string, parsed);
      return {
        data: source,
        object_id: source.id,
        object_type: 'rag_source',
        before: null,
        after: source,
        event_type: 'rasid.mod.ai.rag.source.updated',
      };
    },
  );

  // ── source.delete ──
  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.rag.source.delete',
      display_name: 'Delete RAG Source',
      module_id: 'mod_ai',
      verb: 'delete',
      resource: 'ai_rag_sources',
      input_schema: {
        type: 'object',
        required: ['source_id'],
        properties: { source_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      required_permissions: ['ai_rag_sources.delete'],
      sensitivity: 'medium',
    },
    async (input, _ctx, sql) => {
      const { source_id } = input as { source_id: string };
      await ragService.deleteSource(sql, source_id);
      return {
        data: { deleted: true },
        object_id: source_id,
        object_type: 'rag_source',
        before: null,
        after: null,
        event_type: 'rasid.mod.ai.rag.source.deleted',
      };
    },
  );

  // ── retrieve ──
  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.rag.retrieve',
      display_name: 'RAG Retrieve',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_rag_retrieval',
      input_schema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          source_ids: { type: 'array' },
          limit: { type: 'number' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['ai_rag_retrieval.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const parsed = RagRetrieveSchema.parse(input);
      const result = await ragService.retrieve(sql, ctx.tenantId, ctx.userId, parsed);
      return {
        data: result,
        object_id: null,
        object_type: 'rag_retrieval',
        before: null,
        after: { query: parsed.query, results: result.total },
        event_type: 'rasid.mod.ai.rag.retrieved',
      };
    },
  );

  // ── logs.list ──
  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.rag.logs.list',
      display_name: 'List RAG Retrieval Logs',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_rag_retrieval',
      input_schema: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
      output_schema: { type: 'object' },
      required_permissions: ['ai_rag_retrieval.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { limit } = input as { limit?: number };
      const logs = await ragService.listRetrievalLogs(sql, ctx.tenantId, limit);
      return {
        data: logs,
        object_id: null,
        object_type: 'rag_retrieval_log',
        before: null,
        after: null,
      };
    },
  );

  console.log('[M21-S4] ✓ RAG Engine actions registered (7)');
}

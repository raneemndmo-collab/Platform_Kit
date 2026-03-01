/**
 * M12 Search Engine -- K3 Action Handlers
 * ALL endpoints (read + write) go through K3 for RBAC enforcement.
 * No endpoint relies on authMiddleware alone.
 */

import { actionRegistry } from '../../../kernel/src/index.js';
import { SearchService } from './search.service.js';
import {
  searchQuerySchema,
  createIndexEntrySchema,
  createSynonymSchema,
  updateSynonymSchema,
  reindexSchema,
} from './search.schema.js';

const service = new SearchService();

export function registerSearchActions(): void {

  /* ═══════════════════════════════════════════
   * SEARCH QUERY
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.query',
      display_name: 'Execute Search Query',
      module_id: 'mod_search',
      verb: 'read',
      resource: 'search_index',
      input_schema: { type: 'object', properties: { q: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['search_index.read'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const parsed = searchQuerySchema.parse(input);
      const result = await service.search(sql, ctx.tenantId, parsed);
      return {
        data: result,
        object_id: null,
        object_type: 'search_query',
        before: null,
        after: null,
        event_type: 'rasid.mod.search.queried',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * INDEX ENTRY CRUD
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.index.create',
      display_name: 'Index Entry',
      module_id: 'mod_search',
      verb: 'create',
      resource: 'search_index',
      input_schema: { type: 'object', required: ['object_id', 'object_type', 'module_id', 'title'] },
      output_schema: {},
      required_permissions: ['search_index.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const parsed = createIndexEntrySchema.parse(input);
      const entry = await service.indexEntry(sql, ctx.tenantId, ctx.userId, parsed);
      return {
        data: entry,
        object_id: entry.id,
        object_type: 'search_index_entry',
        before: null,
        after: entry,
        event_type: 'rasid.mod.search.indexed',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.index.delete',
      display_name: 'Remove Index Entry',
      module_id: 'mod_search',
      verb: 'delete',
      resource: 'search_index',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['search_index.delete'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { id } = input as { id: string };
      await service.removeEntry(sql, id);
      return {
        data: null,
        object_id: id,
        object_type: 'search_index_entry',
        before: null,
        after: null,
        event_type: 'rasid.mod.search.entry.removed',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.reindex',
      display_name: 'Reindex Entries',
      module_id: 'mod_search',
      verb: 'update',
      resource: 'search_index',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['search_index.reindex'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const parsed = reindexSchema.parse(input);
      const result = await service.reindex(sql, ctx.tenantId, parsed);
      return {
        data: result,
        object_id: null,
        object_type: 'search_reindex',
        before: null,
        after: result,
        event_type: 'rasid.mod.search.reindexed',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * SYNONYM CRUD
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.synonym.list',
      display_name: 'List Synonyms',
      module_id: 'mod_search',
      verb: 'read',
      resource: 'search_synonyms',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['search_synonyms.read'],
      sensitivity: 'standard',
    },
    async (_input, ctx, sql) => {
      const synonyms = await service.listSynonyms(sql, ctx.tenantId);
      return {
        data: synonyms,
        object_id: null,
        object_type: 'search_synonym',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.synonym.get',
      display_name: 'Get Synonym',
      module_id: 'mod_search',
      verb: 'read',
      resource: 'search_synonyms',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['search_synonyms.read'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { id } = input as { id: string };
      const synonym = await service.getSynonym(sql, id);
      return {
        data: synonym,
        object_id: id,
        object_type: 'search_synonym',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.synonym.create',
      display_name: 'Create Synonym',
      module_id: 'mod_search',
      verb: 'create',
      resource: 'search_synonyms',
      input_schema: { type: 'object', required: ['term', 'synonyms'] },
      output_schema: {},
      required_permissions: ['search_synonyms.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const parsed = createSynonymSchema.parse(input);
      const synonym = await service.createSynonym(sql, ctx.tenantId, parsed);
      return {
        data: synonym,
        object_id: synonym.id,
        object_type: 'search_synonym',
        before: null,
        after: synonym,
        event_type: 'rasid.mod.search.synonym.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.synonym.update',
      display_name: 'Update Synonym',
      module_id: 'mod_search',
      verb: 'update',
      resource: 'search_synonyms',
      input_schema: { type: 'object', required: ['id', 'synonyms'] },
      output_schema: {},
      required_permissions: ['search_synonyms.update'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { id, ...rest } = input as { id: string; synonyms: string[] };
      const parsed = updateSynonymSchema.parse(rest);
      const before = await service.getSynonym(sql, id);
      const synonym = await service.updateSynonym(sql, id, parsed);
      return {
        data: synonym,
        object_id: synonym.id,
        object_type: 'search_synonym',
        before,
        after: synonym,
        event_type: 'rasid.mod.search.synonym.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.synonym.delete',
      display_name: 'Delete Synonym',
      module_id: 'mod_search',
      verb: 'delete',
      resource: 'search_synonyms',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['search_synonyms.delete'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { id } = input as { id: string };
      const before = await service.getSynonym(sql, id);
      await service.deleteSynonym(sql, id);
      return {
        data: null,
        object_id: id,
        object_type: 'search_synonym',
        before,
        after: null,
        event_type: 'rasid.mod.search.synonym.deleted',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * ANALYTICS (read-only)
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.search.analytics.list',
      display_name: 'List Search Analytics',
      module_id: 'mod_search',
      verb: 'read',
      resource: 'search_analytics',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['search_analytics.read'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const limit = (input as { limit?: number }).limit;
      const analytics = await service.listAnalytics(sql, ctx.tenantId, limit);
      return {
        data: analytics,
        object_id: null,
        object_type: 'search_analytics',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );
}

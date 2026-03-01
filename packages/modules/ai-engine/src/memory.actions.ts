/**
 * M21 AI Engine — Memory Layer K3 Actions (Step 5)
 *
 * All mutations go through K3 pipeline.
 * Session-scoped memory only. No cross-session sharing.
 * No auto-execution. No background jobs. No timed-jobs.
 * Handler signature: (input, ctx, sql) => Promise<ActionHandlerResult>
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { memoryService as svc } from './memory.service.js';
import {
  createMemorySessionSchema,
  updateMemorySessionSchema,
  addMemoryEntrySchema,
  listMemoryEntriesSchema,
  deleteMemorySessionSchema,
  getMemorySessionSchema,
} from './memory.schema.js';

export function registerMemoryActions(): void {

  // ═══════════════════════════════════════════
  // SESSION CRUD
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.memory.session.create',
      display_name: 'Create Memory Session',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_memory_sessions',
      input_schema: {
        type: 'object',
        required: [],
        properties: {
          label: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_memory_sessions.create'],
    },
    async (input, ctx, sql) => {
      const parsed = createMemorySessionSchema.parse(input);
      const session = await svc.createSession(sql, ctx.tenantId, ctx.userId, parsed);
      return {
        data: session,
        event_type: 'ai.memory.session.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.memory.session.get',
      display_name: 'Get Memory Session',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_memory_sessions',
      input_schema: {
        type: 'object',
        required: ['session_id'],
        properties: { session_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_memory_sessions.read'],
    },
    async (input, ctx, sql) => {
      const parsed = getMemorySessionSchema.parse(input);
      const session = await svc.getSession(sql, ctx.tenantId, parsed.session_id);
      return { data: session };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.memory.session.list',
      display_name: 'List Memory Sessions',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_memory_sessions',
      input_schema: {
        type: 'object',
        required: [],
        properties: {
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_memory_sessions.read'],
    },
    async (input, ctx, sql) => {
      const inp = input as Record<string, unknown>;
      const limit = typeof inp?.limit === 'number' ? inp.limit : 50;
      const offset = typeof inp?.offset === 'number' ? inp.offset : 0;
      const result = await svc.listSessions(sql, ctx.tenantId, ctx.userId, limit, offset);
      return { data: result };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.memory.session.update',
      display_name: 'Update Memory Session',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_memory_sessions',
      input_schema: {
        type: 'object',
        required: ['session_id'],
        properties: {
          session_id: { type: 'string' },
          label: { type: 'string' },
          metadata: { type: 'object' },
          status: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_memory_sessions.update'],
    },
    async (input, ctx, sql) => {
      const parsed = updateMemorySessionSchema.parse(input);
      const { session_id, ...updateData } = parsed;
      const session = await svc.updateSession(sql, ctx.tenantId, session_id, updateData);
      return {
        data: session,
        event_type: 'ai.memory.session.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.memory.session.delete',
      display_name: 'Delete Memory Session',
      module_id: 'mod_ai',
      verb: 'delete',
      resource: 'ai_memory_sessions',
      input_schema: {
        type: 'object',
        required: ['session_id'],
        properties: { session_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'high',
      required_permissions: ['ai_memory_sessions.delete'],
    },
    async (input, ctx, sql) => {
      const parsed = deleteMemorySessionSchema.parse(input);
      await svc.deleteSession(sql, ctx.tenantId, parsed.session_id);
      return {
        data: { deleted: true },
        event_type: 'ai.memory.session.deleted',
      };
    },
  );

  // ═══════════════════════════════════════════
  // ENTRY MANAGEMENT
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.memory.entry.add',
      display_name: 'Add Memory Entry',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_memory_entries',
      input_schema: {
        type: 'object',
        required: ['session_id', 'role', 'content'],
        properties: {
          session_id: { type: 'string' },
          role: { type: 'string' },
          content: { type: 'object' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_memory_entries.create'],
    },
    async (input, ctx, sql) => {
      const parsed = addMemoryEntrySchema.parse(input);
      const entry = await svc.addEntry(sql, ctx.tenantId, ctx.userId, parsed);
      return {
        data: entry,
        event_type: 'ai.memory.entry.added',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.memory.entry.list',
      display_name: 'List Memory Entries',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_memory_entries',
      input_schema: {
        type: 'object',
        required: ['session_id'],
        properties: {
          session_id: { type: 'string' },
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_memory_entries.read'],
    },
    async (input, ctx, sql) => {
      const parsed = listMemoryEntriesSchema.parse(input);
      const result = await svc.listEntries(sql, ctx.tenantId, parsed);
      return { data: result };
    },
  );

  console.log('[M21-S5] ✓ Memory Layer actions registered (7)');
}

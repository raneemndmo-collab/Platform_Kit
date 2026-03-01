/**
 * M21 AI Engine — K3 Action Registration (Step 1: Core)
 *
 * All mutations go through K3 pipeline.
 * Tool invocation uses K3 executeAction internally.
 * No external LLM calls. Deterministic responses.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { aiEngineService as svc } from './ai-engine.service.js';
import {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  invokeToolSchema,
} from './ai-engine.schema.js';
import type {
  CreateConversationInput,
  UpdateConversationInput,
  SendMessageInput,
  InvokeToolInput,
} from './ai-engine.types.js';
import { ValidationError, NotFoundError } from '@rasid/shared';

export function registerAiEngineActions(): void {
  // ═══════════════════════════════════════════
  // CONVERSATION CRUD
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.conversation.create',
      display_name: 'Create AI Conversation',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_conversations',
      input_schema: {
        type: 'object',
        required: [],
        properties: {
          title: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_conversations.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const raw = (input as Record<string, unknown>).input ?? input;
      const parsed = createConversationSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        );
      }
      const conv = await svc.createConversation(
        sql, ctx.tenantId, ctx.userId, parsed.data as CreateConversationInput,
      );
      return {
        data: conv,
        object_id: conv.id,
        object_type: 'ai_conversation',
        before: null,
        after: conv,
        event_type: 'rasid.mod.ai.conversation.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.conversation.list',
      display_name: 'List AI Conversations',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_conversations',
      input_schema: { type: 'object', required: [], properties: {} },
      output_schema: {},
      required_permissions: ['ai_conversations.read'],
      sensitivity: 'low',
    },
    async (_input, ctx, sql) => {
      const data = await svc.listConversations(sql, ctx.tenantId, ctx.userId);
      return {
        data,
        object_id: null,
        object_type: 'ai_conversation',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.conversation.get',
      display_name: 'Get AI Conversation',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_conversations',
      input_schema: {
        type: 'object',
        required: ['conversation_id'],
        properties: { conversation_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_conversations.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { conversation_id } = input as { conversation_id: string };
      const conv = await svc.getConversation(sql, ctx.tenantId, conversation_id);
      if (!conv) throw new NotFoundError(`Conversation ${conversation_id} not found`);
      return {
        data: conv,
        object_id: conv.id,
        object_type: 'ai_conversation',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.conversation.update',
      display_name: 'Update AI Conversation',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_conversations',
      input_schema: {
        type: 'object',
        required: ['conversation_id'],
        properties: {
          conversation_id: { type: 'string' },
          input: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_conversations.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { conversation_id, input: raw } = input as {
        conversation_id: string;
        input: Record<string, unknown>;
      };
      const parsed = updateConversationSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        );
      }
      const conv = await svc.updateConversation(
        sql, ctx.tenantId, conversation_id, parsed.data as UpdateConversationInput,
      );
      return {
        data: conv,
        object_id: conv.id,
        object_type: 'ai_conversation',
        before: null,
        after: conv,
        event_type: 'rasid.mod.ai.conversation.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.conversation.delete',
      display_name: 'Delete AI Conversation',
      module_id: 'mod_ai',
      verb: 'delete',
      resource: 'ai_conversations',
      input_schema: {
        type: 'object',
        required: ['conversation_id'],
        properties: { conversation_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_conversations.delete'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const { conversation_id } = input as { conversation_id: string };
      await svc.deleteConversation(sql, ctx.tenantId, conversation_id);
      return {
        data: null,
        object_id: conversation_id,
        object_type: 'ai_conversation',
        before: null,
        after: null,
        event_type: 'rasid.mod.ai.conversation.deleted',
      };
    },
  );

  // ═══════════════════════════════════════════
  // CHAT (send message + get response)
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.chat',
      display_name: 'Send AI Chat Message',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_messages',
      input_schema: {
        type: 'object',
        required: ['conversation_id', 'content'],
        properties: {
          conversation_id: { type: 'string' },
          content: { type: 'string' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_messages.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { conversation_id, content } = input as {
        conversation_id: string;
        content: string;
      };
      const parsed = sendMessageSchema.safeParse({ content });
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        );
      }
      // Verify conversation exists
      const conv = await svc.getConversation(sql, ctx.tenantId, conversation_id);
      if (!conv) throw new NotFoundError(`Conversation ${conversation_id} not found`);

      // Store user message
      const userMsg = await svc.addMessage(
        sql, ctx.tenantId, conversation_id, 'user', parsed.data.content,
      );

      // Generate deterministic response (mocked inference)
      const responseText = await svc.generateResponse(
        sql, ctx.tenantId, conversation_id, parsed.data.content,
      );

      // Store assistant message
      const assistantMsg = await svc.addMessage(
        sql, ctx.tenantId, conversation_id, 'assistant', responseText,
      );

      return {
        data: {
          user_message: userMsg,
          assistant_message: assistantMsg,
        },
        object_id: conversation_id,
        object_type: 'ai_conversation',
        before: null,
        after: { user_message: userMsg, assistant_message: assistantMsg },
        event_type: 'rasid.mod.ai.chat.completed',
      };
    },
  );

  // ═══════════════════════════════════════════
  // MESSAGES (list)
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.messages.list',
      display_name: 'List AI Conversation Messages',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_messages',
      input_schema: {
        type: 'object',
        required: ['conversation_id'],
        properties: { conversation_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_messages.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { conversation_id } = input as { conversation_id: string };
      const data = await svc.listMessages(sql, ctx.tenantId, conversation_id);
      return {
        data,
        object_id: null,
        object_type: 'ai_message',
        before: null,
        after: null,
      };
    },
  );

  // ═══════════════════════════════════════════
  // TOOL INVOCATION (via K3 internally)
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool.invoke',
      display_name: 'AI Invoke Platform Tool',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_tool_invocations',
      input_schema: {
        type: 'object',
        required: ['conversation_id', 'action_id', 'input'],
        properties: {
          conversation_id: { type: 'string' },
          action_id: { type: 'string' },
          input: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_tool_invocations.create'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const { conversation_id, action_id, input: toolInput } = input as {
        conversation_id: string;
        action_id: string;
        input: Record<string, unknown>;
      };

      // Verify conversation exists
      const conv = await svc.getConversation(sql, ctx.tenantId, conversation_id);
      if (!conv) throw new NotFoundError(`Conversation ${conversation_id} not found`);

      // Verify target action exists in registry
      const manifest = actionRegistry.getManifest(action_id);
      if (!manifest) {
        // Record failed invocation
        const inv = await svc.recordToolInvocation(
          sql, ctx.tenantId, conversation_id,
          action_id, toolInput, null,
          'failure', `Action ${action_id} not found in registry`,
          [],
        );
        // Add tool_result message
        await svc.addMessage(
          sql, ctx.tenantId, conversation_id,
          'tool_result',
          `Tool invocation failed: Action ${action_id} not found`,
          inv.id,
        );
        return {
          data: { invocation: inv, success: false },
          object_id: inv.id,
          object_type: 'ai_tool_invocation',
          before: null,
          after: inv,
          event_type: 'rasid.mod.ai.tool.failed',
        };
      }

      // Execute the target action via K3 pipeline
      // (uses the SAME user context — AI operates under user's permissions)
      try {
        const result = await actionRegistry.executeAction(
          action_id, toolInput, ctx, sql,
        );

        // Record successful invocation
        const inv = await svc.recordToolInvocation(
          sql, ctx.tenantId, conversation_id,
          action_id, toolInput,
          { data: result.data } as Record<string, unknown>,
          'success', null,
          manifest.required_permissions,
        );

        // Add tool_result message
        await svc.addMessage(
          sql, ctx.tenantId, conversation_id,
          'tool_result',
          JSON.stringify({ action_id, status: 'success', data: result.data }),
          inv.id,
        );

        return {
          data: { invocation: inv, result: result.data, success: true },
          object_id: inv.id,
          object_type: 'ai_tool_invocation',
          before: null,
          after: inv,
          event_type: 'rasid.mod.ai.tool.invoked',
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        // Record failed invocation
        const inv = await svc.recordToolInvocation(
          sql, ctx.tenantId, conversation_id,
          action_id, toolInput, null,
          'failure', errorMsg,
          manifest.required_permissions,
        );

        // Add tool_result message
        await svc.addMessage(
          sql, ctx.tenantId, conversation_id,
          'tool_result',
          `Tool invocation failed: ${errorMsg}`,
          inv.id,
        );

        return {
          data: { invocation: inv, success: false, error: errorMsg },
          object_id: inv.id,
          object_type: 'ai_tool_invocation',
          before: null,
          after: inv,
          event_type: 'rasid.mod.ai.tool.failed',
        };
      }
    },
  );

  // ═══════════════════════════════════════════
  // TOOL INVOCATIONS (list)
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tool.list',
      display_name: 'List AI Tool Invocations',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_tool_invocations',
      input_schema: {
        type: 'object',
        required: ['conversation_id'],
        properties: { conversation_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_tool_invocations.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { conversation_id } = input as { conversation_id: string };
      const data = await svc.listToolInvocations(sql, ctx.tenantId, conversation_id);
      return {
        data,
        object_id: null,
        object_type: 'ai_tool_invocation',
        before: null,
        after: null,
      };
    },
  );

  // ═══════════════════════════════════════════
  // TOOL DISCOVERY (list available actions)
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.tools.discover',
      display_name: 'Discover Available AI Tools',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_tool_invocations',
      input_schema: {
        type: 'object',
        required: [],
        properties: {
          module: { type: 'string' },
          verb: { type: 'string' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_tool_invocations.read'],
      sensitivity: 'low',
    },
    async (input, _ctx, _sql) => {
      const { module, verb } = (input ?? {}) as {
        module?: string;
        verb?: string;
      };
      const tools = actionRegistry.listActions({ module, verb });
      const toolList = tools.map((t) => ({
        action_id: t.action_id,
        display_name: t.display_name,
        module_id: t.module_id,
        verb: t.verb,
        resource: t.resource,
        required_permissions: t.required_permissions,
        sensitivity: t.sensitivity,
      }));
      return {
        data: { tools: toolList, count: toolList.length },
        object_id: null,
        object_type: 'ai_tool_discovery',
        before: null,
        after: null,
      };
    },
  );
}

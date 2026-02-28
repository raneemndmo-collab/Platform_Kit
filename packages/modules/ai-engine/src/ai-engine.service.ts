/**
 * M21 AI Engine — Service (Step 1: Core)
 *
 * Data operations for conversations, messages, tool invocations.
 * All writes called from K3 action handlers (not directly from routes).
 * Schema: mod_ai
 * No direct DB access to other module schemas.
 * Deterministic responses (mocked inference) — no external LLM.
 */
import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type {
  Conversation,
  Message,
  ToolInvocation,
  CreateConversationInput,
  UpdateConversationInput,
} from './ai-engine.types.js';
import type { AiEngineServiceInterface } from './ai-engine.interface.js';
import { NotFoundError } from '@rasid/shared';

type Sql = postgres.Sql | postgres.ReservedSql;

export class AiEngineService implements AiEngineServiceInterface {
  // ─────────── Conversation CRUD ───────────

  async createConversation(
    sql: Sql, tenantId: string, userId: string,
    input: CreateConversationInput,
  ): Promise<Conversation> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_ai.conversations
        (id, tenant_id, user_id, title, status, metadata, created_at, updated_at)
      VALUES (
        ${id}, ${tenantId}, ${userId},
        ${input.title || 'New Conversation'},
        'active',
        ${JSON.stringify(input.metadata || {})}::jsonb,
        ${now}, ${now}
      )
      RETURNING *
    `;
    return this.mapConversation(rows[0]);
  }

  async listConversations(
    sql: Sql, tenantId: string, userId: string,
  ): Promise<Conversation[]> {
    const rows = await sql`
      SELECT * FROM mod_ai.conversations
      WHERE tenant_id = ${tenantId} AND user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    return rows.map(this.mapConversation);
  }

  async getConversation(
    sql: Sql, tenantId: string, conversationId: string,
  ): Promise<Conversation | null> {
    const rows = await sql`
      SELECT * FROM mod_ai.conversations
      WHERE id = ${conversationId} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapConversation(rows[0]) : null;
  }

  async updateConversation(
    sql: Sql, tenantId: string, conversationId: string,
    input: UpdateConversationInput,
  ): Promise<Conversation> {
    const existing = await this.getConversation(sql, tenantId, conversationId);
    if (!existing) {
      throw new NotFoundError(`Conversation ${conversationId} not found`);
    }
    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE mod_ai.conversations SET
        title = ${input.title ?? existing.title},
        status = ${input.status ?? existing.status},
        updated_at = ${now}
      WHERE id = ${conversationId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapConversation(rows[0]);
  }

  async deleteConversation(
    sql: Sql, tenantId: string, conversationId: string,
  ): Promise<void> {
    const existing = await this.getConversation(sql, tenantId, conversationId);
    if (!existing) {
      throw new NotFoundError(`Conversation ${conversationId} not found`);
    }
    await sql`
      DELETE FROM mod_ai.conversations
      WHERE id = ${conversationId} AND tenant_id = ${tenantId}
    `;
  }

  // ─────────── Messages ───────────

  async addMessage(
    sql: Sql, tenantId: string, conversationId: string,
    role: string, content: string,
    toolInvocationId?: string | null,
  ): Promise<Message> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_ai.messages
        (id, conversation_id, tenant_id, role, content, tool_invocation_id, created_at)
      VALUES (
        ${id}, ${conversationId}, ${tenantId},
        ${role}, ${content}, ${toolInvocationId || null}, ${now}
      )
      RETURNING *
    `;
    // Update conversation updated_at
    await sql`
      UPDATE mod_ai.conversations SET updated_at = ${now}
      WHERE id = ${conversationId} AND tenant_id = ${tenantId}
    `;
    return this.mapMessage(rows[0]);
  }

  async listMessages(
    sql: Sql, tenantId: string, conversationId: string,
  ): Promise<Message[]> {
    const rows = await sql`
      SELECT * FROM mod_ai.messages
      WHERE conversation_id = ${conversationId} AND tenant_id = ${tenantId}
      ORDER BY created_at ASC
    `;
    return rows.map(this.mapMessage);
  }

  // ─────────── Tool Invocations ───────────

  async recordToolInvocation(
    sql: Sql, tenantId: string, conversationId: string,
    actionId: string, input: Record<string, unknown>,
    output: Record<string, unknown> | null,
    status: string, errorMessage: string | null,
    permissionsUsed: string[],
  ): Promise<ToolInvocation> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const completedAt = status !== 'pending' ? now : null;
    const rows = await sql`
      INSERT INTO mod_ai.tool_invocations
        (id, conversation_id, tenant_id, action_id, input, output,
         status, error_message, permissions_used, invoked_at, completed_at)
      VALUES (
        ${id}, ${conversationId}, ${tenantId},
        ${actionId},
        ${JSON.stringify(input)}::jsonb,
        ${output ? JSON.stringify(output) : null}::jsonb,
        ${status}, ${errorMessage},
        ${JSON.stringify(permissionsUsed)}::jsonb,
        ${now}, ${completedAt}
      )
      RETURNING *
    `;
    return this.mapToolInvocation(rows[0]);
  }

  async listToolInvocations(
    sql: Sql, tenantId: string, conversationId: string,
  ): Promise<ToolInvocation[]> {
    const rows = await sql`
      SELECT * FROM mod_ai.tool_invocations
      WHERE conversation_id = ${conversationId} AND tenant_id = ${tenantId}
      ORDER BY invoked_at ASC
    `;
    return rows.map(this.mapToolInvocation);
  }

  // ─────────── Deterministic Response (Mocked) ───────────

  async generateResponse(
    _sql: Sql, _tenantId: string, _conversationId: string,
    userMessage: string,
  ): Promise<string> {
    // Deterministic mocked inference — no external LLM call.
    // Returns a structured acknowledgment of the user message.
    const trimmed = userMessage.trim().toLowerCase();

    if (trimmed.startsWith('/tool ')) {
      return `[TOOL_REQUEST] Detected tool invocation request in message.`;
    }

    if (trimmed.includes('help') || trimmed.includes('مساعدة')) {
      return `I can help you interact with the platform. Available commands:\n` +
        `- Ask questions about your data\n` +
        `- Request tool invocations with /tool <action_id>\n` +
        `- List available tools`;
    }

    return `Acknowledged: "${userMessage.substring(0, 100)}". ` +
      `This is a deterministic response from the AI Engine Core. ` +
      `No external LLM is configured.`;
  }

  // ─────────── Mappers ───────────

  private mapConversation(row: Record<string, unknown>): Conversation {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      user_id: String(row.user_id),
      title: String(row.title),
      status: String(row.status) as Conversation['status'],
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapMessage(row: Record<string, unknown>): Message {
    return {
      id: String(row.id),
      conversation_id: String(row.conversation_id),
      tenant_id: String(row.tenant_id),
      role: String(row.role) as Message['role'],
      content: String(row.content),
      tool_invocation_id: row.tool_invocation_id
        ? String(row.tool_invocation_id)
        : null,
      created_at: String(row.created_at),
    };
  }

  private mapToolInvocation(row: Record<string, unknown>): ToolInvocation {
    return {
      id: String(row.id),
      conversation_id: String(row.conversation_id),
      tenant_id: String(row.tenant_id),
      action_id: String(row.action_id),
      input: (row.input ?? {}) as Record<string, unknown>,
      output: (row.output ?? null) as Record<string, unknown> | null,
      status: String(row.status) as ToolInvocation['status'],
      error_message: row.error_message ? String(row.error_message) : null,
      permissions_used: (row.permissions_used ?? []) as string[],
      invoked_at: String(row.invoked_at),
      completed_at: row.completed_at ? String(row.completed_at) : null,
    };
  }
}

export const aiEngineService = new AiEngineService();

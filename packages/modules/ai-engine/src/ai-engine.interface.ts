/**
 * M21 AI Engine — Service Interface (Step 1: Core)
 *
 * Chat sessions, messages, tool invocations.
 * All data operations are metadata-only.
 * No external LLM calls. No embeddings.
 */
import type postgres from 'postgres';
import type {
  Conversation,
  Message,
  ToolInvocation,
  CreateConversationInput,
  SendMessageInput,
  UpdateConversationInput,
} from './ai-engine.types.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export interface AiEngineServiceInterface {
  // Conversation CRUD
  createConversation(
    sql: Sql, tenantId: string, userId: string,
    input: CreateConversationInput,
  ): Promise<Conversation>;

  listConversations(
    sql: Sql, tenantId: string, userId: string,
  ): Promise<Conversation[]>;

  getConversation(
    sql: Sql, tenantId: string, conversationId: string,
  ): Promise<Conversation | null>;

  updateConversation(
    sql: Sql, tenantId: string, conversationId: string,
    input: UpdateConversationInput,
  ): Promise<Conversation>;

  deleteConversation(
    sql: Sql, tenantId: string, conversationId: string,
  ): Promise<void>;

  // Messages
  addMessage(
    sql: Sql, tenantId: string, conversationId: string,
    role: string, content: string, toolInvocationId?: string | null,
  ): Promise<Message>;

  listMessages(
    sql: Sql, tenantId: string, conversationId: string,
  ): Promise<Message[]>;

  // Tool invocations
  recordToolInvocation(
    sql: Sql, tenantId: string, conversationId: string,
    actionId: string, input: Record<string, unknown>,
    output: Record<string, unknown> | null,
    status: string, errorMessage: string | null,
    permissionsUsed: string[],
  ): Promise<ToolInvocation>;

  listToolInvocations(
    sql: Sql, tenantId: string, conversationId: string,
  ): Promise<ToolInvocation[]>;

  // Deterministic response (mocked inference)
  generateResponse(
    sql: Sql, tenantId: string, conversationId: string,
    userMessage: string,
  ): Promise<string>;
}

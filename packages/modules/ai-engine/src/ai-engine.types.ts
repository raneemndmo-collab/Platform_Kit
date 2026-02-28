/**
 * M21 AI Engine — Types (Step 1: Core)
 *
 * Chat session metadata, messages, tool invocations.
 * No external LLM types. No embeddings. No vector types.
 */

export type ConversationStatus = 'active' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool_result';
export type ToolInvocationStatus = 'success' | 'failure' | 'pending';

export interface Conversation {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  status: ConversationStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  tenant_id: string;
  role: MessageRole;
  content: string;
  tool_invocation_id: string | null;
  created_at: string;
}

export interface ToolInvocation {
  id: string;
  conversation_id: string;
  tenant_id: string;
  action_id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: ToolInvocationStatus;
  error_message: string | null;
  permissions_used: string[];
  invoked_at: string;
  completed_at: string | null;
}

export interface CreateConversationInput {
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageInput {
  content: string;
}

export interface InvokeToolInput {
  action_id: string;
  input: Record<string, unknown>;
}

export interface UpdateConversationInput {
  title?: string;
  status?: ConversationStatus;
}

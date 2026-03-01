/**
 * M21 AI Engine — Tool Registry Types (Step 2: Tool Registry + Action Binding)
 *
 * AI Tool definitions that wrap K3 Action Manifests with
 * AI-specific metadata: descriptions, parameter schemas,
 * categories, and enablement flags.
 *
 * No external LLM types. No embeddings. No vector types.
 */

export type ToolStatus = 'enabled' | 'disabled';
export type ToolCategory =
  | 'data_management'
  | 'analytics'
  | 'content'
  | 'communication'
  | 'administration'
  | 'ai'
  | 'general';

export interface ToolDefinition {
  id: string;
  tenant_id: string;
  action_id: string;
  name: string;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  parameter_schema: Record<string, unknown>;
  output_description: string;
  examples: ToolExample[];
  tags: string[];
  requires_confirmation: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolExample {
  input: string;
  description: string;
}

export interface ToolBinding {
  id: string;
  tenant_id: string;
  tool_id: string;
  action_id: string;
  input_mapping: Record<string, unknown>;
  output_mapping: Record<string, unknown>;
  pre_conditions: Record<string, unknown>;
  created_at: string;
}

export interface CreateToolDefinitionInput {
  action_id: string;
  name: string;
  description: string;
  category?: ToolCategory;
  parameter_schema?: Record<string, unknown>;
  output_description?: string;
  examples?: ToolExample[];
  tags?: string[];
  requires_confirmation?: boolean;
}

export interface UpdateToolDefinitionInput {
  name?: string;
  description?: string;
  category?: ToolCategory;
  status?: ToolStatus;
  parameter_schema?: Record<string, unknown>;
  output_description?: string;
  examples?: ToolExample[];
  tags?: string[];
  requires_confirmation?: boolean;
}

export interface CreateToolBindingInput {
  tool_id: string;
  action_id: string;
  input_mapping?: Record<string, unknown>;
  output_mapping?: Record<string, unknown>;
  pre_conditions?: Record<string, unknown>;
}

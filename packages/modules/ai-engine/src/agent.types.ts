/**
 * M21 AI Engine — Agent Framework Core Types (Step 3: Minimal Agent)
 *
 * Single agent definition with deterministic tool invocation.
 * No planner. No multi-agent. No recursive chaining. No async loops.
 * No autonomous execution. No self-reflection.
 * Agent calls ONE tool per request via Tool Registry → K3 pipeline.
 */

export type AgentStatus = 'active' | 'disabled';

/**
 * Agent definition — a named configuration that can invoke tools.
 * Each agent has a fixed set of allowed tools (by tool_id).
 * No dynamic tool discovery. No planning capability.
 */
export interface AgentDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: AgentStatus;
  /** List of tool_definition IDs this agent is allowed to invoke */
  allowed_tool_ids: string[];
  /** Static system prompt — no dynamic generation */
  system_prompt: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * A single agent execution record.
 * One request → one tool invocation → one result. No loops.
 */
export type ExecutionStatus = 'completed' | 'failed' | 'rejected';

export interface AgentExecution {
  id: string;
  tenant_id: string;
  agent_id: string;
  user_id: string;
  /** The tool_definition ID selected for this execution */
  tool_id: string;
  /** The K3 action_id resolved from the tool binding */
  action_id: string;
  /** Structured input provided by the caller */
  input: Record<string, unknown>;
  /** Structured output from the K3 action */
  output: Record<string, unknown> | null;
  status: ExecutionStatus;
  error_message: string | null;
  /** K4 policy decision recorded */
  policy_decision: 'allow' | 'deny';
  /** Duration in milliseconds */
  duration_ms: number;
  executed_at: string;
}

// ─── Input types ───

export interface CreateAgentInput {
  name: string;
  description: string;
  allowed_tool_ids?: string[];
  system_prompt?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  status?: AgentStatus;
  allowed_tool_ids?: string[];
  system_prompt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Execute agent request — exactly ONE tool per request.
 * No multi-step. No chaining. No planning.
 */
export interface ExecuteAgentInput {
  agent_id: string;
  tool_id: string;
  input: Record<string, unknown>;
}

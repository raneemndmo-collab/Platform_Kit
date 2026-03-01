/**
 * M21 AI Engine — Agent Framework Core Service (Step 3: Minimal Agent)
 *
 * Single agent definition with deterministic tool invocation.
 * One tool per request. No planner. No multi-agent. No recursive chaining.
 * No async loops. No autonomous execution. No self-reflection.
 *
 * Flow: Agent.execute → validate tool → K4 policy check → K3 executeAction → record result
 *
 * Schema: mod_ai
 * No direct DB access to other module schemas.
 */
import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type {
  AgentDefinition,
  AgentExecution,
  CreateAgentInput,
  UpdateAgentInput,
  ExecuteAgentInput,
  AgentStatus,
} from './agent.types.js';
import { NotFoundError, ValidationError, PermissionDeniedError } from '@rasid/shared';
import type { RequestContext } from '@rasid/shared';
import { actionRegistry } from '../../../kernel/src/index.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export class AgentService {

  // ═══════════════════════════════════════════
  // AGENT DEFINITION CRUD
  // ═══════════════════════════════════════════

  async createAgent(
    sql: Sql, tenantId: string, input: CreateAgentInput,
  ): Promise<AgentDefinition> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_ai.agent_definitions
        (id, tenant_id, name, description, status,
         allowed_tool_ids, system_prompt, metadata,
         created_at, updated_at)
      VALUES (
        ${id}, ${tenantId}, ${input.name}, ${input.description},
        'active',
        ${JSON.stringify(input.allowed_tool_ids ?? [])}::jsonb,
        ${input.system_prompt ?? ''},
        ${JSON.stringify(input.metadata ?? {})}::jsonb,
        ${now}, ${now}
      )
      RETURNING *
    `;
    return this.mapAgent(rows[0]);
  }

  async getAgent(
    sql: Sql, tenantId: string, agentId: string,
  ): Promise<AgentDefinition | null> {
    const rows = await sql`
      SELECT * FROM mod_ai.agent_definitions
      WHERE id = ${agentId} AND tenant_id = ${tenantId}
    `;
    return rows.length > 0 ? this.mapAgent(rows[0]) : null;
  }

  async listAgents(
    sql: Sql, tenantId: string,
  ): Promise<AgentDefinition[]> {
    const rows = await sql`
      SELECT * FROM mod_ai.agent_definitions
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map(this.mapAgent);
  }

  async updateAgent(
    sql: Sql, tenantId: string, agentId: string, input: UpdateAgentInput,
  ): Promise<AgentDefinition> {
    const existing = await this.getAgent(sql, tenantId, agentId);
    if (!existing) throw new NotFoundError(`Agent ${agentId} not found`);

    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE mod_ai.agent_definitions SET
        name = ${input.name ?? existing.name},
        description = ${input.description ?? existing.description},
        status = ${input.status ?? existing.status},
        allowed_tool_ids = ${JSON.stringify(input.allowed_tool_ids ?? existing.allowed_tool_ids)}::jsonb,
        system_prompt = ${input.system_prompt ?? existing.system_prompt},
        metadata = ${JSON.stringify(input.metadata ?? existing.metadata)}::jsonb,
        updated_at = ${now}
      WHERE id = ${agentId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapAgent(rows[0]);
  }

  async deleteAgent(
    sql: Sql, tenantId: string, agentId: string,
  ): Promise<void> {
    const existing = await this.getAgent(sql, tenantId, agentId);
    if (!existing) throw new NotFoundError(`Agent ${agentId} not found`);

    await sql`
      DELETE FROM mod_ai.agent_executions
      WHERE agent_id = ${agentId} AND tenant_id = ${tenantId}
    `;
    await sql`
      DELETE FROM mod_ai.agent_definitions
      WHERE id = ${agentId} AND tenant_id = ${tenantId}
    `;
  }

  // ═══════════════════════════════════════════
  // AGENT EXECUTION — ONE TOOL PER REQUEST
  // ═══════════════════════════════════════════

  /**
   * Execute agent: validate → policy check → invoke ONE tool → record.
   * NO loops. NO chaining. NO planning. NO autonomous behavior.
   */
  async executeAgent(
    sql: Sql, ctx: RequestContext, input: ExecuteAgentInput,
  ): Promise<AgentExecution> {
    const startTime = Date.now();

    // 1. Validate agent exists and is active
    const agent = await this.getAgent(sql, ctx.tenantId, input.agent_id);
    if (!agent) throw new NotFoundError(`Agent ${input.agent_id} not found`);
    if (agent.status !== 'active') {
      throw new ValidationError(`Agent ${input.agent_id} is disabled`);
    }

    // 2. Validate tool is in agent's allowed list
    if (!agent.allowed_tool_ids.includes(input.tool_id)) {
      const execution = await this.recordExecution(sql, ctx, input, {
        action_id: 'unknown',
        output: null,
        status: 'rejected',
        error_message: `Tool ${input.tool_id} is not in agent's allowed tools`,
        policy_decision: 'deny',
        duration_ms: Date.now() - startTime,
      });
      return execution;
    }

    // 3. Resolve tool → action_id via Tool Registry lookup
    const toolRow = await sql`
      SELECT action_id FROM mod_ai.tool_definitions
      WHERE id = ${input.tool_id} AND tenant_id = ${ctx.tenantId}
        AND status = 'enabled'
    `;
    if (toolRow.length === 0) {
      const execution = await this.recordExecution(sql, ctx, input, {
        action_id: 'unknown',
        output: null,
        status: 'rejected',
        error_message: `Tool ${input.tool_id} not found or disabled`,
        policy_decision: 'deny',
        duration_ms: Date.now() - startTime,
      });
      return execution;
    }
    const actionId = toolRow[0].action_id as string;

    // 4. Verify action exists in K3 registry
    const manifest = actionRegistry.getManifest(actionId);
    if (!manifest) {
      const execution = await this.recordExecution(sql, ctx, input, {
        action_id: actionId,
        output: null,
        status: 'failed',
        error_message: `Action ${actionId} not found in K3 registry`,
        policy_decision: 'allow',
        duration_ms: Date.now() - startTime,
      });
      return execution;
    }

    // 5. Execute via K3 pipeline (includes K4 policy enforcement + audit)
    try {
      const result = await actionRegistry.executeAction(actionId, input.input, ctx, sql);

      const execution = await this.recordExecution(sql, ctx, input, {
        action_id: actionId,
        output: result.data ?? null,
        status: 'completed',
        error_message: null,
        policy_decision: 'allow',
        duration_ms: Date.now() - startTime,
      });
      return execution;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isPermissionDenied = err instanceof PermissionDeniedError ||
        errMsg.includes('Permission denied') || errMsg.includes('policy');

      const execution = await this.recordExecution(sql, ctx, input, {
        action_id: actionId,
        output: null,
        status: isPermissionDenied ? 'rejected' : 'failed',
        error_message: errMsg,
        policy_decision: isPermissionDenied ? 'deny' : 'allow',
        duration_ms: Date.now() - startTime,
      });
      return execution;
    }
  }

  // ═══════════════════════════════════════════
  // EXECUTION HISTORY
  // ═══════════════════════════════════════════

  async listExecutions(
    sql: Sql, tenantId: string, agentId: string,
  ): Promise<AgentExecution[]> {
    const rows = await sql`
      SELECT * FROM mod_ai.agent_executions
      WHERE agent_id = ${agentId} AND tenant_id = ${tenantId}
      ORDER BY executed_at DESC
    `;
    return rows.map(this.mapExecution);
  }

  async getExecution(
    sql: Sql, tenantId: string, executionId: string,
  ): Promise<AgentExecution | null> {
    const rows = await sql`
      SELECT * FROM mod_ai.agent_executions
      WHERE id = ${executionId} AND tenant_id = ${tenantId}
    `;
    return rows.length > 0 ? this.mapExecution(rows[0]) : null;
  }

  // ═══════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════

  private async recordExecution(
    sql: Sql,
    ctx: RequestContext,
    input: ExecuteAgentInput,
    result: {
      action_id: string;
      output: Record<string, unknown> | null;
      status: 'completed' | 'failed' | 'rejected';
      error_message: string | null;
      policy_decision: 'allow' | 'deny';
      duration_ms: number;
    },
  ): Promise<AgentExecution> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_ai.agent_executions
        (id, tenant_id, agent_id, user_id, tool_id, action_id,
         input, output, status, error_message, policy_decision,
         duration_ms, executed_at)
      VALUES (
        ${id}, ${ctx.tenantId}, ${input.agent_id}, ${ctx.userId},
        ${input.tool_id}, ${result.action_id},
        ${JSON.stringify(input.input)}::jsonb,
        ${result.output ? JSON.stringify(result.output) : null}::jsonb,
        ${result.status}, ${result.error_message},
        ${result.policy_decision}, ${result.duration_ms}, ${now}
      )
      RETURNING *
    `;
    return this.mapExecution(rows[0]);
  }

  private mapAgent(row: Record<string, unknown>): AgentDefinition {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string,
      status: row.status as AgentStatus,
      allowed_tool_ids: (row.allowed_tool_ids ?? []) as string[],
      system_prompt: (row.system_prompt ?? '') as string,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapExecution(row: Record<string, unknown>): AgentExecution {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      agent_id: row.agent_id as string,
      user_id: row.user_id as string,
      tool_id: row.tool_id as string,
      action_id: row.action_id as string,
      input: (row.input ?? {}) as Record<string, unknown>,
      output: row.output as Record<string, unknown> | null,
      status: row.status as 'completed' | 'failed' | 'rejected',
      error_message: row.error_message as string | null,
      policy_decision: row.policy_decision as 'allow' | 'deny',
      duration_ms: Number(row.duration_ms ?? 0),
      executed_at: String(row.executed_at),
    };
  }
}

export const agentService = new AgentService();

/**
 * M21 AI Engine — Agent Framework Core K3 Actions (Step 3)
 *
 * All mutations go through K3 pipeline.
 * Agent execution invokes ONE tool per request via K3.
 * No planner actions. No multi-step actions. No autonomous loops.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { agentService as svc } from './agent.service.js';
import {
  createAgentSchema,
  updateAgentSchema,
  executeAgentSchema,
} from './agent.schema.js';
import type {
  CreateAgentInput,
  UpdateAgentInput,
} from './agent.types.js';
import { ValidationError, NotFoundError } from '@rasid/shared';

export function registerAgentActions(): void {

  // ═══════════════════════════════════════════
  // AGENT DEFINITION CRUD
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.agent.create',
      display_name: 'Create AI Agent',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_agents',
      input_schema: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          allowed_tool_ids: { type: 'array' },
          system_prompt: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_agents.create'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const raw = (input as Record<string, unknown>).input ?? input;
      const parsed = createAgentSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        );
      }
      const agent = await svc.createAgent(
        sql, ctx.tenantId, parsed.data as CreateAgentInput,
      );
      return {
        data: agent,
        object_id: agent.id,
        object_type: 'ai_agent',
        before: null,
        after: agent,
        event_type: 'rasid.mod.ai.agent.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.agent.list',
      display_name: 'List AI Agents',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_agents',
      input_schema: { type: 'object', required: [], properties: {} },
      output_schema: {},
      required_permissions: ['ai_agents.read'],
      sensitivity: 'low',
    },
    async (_input, ctx, sql) => {
      const data = await svc.listAgents(sql, ctx.tenantId);
      return {
        data,
        object_id: null,
        object_type: 'ai_agent',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.agent.get',
      display_name: 'Get AI Agent',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_agents',
      input_schema: {
        type: 'object',
        required: ['agent_id'],
        properties: { agent_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_agents.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { agent_id } = input as { agent_id: string };
      const agent = await svc.getAgent(sql, ctx.tenantId, agent_id);
      if (!agent) throw new NotFoundError(`Agent ${agent_id} not found`);
      return {
        data: agent,
        object_id: agent.id,
        object_type: 'ai_agent',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.agent.update',
      display_name: 'Update AI Agent',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_agents',
      input_schema: {
        type: 'object',
        required: ['agent_id'],
        properties: {
          agent_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          allowed_tool_ids: { type: 'array' },
          system_prompt: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_agents.update'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const { agent_id, ...rest } = input as { agent_id: string } & Record<string, unknown>;
      const parsed = updateAgentSchema.safeParse(rest);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        );
      }
      const agent = await svc.updateAgent(
        sql, ctx.tenantId, agent_id, parsed.data as UpdateAgentInput,
      );
      return {
        data: agent,
        object_id: agent.id,
        object_type: 'ai_agent',
        before: null,
        after: agent,
        event_type: 'rasid.mod.ai.agent.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.agent.delete',
      display_name: 'Delete AI Agent',
      module_id: 'mod_ai',
      verb: 'delete',
      resource: 'ai_agents',
      input_schema: {
        type: 'object',
        required: ['agent_id'],
        properties: { agent_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_agents.delete'],
      sensitivity: 'high',
    },
    async (input, ctx, sql) => {
      const { agent_id } = input as { agent_id: string };
      await svc.deleteAgent(sql, ctx.tenantId, agent_id);
      return {
        data: null,
        object_id: agent_id,
        object_type: 'ai_agent',
        before: null,
        after: null,
        event_type: 'rasid.mod.ai.agent.deleted',
      };
    },
  );

  // ═══════════════════════════════════════════
  // AGENT EXECUTION — ONE TOOL PER REQUEST
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.agent.execute',
      display_name: 'Execute AI Agent (Single Tool)',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_agent_executions',
      input_schema: {
        type: 'object',
        required: ['agent_id', 'tool_id', 'input'],
        properties: {
          agent_id: { type: 'string' },
          tool_id: { type: 'string' },
          input: { type: 'object' },
        },
      },
      output_schema: {},
      required_permissions: ['ai_agent_executions.create'],
      sensitivity: 'medium',
    },
    async (input, ctx, sql) => {
      const parsed = executeAgentSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        );
      }
      const execution = await svc.executeAgent(sql, ctx, parsed.data);
      return {
        data: execution,
        object_id: execution.id,
        object_type: 'ai_agent_execution',
        before: null,
        after: execution,
        event_type: `rasid.mod.ai.agent.execution.${execution.status}`,
      };
    },
  );

  // ═══════════════════════════════════════════
  // EXECUTION HISTORY
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.agent.executions.list',
      display_name: 'List Agent Executions',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_agent_executions',
      input_schema: {
        type: 'object',
        required: ['agent_id'],
        properties: { agent_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_agent_executions.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { agent_id } = input as { agent_id: string };
      const data = await svc.listExecutions(sql, ctx.tenantId, agent_id);
      return {
        data,
        object_id: null,
        object_type: 'ai_agent_execution',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.agent.execution.get',
      display_name: 'Get Agent Execution',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_agent_executions',
      input_schema: {
        type: 'object',
        required: ['execution_id'],
        properties: { execution_id: { type: 'string' } },
      },
      output_schema: {},
      required_permissions: ['ai_agent_executions.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { execution_id } = input as { execution_id: string };
      const execution = await svc.getExecution(sql, ctx.tenantId, execution_id);
      if (!execution) throw new NotFoundError(`Execution ${execution_id} not found`);
      return {
        data: execution,
        object_id: execution.id,
        object_type: 'ai_agent_execution',
        before: null,
        after: null,
      };
    },
  );
}

/**
 * M21 AI Engine — Guardrails K3 Actions (Step 6)
 *
 * All mutations go through K3 pipeline.
 * Guardrails wrap around execution — they do NOT replace K4 policy.
 * No silent prompt rewriting. No automatic tool override.
 * No hidden filtering. All enforcement is transparent and logged.
 * Handler signature: (input, ctx, sql) => Promise<ActionHandlerResult>
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { guardrailsService as svc } from './guardrails.service.js';
import {
  createGuardrailRuleSchema,
  updateGuardrailRuleSchema,
  deleteGuardrailRuleSchema,
  getGuardrailRuleSchema,
  evaluateGuardrailsSchema,
} from './guardrails.schema.js';

export function registerGuardrailsActions(): void {

  // ═══════════════════════════════════════════
  // RULE CRUD
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.guardrails.rule.create',
      display_name: 'Create Guardrail Rule',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_guardrail_rules',
      input_schema: {
        type: 'object',
        required: ['name', 'kind', 'action_pattern', 'condition', 'message'],
        properties: {
          name: { type: 'string' },
          kind: { type: 'string' },
          action_pattern: { type: 'string' },
          condition: { type: 'object' },
          message: { type: 'string' },
          description: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'high',
      required_permissions: ['ai_guardrail_rules.create'],
    },
    async (input, ctx, sql) => {
      const parsed = createGuardrailRuleSchema.parse(input);
      const rule = await svc.createRule(sql, ctx.tenantId, parsed);
      return {
        data: rule,
        event_type: 'ai.guardrails.rule.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.guardrails.rule.get',
      display_name: 'Get Guardrail Rule',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_guardrail_rules',
      input_schema: {
        type: 'object',
        required: ['rule_id'],
        properties: { rule_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'low',
      required_permissions: ['ai_guardrail_rules.read'],
    },
    async (input, ctx, sql) => {
      const parsed = getGuardrailRuleSchema.parse(input);
      const rule = await svc.getRule(sql, ctx.tenantId, parsed.rule_id);
      return { data: rule };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.guardrails.rule.list',
      display_name: 'List Guardrail Rules',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_guardrail_rules',
      input_schema: {
        type: 'object',
        required: [],
        properties: {
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'low',
      required_permissions: ['ai_guardrail_rules.read'],
    },
    async (input, ctx, sql) => {
      const inp = input as Record<string, unknown>;
      const limit = typeof inp?.limit === 'number' ? inp.limit : 50;
      const offset = typeof inp?.offset === 'number' ? inp.offset : 0;
      const result = await svc.listRules(sql, ctx.tenantId, limit, offset);
      return { data: result };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.guardrails.rule.update',
      display_name: 'Update Guardrail Rule',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_guardrail_rules',
      input_schema: {
        type: 'object',
        required: ['rule_id'],
        properties: {
          rule_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          kind: { type: 'string' },
          action_pattern: { type: 'string' },
          condition: { type: 'object' },
          message: { type: 'string' },
          status: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'high',
      required_permissions: ['ai_guardrail_rules.update'],
    },
    async (input, ctx, sql) => {
      const parsed = updateGuardrailRuleSchema.parse(input);
      const { rule_id, ...updateData } = parsed;
      const rule = await svc.updateRule(sql, ctx.tenantId, rule_id, updateData);
      return {
        data: rule,
        event_type: 'ai.guardrails.rule.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.guardrails.rule.delete',
      display_name: 'Delete Guardrail Rule',
      module_id: 'mod_ai',
      verb: 'delete',
      resource: 'ai_guardrail_rules',
      input_schema: {
        type: 'object',
        required: ['rule_id'],
        properties: { rule_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'high',
      required_permissions: ['ai_guardrail_rules.delete'],
    },
    async (input, ctx, sql) => {
      const parsed = deleteGuardrailRuleSchema.parse(input);
      await svc.deleteRule(sql, ctx.tenantId, parsed.rule_id);
      return {
        data: { deleted: true },
        event_type: 'ai.guardrails.rule.deleted',
      };
    },
  );

  // ═══════════════════════════════════════════
  // EVALUATION — transparent, logged
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.guardrails.evaluate',
      display_name: 'Evaluate Guardrails',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_guardrail_evaluations',
      input_schema: {
        type: 'object',
        required: ['action_id', 'input'],
        properties: {
          action_id: { type: 'string' },
          input: { type: 'object' },
          confirmation_token: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'medium',
      required_permissions: ['ai_guardrail_evaluations.read'],
    },
    async (input, ctx, sql) => {
      const parsed = evaluateGuardrailsSchema.parse(input);
      const result = await svc.evaluate(
        sql, ctx.tenantId, ctx.userId,
        parsed.action_id, parsed.input, parsed.confirmation_token,
      );
      return { data: result };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.guardrails.evaluations.list',
      display_name: 'List Guardrail Evaluations',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_guardrail_evaluations',
      input_schema: {
        type: 'object',
        required: [],
        properties: {
          action_id: { type: 'string' },
          rule_id: { type: 'string' },
          verdict: { type: 'string' },
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'low',
      required_permissions: ['ai_guardrail_evaluations.read'],
    },
    async (input, ctx, sql) => {
      const inp = input as Record<string, unknown>;
      const filters = {
        action_id: typeof inp?.action_id === 'string' ? inp.action_id : undefined,
        rule_id: typeof inp?.rule_id === 'string' ? inp.rule_id : undefined,
        verdict: typeof inp?.verdict === 'string' ? inp.verdict : undefined,
      };
      const limit = typeof inp?.limit === 'number' ? inp.limit : 50;
      const offset = typeof inp?.offset === 'number' ? inp.offset : 0;
      const result = await svc.listEvaluations(sql, ctx.tenantId, filters, limit, offset);
      return { data: result };
    },
  );

  console.log('[M21-S6] ✓ Guardrails actions registered (7)');
}

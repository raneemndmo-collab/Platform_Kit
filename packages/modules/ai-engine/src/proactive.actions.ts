/**
 * M21 AI Engine — Proactive Engine Actions (Step 7)
 *
 * All writes via K3 (actionRegistry.registerAction).
 * NO automatic execution. NO background listeners.
 * Suggestion generation only. User must explicitly accept/execute.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { proactiveService as svc } from './proactive.service.js';
import {
  createProactiveRuleSchema,
  updateProactiveRuleSchema,
  getProactiveRuleSchema,
  listProactiveRulesSchema,
  deleteProactiveRuleSchema,
  listSuggestionsSchema,
  getSuggestionSchema,
  dismissSuggestionSchema,
  acceptSuggestionSchema,
  evaluateEventSchema,
} from './proactive.schema.js';

export function registerProactiveActions(): void {

  // ═══════════════════════════════════════════
  // RULE MANAGEMENT
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.rule.create',
      display_name: 'Create Proactive Rule',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_proactive_rules',
      input_schema: {
        type: 'object',
        required: ['name', 'event_type', 'condition', 'suggestion_title_template', 'suggestion_body_template'],
        properties: {
          name: { type: 'string' },
          event_type: { type: 'string' },
          condition: { type: 'object' },
          suggestion_title_template: { type: 'string' },
          suggestion_body_template: { type: 'string' },
          suggested_action_id: { type: 'string' },
          priority: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_proactive_rules.create'],
    },
    async (input, ctx, sql) => {
      const parsed = createProactiveRuleSchema.parse(input);
      const rule = await svc.createRule(sql, ctx.tenantId, parsed);
      return {
        data: rule,
        event_type: 'ai.proactive.rule.created',
        object_id: rule.id,
        object_type: 'proactive_rule',
        after: rule,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.rule.get',
      display_name: 'Get Proactive Rule',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_proactive_rules',
      input_schema: {
        type: 'object',
        required: ['rule_id'],
        properties: { rule_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_proactive_rules.read'],
    },
    async (input, ctx, sql) => {
      const parsed = getProactiveRuleSchema.parse(input);
      const rule = await svc.getRule(sql, ctx.tenantId, parsed.rule_id);
      return { data: rule };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.rule.list',
      display_name: 'List Proactive Rules',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_proactive_rules',
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
      required_permissions: ['ai_proactive_rules.read'],
    },
    async (input, ctx, sql) => {
      const parsed = listProactiveRulesSchema.parse(input);
      const result = await svc.listRules(sql, ctx.tenantId, parsed.limit, parsed.offset);
      return { data: result };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.rule.update',
      display_name: 'Update Proactive Rule',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_proactive_rules',
      input_schema: {
        type: 'object',
        required: ['rule_id'],
        properties: {
          rule_id: { type: 'string' },
          name: { type: 'string' },
          event_type: { type: 'string' },
          condition: { type: 'object' },
          suggestion_title_template: { type: 'string' },
          suggestion_body_template: { type: 'string' },
          suggested_action_id: { type: 'string' },
          priority: { type: 'string' },
          status: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_proactive_rules.update'],
    },
    async (input, ctx, sql) => {
      const parsed = updateProactiveRuleSchema.parse(input);
      const { rule_id, ...updates } = parsed;
      const rule = await svc.updateRule(sql, ctx.tenantId, rule_id, updates);
      return {
        data: rule,
        event_type: 'ai.proactive.rule.updated',
        object_id: rule.id,
        object_type: 'proactive_rule',
        after: rule,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.rule.delete',
      display_name: 'Delete Proactive Rule',
      module_id: 'mod_ai',
      verb: 'delete',
      resource: 'ai_proactive_rules',
      input_schema: {
        type: 'object',
        required: ['rule_id'],
        properties: { rule_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'high',
      required_permissions: ['ai_proactive_rules.delete'],
    },
    async (input, ctx, sql) => {
      const parsed = deleteProactiveRuleSchema.parse(input);
      await svc.deleteRule(sql, ctx.tenantId, parsed.rule_id);
      return {
        data: { deleted: true },
        event_type: 'ai.proactive.rule.deleted',
      };
    },
  );

  // ═══════════════════════════════════════════
  // EVENT EVALUATION — generates suggestions ONLY
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.evaluate',
      display_name: 'Evaluate Event for Suggestions',
      module_id: 'mod_ai',
      verb: 'create',
      resource: 'ai_proactive_suggestions',
      input_schema: {
        type: 'object',
        required: ['event_type', 'event_id', 'actor_id'],
        properties: {
          event_type: { type: 'string' },
          event_id: { type: 'string' },
          actor_id: { type: 'string' },
          payload: { type: 'object' },
          metadata: { type: 'object' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_proactive_suggestions.create'],
    },
    async (input, ctx, sql) => {
      const parsed = evaluateEventSchema.parse(input);
      const suggestions = await svc.evaluateEvent(
        sql, ctx.tenantId, ctx.userId,
        parsed.event_type, parsed.event_id,
        parsed.payload, parsed.metadata,
      );
      return {
        data: { suggestions, count: suggestions.length },
        event_type: 'ai.proactive.evaluated',
      };
    },
  );

  // ═══════════════════════════════════════════
  // SUGGESTION MANAGEMENT
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.suggestion.list',
      display_name: 'List Proactive Suggestions',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_proactive_suggestions',
      input_schema: {
        type: 'object',
        required: [],
        properties: {
          status: { type: 'string' },
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_proactive_suggestions.read'],
    },
    async (input, ctx, sql) => {
      const parsed = listSuggestionsSchema.parse(input);
      const result = await svc.listSuggestions(
        sql, ctx.tenantId, parsed.status, parsed.limit, parsed.offset,
      );
      return { data: result };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.suggestion.get',
      display_name: 'Get Proactive Suggestion',
      module_id: 'mod_ai',
      verb: 'read',
      resource: 'ai_proactive_suggestions',
      input_schema: {
        type: 'object',
        required: ['suggestion_id'],
        properties: { suggestion_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_proactive_suggestions.read'],
    },
    async (input, ctx, sql) => {
      const parsed = getSuggestionSchema.parse(input);
      const suggestion = await svc.getSuggestion(sql, ctx.tenantId, parsed.suggestion_id);
      return { data: suggestion };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.suggestion.dismiss',
      display_name: 'Dismiss Proactive Suggestion',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_proactive_suggestions',
      input_schema: {
        type: 'object',
        required: ['suggestion_id'],
        properties: { suggestion_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_proactive_suggestions.update'],
    },
    async (input, ctx, sql) => {
      const parsed = dismissSuggestionSchema.parse(input);
      const suggestion = await svc.dismissSuggestion(sql, ctx.tenantId, parsed.suggestion_id);
      return {
        data: suggestion,
        event_type: 'ai.proactive.suggestion.dismissed',
        object_id: suggestion.id,
        object_type: 'proactive_suggestion',
        after: suggestion,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.ai.proactive.suggestion.accept',
      display_name: 'Accept Proactive Suggestion',
      module_id: 'mod_ai',
      verb: 'update',
      resource: 'ai_proactive_suggestions',
      input_schema: {
        type: 'object',
        required: ['suggestion_id'],
        properties: { suggestion_id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      sensitivity: 'standard',
      required_permissions: ['ai_proactive_suggestions.update'],
    },
    async (input, ctx, sql) => {
      const parsed = acceptSuggestionSchema.parse(input);
      const suggestion = await svc.acceptSuggestion(sql, ctx.tenantId, parsed.suggestion_id);
      return {
        data: suggestion,
        event_type: 'ai.proactive.suggestion.accepted',
        object_id: suggestion.id,
        object_type: 'proactive_suggestion',
        after: suggestion,
      };
    },
  );
}

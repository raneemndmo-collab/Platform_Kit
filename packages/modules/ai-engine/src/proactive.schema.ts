/**
 * M21 AI Engine — Proactive Engine Schemas (Step 7)
 *
 * Zod validation for all proactive rule and suggestion inputs.
 * Enforces size limits to prevent unbounded growth.
 */
import { z } from 'zod';

/** Max serialized JSON size for condition (8 KB) */
export const MAX_CONDITION_BYTES = 8 * 1024;

/** Max suggestions per tenant (prevents unbounded growth) */
export const MAX_SUGGESTIONS_PER_TENANT = 10_000;

const boundedJsonRecord = z
  .record(z.unknown())
  .refine(
    (v) => JSON.stringify(v).length <= MAX_CONDITION_BYTES,
    { message: `Condition JSON must not exceed ${MAX_CONDITION_BYTES} bytes` },
  );

// ── Rule schemas ──

export const createProactiveRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().default(''),
  event_type: z.string().min(1).max(255),
  condition: boundedJsonRecord,
  suggestion_title_template: z.string().min(1).max(500),
  suggestion_body_template: z.string().min(1).max(4000),
  suggested_action_id: z.string().max(255).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

export const updateProactiveRuleSchema = z.object({
  rule_id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  event_type: z.string().min(1).max(255).optional(),
  condition: boundedJsonRecord.optional(),
  suggestion_title_template: z.string().min(1).max(500).optional(),
  suggestion_body_template: z.string().min(1).max(4000).optional(),
  suggested_action_id: z.string().max(255).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export const getProactiveRuleSchema = z.object({
  rule_id: z.string().uuid(),
});

export const listProactiveRulesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const deleteProactiveRuleSchema = z.object({
  rule_id: z.string().uuid(),
});

// ── Suggestion schemas ──

export const listSuggestionsSchema = z.object({
  status: z.enum(['pending', 'accepted', 'dismissed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const getSuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
});

export const dismissSuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
});

export const acceptSuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
});

// ── Evaluate schema (explicit opt-in call) ──

export const evaluateEventSchema = z.object({
  event_type: z.string().min(1).max(255),
  event_id: z.string().min(1).max(255),
  actor_id: z.string().min(1).max(255),
  payload: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
});

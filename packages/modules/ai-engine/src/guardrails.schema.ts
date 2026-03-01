/**
 * M21 AI Engine — Guardrails Zod Schemas (Step 6)
 *
 * Validation schemas for Guardrails inputs.
 * No hidden filtering. All rules are explicit and transparent.
 */
import { z } from 'zod';

const MAX_CONDITION_BYTES = 8_192; // 8 KB
const MAX_MESSAGE_LENGTH = 1_000;

function jsonSizeLimit(maxBytes: number, fieldName: string) {
  return z.record(z.unknown()).refine(
    (val) => {
      try { return JSON.stringify(val).length <= maxBytes; }
      catch { return false; }
    },
    { message: `${fieldName} exceeds maximum size of ${maxBytes} bytes` },
  );
}

export const guardrailRuleKindEnum = z.enum([
  'input_validation',
  'sensitivity_flag',
  'require_confirmation',
  'block',
]);

export const guardrailRuleStatusEnum = z.enum(['active', 'disabled']);

export const createGuardrailRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1_000).optional().default(''),
  kind: guardrailRuleKindEnum,
  action_pattern: z.string().min(1).max(255),
  condition: jsonSizeLimit(MAX_CONDITION_BYTES, 'condition'),
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

export const updateGuardrailRuleSchema = z.object({
  rule_id: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1_000).optional(),
  kind: guardrailRuleKindEnum.optional(),
  action_pattern: z.string().min(1).max(255).optional(),
  condition: jsonSizeLimit(MAX_CONDITION_BYTES, 'condition').optional(),
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH).optional(),
  status: guardrailRuleStatusEnum.optional(),
});

export const deleteGuardrailRuleSchema = z.object({
  rule_id: z.string().min(1),
});

export const getGuardrailRuleSchema = z.object({
  rule_id: z.string().min(1),
});

export const evaluateGuardrailsSchema = z.object({
  action_id: z.string().min(1),
  input: z.record(z.unknown()),
  confirmation_token: z.string().optional(),
});

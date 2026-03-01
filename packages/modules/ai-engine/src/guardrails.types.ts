/**
 * M21 AI Engine — Guardrails Types (Step 6)
 *
 * Guardrails wrap around execution — they do NOT replace K4 policy.
 * No silent prompt rewriting. No automatic tool override.
 * No hidden filtering. No content moderation APIs.
 * No external safety service. All enforcement is transparent and logged.
 */

/** The kind of check a guardrail rule performs */
export type GuardrailRuleKind =
  | 'input_validation'       // Validate input structure/content
  | 'sensitivity_flag'       // Flag action as sensitive, log warning
  | 'require_confirmation'   // Block until explicit confirmation token
  | 'block';                 // Explicitly block execution with clear error

/** Status of a guardrail rule */
export type GuardrailRuleStatus = 'active' | 'disabled';

/** Verdict from a guardrail evaluation */
export type GuardrailVerdict = 'pass' | 'flag' | 'require_confirmation' | 'block';

/** A guardrail rule stored in the database */
export interface GuardrailRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  kind: GuardrailRuleKind;
  /** Which action_id pattern this rule applies to (exact match or glob) */
  action_pattern: string;
  /** JSON condition — evaluated transparently, no hidden logic */
  condition: Record<string, unknown>;
  /** The message shown when the rule triggers */
  message: string;
  status: GuardrailRuleStatus;
  created_at: string;
  updated_at: string;
}

/** A guardrail evaluation record — full transparency log */
export interface GuardrailEvaluation {
  id: string;
  tenant_id: string;
  user_id: string;
  action_id: string;
  rule_id: string;
  rule_name: string;
  rule_kind: GuardrailRuleKind;
  verdict: GuardrailVerdict;
  message: string;
  input_snapshot: Record<string, unknown>;
  created_at: string;
}

/** Input for creating a guardrail rule */
export interface CreateGuardrailRuleInput {
  name: string;
  description?: string;
  kind: GuardrailRuleKind;
  action_pattern: string;
  condition: Record<string, unknown>;
  message: string;
}

/** Input for updating a guardrail rule */
export interface UpdateGuardrailRuleInput {
  name?: string;
  description?: string;
  kind?: GuardrailRuleKind;
  action_pattern?: string;
  condition?: Record<string, unknown>;
  message?: string;
  status?: GuardrailRuleStatus;
}

/** Result of evaluating all guardrails for an action */
export interface GuardrailEvaluationResult {
  verdict: GuardrailVerdict;
  evaluations: GuardrailEvaluation[];
  blocked_by?: string;       // rule_id that blocked
  blocked_message?: string;  // clear error message
}

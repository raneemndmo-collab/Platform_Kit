/**
 * M21 AI Engine — Proactive Engine Types (Step 7)
 *
 * Event-driven suggestion engine ONLY.
 * NO automatic execution. NO background listeners. NO polling.
 * NO scheduler. NO cron. NO setInterval/setTimeout. NO job queue.
 * NO async loop. NO auto-triggered action.
 * Subscribes to Event Bus only. Generates suggestion records only.
 * Never executes tools automatically.
 * Never calls executeAction without user confirmation.
 */

/** Status of a proactive suggestion */
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';

/** Priority of a suggestion */
export type SuggestionPriority = 'low' | 'medium' | 'high';

/** A proactive suggestion rule — defines what events trigger what suggestions */
export interface ProactiveRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  /** Exact event_type to subscribe to */
  event_type: string;
  /** Condition to evaluate against event metadata (transparent JSON) */
  condition: Record<string, unknown>;
  /** Template for the suggestion title */
  suggestion_title_template: string;
  /** Template for the suggestion body */
  suggestion_body_template: string;
  /** Optional action_id that the user can choose to execute */
  suggested_action_id: string | null;
  priority: SuggestionPriority;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

/** A proactive suggestion record — stored in mod_ai.proactive_suggestions */
export interface ProactiveSuggestion {
  id: string;
  tenant_id: string;
  user_id: string;
  rule_id: string;
  event_id: string;
  title: string;
  body: string;
  suggested_action_id: string | null;
  suggested_action_input: Record<string, unknown> | null;
  priority: SuggestionPriority;
  status: SuggestionStatus;
  dismissed_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

/** Input for creating a proactive rule */
export interface CreateProactiveRuleInput {
  name: string;
  description?: string;
  event_type: string;
  condition: Record<string, unknown>;
  suggestion_title_template: string;
  suggestion_body_template: string;
  suggested_action_id?: string;
  priority?: SuggestionPriority;
}

/** Input for updating a proactive rule */
export interface UpdateProactiveRuleInput {
  name?: string;
  description?: string;
  event_type?: string;
  condition?: Record<string, unknown>;
  suggestion_title_template?: string;
  suggestion_body_template?: string;
  suggested_action_id?: string | null;
  priority?: SuggestionPriority;
  status?: 'active' | 'disabled';
}

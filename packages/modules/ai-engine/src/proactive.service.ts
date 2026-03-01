/**
 * M21 AI Engine — Proactive Engine Service (Step 7)
 *
 * Event-driven suggestion engine ONLY.
 * NO automatic execution. NO background listeners. NO polling.
 * NO scheduler. NO cron. NO setInterval/setTimeout. NO job queue.
 * NO async loop. NO auto-triggered action.
 *
 * This service:
 * - Manages proactive rules (CRUD)
 * - Evaluates events against rules to generate suggestions
 * - Manages suggestion lifecycle (pending → accepted / dismissed)
 * - NEVER executes any action automatically
 * - NEVER calls executeAction
 * - All DB access via tenant-scoped sql (RLS-enforced)
 */
import type postgres from 'postgres';
import { v7 as uuidv7 } from 'uuid';
import { NotFoundError, ValidationError } from '@rasid/shared';
import type {
  ProactiveRule,
  ProactiveSuggestion,
  CreateProactiveRuleInput,
  UpdateProactiveRuleInput,
} from './proactive.types.js';
import { MAX_SUGGESTIONS_PER_TENANT } from './proactive.schema.js';

class ProactiveService {

  // ═══════════════════════════════════════════
  // RULE MANAGEMENT (CRUD)
  // ═══════════════════════════════════════════

  async createRule(
    sql: postgres.Sql,
    tenantId: string,
    input: CreateProactiveRuleInput,
  ): Promise<ProactiveRule> {
    const id = uuidv7();
    const rows = await sql`
      INSERT INTO mod_ai.proactive_rules
        (id, tenant_id, name, description, event_type, condition,
         suggestion_title_template, suggestion_body_template,
         suggested_action_id, priority)
      VALUES (
        ${id}, ${tenantId}, ${input.name}, ${input.description ?? ''},
        ${input.event_type}, ${JSON.stringify(input.condition)}::jsonb,
        ${input.suggestion_title_template}, ${input.suggestion_body_template},
        ${input.suggested_action_id ?? null}, ${input.priority ?? 'medium'}
      )
      RETURNING *
    `;
    return this.mapRule(rows[0]);
  }

  async getRule(
    sql: postgres.Sql,
    tenantId: string,
    ruleId: string,
  ): Promise<ProactiveRule> {
    const rows = await sql`
      SELECT * FROM mod_ai.proactive_rules
      WHERE id = ${ruleId} AND tenant_id = ${tenantId}
    `;
    if (rows.length === 0) throw new NotFoundError('Proactive rule not found');
    return this.mapRule(rows[0]);
  }

  async listRules(
    sql: postgres.Sql,
    tenantId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: ProactiveRule[]; total: number }> {
    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM mod_ai.proactive_rules
      WHERE tenant_id = ${tenantId}
    `;
    const rows = await sql`
      SELECT * FROM mod_ai.proactive_rules
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return { items: rows.map((r: any) => this.mapRule(r)), total: countRows[0].total };
  }

  async updateRule(
    sql: postgres.Sql,
    tenantId: string,
    ruleId: string,
    input: UpdateProactiveRuleInput,
  ): Promise<ProactiveRule> {
    await this.getRule(sql, tenantId, ruleId);
    const rows = await sql`
      UPDATE mod_ai.proactive_rules SET
        name = COALESCE(${input.name ?? null}, name),
        description = COALESCE(${input.description ?? null}, description),
        event_type = COALESCE(${input.event_type ?? null}, event_type),
        condition = COALESCE(${input.condition ? JSON.stringify(input.condition) : null}::jsonb, condition),
        suggestion_title_template = COALESCE(${input.suggestion_title_template ?? null}, suggestion_title_template),
        suggestion_body_template = COALESCE(${input.suggestion_body_template ?? null}, suggestion_body_template),
        suggested_action_id = COALESCE(${input.suggested_action_id !== undefined ? (input.suggested_action_id ?? null) : null}, suggested_action_id),
        priority = COALESCE(${input.priority ?? null}, priority),
        status = COALESCE(${input.status ?? null}, status),
        updated_at = now()
      WHERE id = ${ruleId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapRule(rows[0]);
  }

  async deleteRule(
    sql: postgres.Sql,
    tenantId: string,
    ruleId: string,
  ): Promise<void> {
    await this.getRule(sql, tenantId, ruleId);
    await sql`
      DELETE FROM mod_ai.proactive_rules
      WHERE id = ${ruleId} AND tenant_id = ${tenantId}
    `;
  }

  // ═══════════════════════════════════════════
  // EVENT EVALUATION — generates suggestions ONLY
  // NO automatic execution. NO executeAction calls.
  // ═══════════════════════════════════════════

  /**
   * Evaluate an event against all active rules for the tenant.
   * This is called EXPLICITLY (not automatically) — either via:
   * 1. A K3 action (rasid.mod.ai.proactive.evaluate)
   * 2. An event bus subscriber registered at startup (which only calls this method)
   *
   * This method ONLY creates suggestion records. It NEVER executes any action.
   */
  async evaluateEvent(
    sql: postgres.Sql,
    tenantId: string,
    userId: string,
    eventType: string,
    eventId: string,
    payload: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ): Promise<ProactiveSuggestion[]> {
    // Check tenant suggestion limit
    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM mod_ai.proactive_suggestions
      WHERE tenant_id = ${tenantId} AND status = 'pending'
    `;
    if (countRows[0].total >= MAX_SUGGESTIONS_PER_TENANT) {
      throw new ValidationError(
        `Tenant has reached the maximum of ${MAX_SUGGESTIONS_PER_TENANT} pending suggestions`,
      );
    }

    // Fetch active rules matching this event_type
    const rules = await sql`
      SELECT * FROM mod_ai.proactive_rules
      WHERE tenant_id = ${tenantId}
        AND status = 'active'
        AND event_type = ${eventType}
      ORDER BY priority DESC
    `;

    const suggestions: ProactiveSuggestion[] = [];

    for (const ruleRow of rules) {
      const rule = this.mapRule(ruleRow);

      // Evaluate condition against event payload + metadata
      if (!this.conditionMatches(rule.condition, payload, metadata)) {
        continue;
      }

      // Generate suggestion — NEVER execute anything
      const suggestionId = uuidv7();
      const title = this.renderTemplate(rule.suggestion_title_template, payload, metadata);
      const body = this.renderTemplate(rule.suggestion_body_template, payload, metadata);

      await sql`
        INSERT INTO mod_ai.proactive_suggestions
          (id, tenant_id, user_id, rule_id, event_id, title, body,
           suggested_action_id, suggested_action_input, priority, status)
        VALUES (
          ${suggestionId}, ${tenantId}, ${userId}, ${rule.id}, ${eventId},
          ${title}, ${body},
          ${rule.suggested_action_id}, ${payload ? JSON.stringify(payload) : null}::jsonb,
          ${rule.priority}, 'pending'
        )
      `;

      suggestions.push({
        id: suggestionId,
        tenant_id: tenantId,
        user_id: userId,
        rule_id: rule.id,
        event_id: eventId,
        title,
        body,
        suggested_action_id: rule.suggested_action_id,
        suggested_action_input: payload,
        priority: rule.priority,
        status: 'pending',
        dismissed_at: null,
        accepted_at: null,
        created_at: new Date().toISOString(),
      });
    }

    return suggestions;
  }

  // ═══════════════════════════════════════════
  // SUGGESTION MANAGEMENT
  // ═══════════════════════════════════════════

  async getSuggestion(
    sql: postgres.Sql,
    tenantId: string,
    suggestionId: string,
  ): Promise<ProactiveSuggestion> {
    const rows = await sql`
      SELECT * FROM mod_ai.proactive_suggestions
      WHERE id = ${suggestionId} AND tenant_id = ${tenantId}
    `;
    if (rows.length === 0) throw new NotFoundError('Suggestion not found');
    return this.mapSuggestion(rows[0]);
  }

  async listSuggestions(
    sql: postgres.Sql,
    tenantId: string,
    status?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: ProactiveSuggestion[]; total: number }> {
    const countRows = status
      ? await sql`SELECT COUNT(*)::int AS total FROM mod_ai.proactive_suggestions WHERE tenant_id = ${tenantId} AND status = ${status}`
      : await sql`SELECT COUNT(*)::int AS total FROM mod_ai.proactive_suggestions WHERE tenant_id = ${tenantId}`;
    const rows = status
      ? await sql`SELECT * FROM mod_ai.proactive_suggestions WHERE tenant_id = ${tenantId} AND status = ${status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      : await sql`SELECT * FROM mod_ai.proactive_suggestions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    return { items: rows.map((r: any) => this.mapSuggestion(r)), total: countRows[0].total };
  }

  /**
   * Dismiss a suggestion — user explicitly chose not to act on it.
   * This does NOT execute anything. It only updates the status.
   */
  async dismissSuggestion(
    sql: postgres.Sql,
    tenantId: string,
    suggestionId: string,
  ): Promise<ProactiveSuggestion> {
    const suggestion = await this.getSuggestion(sql, tenantId, suggestionId);
    if (suggestion.status !== 'pending') {
      throw new ValidationError(`Suggestion is already ${suggestion.status}`);
    }
    const rows = await sql`
      UPDATE mod_ai.proactive_suggestions SET
        status = 'dismissed',
        dismissed_at = now()
      WHERE id = ${suggestionId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapSuggestion(rows[0]);
  }

  /**
   * Accept a suggestion — marks it as accepted.
   * This does NOT execute the suggested action. The user must
   * separately call the suggested action via K3 executeAction.
   * This method ONLY updates the status to 'accepted'.
   */
  async acceptSuggestion(
    sql: postgres.Sql,
    tenantId: string,
    suggestionId: string,
  ): Promise<ProactiveSuggestion> {
    const suggestion = await this.getSuggestion(sql, tenantId, suggestionId);
    if (suggestion.status !== 'pending') {
      throw new ValidationError(`Suggestion is already ${suggestion.status}`);
    }
    const rows = await sql`
      UPDATE mod_ai.proactive_suggestions SET
        status = 'accepted',
        accepted_at = now()
      WHERE id = ${suggestionId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapSuggestion(rows[0]);
  }

  // ═══════════════════════════════════════════
  // PRIVATE HELPERS — transparent logic
  // ═══════════════════════════════════════════

  /**
   * Check if a condition matches the event payload + metadata.
   * Transparent logic — no hidden filtering.
   *
   * Condition format:
   *   { "match_any": true } — always matches
   *   { "payload_contains": ["keyword1", "keyword2"] } — any keyword in serialized payload
   *   { "payload_field_equals": { "field": "value" } } — exact field match
   *   { "metadata_field_equals": { "field": "value" } } — exact metadata field match
   */
  private conditionMatches(
    condition: Record<string, unknown>,
    payload: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ): boolean {
    // match_any: always triggers
    if (condition.match_any === true) return true;

    // payload_contains: check if any keyword exists in serialized payload
    if (Array.isArray(condition.payload_contains)) {
      const payloadStr = JSON.stringify(payload);
      const found = (condition.payload_contains as string[]).some((kw) =>
        payloadStr.includes(kw),
      );
      if (found) return true;
    }

    // payload_field_equals: exact field match
    if (condition.payload_field_equals && typeof condition.payload_field_equals === 'object') {
      const fields = condition.payload_field_equals as Record<string, unknown>;
      const allMatch = Object.entries(fields).every(
        ([key, value]) => payload[key] === value,
      );
      if (allMatch && Object.keys(fields).length > 0) return true;
    }

    // metadata_field_equals: exact metadata field match
    if (condition.metadata_field_equals && typeof condition.metadata_field_equals === 'object') {
      const fields = condition.metadata_field_equals as Record<string, unknown>;
      const allMatch = Object.entries(fields).every(
        ([key, value]) => metadata[key] === value,
      );
      if (allMatch && Object.keys(fields).length > 0) return true;
    }

    return false;
  }

  /**
   * Simple template rendering — replaces {{key}} with payload/metadata values.
   * No code execution. No eval. Pure string replacement.
   */
  private renderTemplate(
    template: string,
    payload: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (key in payload) return String(payload[key]);
      if (key in metadata) return String(metadata[key]);
      return `{{${key}}}`;
    });
  }

  // ── Row mappers ──

  private mapRule(row: any): ProactiveRule {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      event_type: row.event_type,
      condition: typeof row.condition === 'string' ? JSON.parse(row.condition) : row.condition,
      suggestion_title_template: row.suggestion_title_template,
      suggestion_body_template: row.suggestion_body_template,
      suggested_action_id: row.suggested_action_id,
      priority: row.priority,
      status: row.status,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
    };
  }

  private mapSuggestion(row: any): ProactiveSuggestion {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      rule_id: row.rule_id,
      event_id: row.event_id,
      title: row.title,
      body: row.body,
      suggested_action_id: row.suggested_action_id,
      suggested_action_input: typeof row.suggested_action_input === 'string'
        ? JSON.parse(row.suggested_action_input)
        : row.suggested_action_input,
      priority: row.priority,
      status: row.status,
      dismissed_at: row.dismissed_at?.toISOString?.() ?? row.dismissed_at,
      accepted_at: row.accepted_at?.toISOString?.() ?? row.accepted_at,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
    };
  }
}

export const proactiveService = new ProactiveService();

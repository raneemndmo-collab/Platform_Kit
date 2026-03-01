/**
 * M21 AI Engine — Guardrails Service (Step 6)
 *
 * Guardrails wrap around execution — they do NOT replace K4 policy.
 * No silent prompt rewriting. No automatic tool override.
 * No hidden filtering logic. No content moderation APIs.
 * No external safety service. No hidden state mutation.
 * All enforcement is transparent and logged via K3 + audit.
 * All DB access via tenant-scoped sql (RLS-enforced).
 */
import type postgres from 'postgres';
import { v7 as uuidv7 } from 'uuid';
import { NotFoundError, ValidationError } from '@rasid/shared';
import type {
  GuardrailRule,
  GuardrailEvaluation,
  GuardrailEvaluationResult,
  GuardrailVerdict,
  CreateGuardrailRuleInput,
  UpdateGuardrailRuleInput,
} from './guardrails.types.js';

class GuardrailsService {

  // ═══════════════════════════════════════════
  // RULE MANAGEMENT (CRUD)
  // ═══════════════════════════════════════════

  async createRule(
    sql: postgres.Sql,
    tenantId: string,
    input: CreateGuardrailRuleInput,
  ): Promise<GuardrailRule> {
    const id = uuidv7();
    const rows = await sql`
      INSERT INTO mod_ai.guardrail_rules
        (id, tenant_id, name, description, kind, action_pattern, condition, message)
      VALUES (
        ${id}, ${tenantId}, ${input.name}, ${input.description ?? ''},
        ${input.kind}, ${input.action_pattern},
        ${JSON.stringify(input.condition)}::jsonb, ${input.message}
      )
      RETURNING *
    `;
    return this.mapRule(rows[0]);
  }

  async getRule(
    sql: postgres.Sql,
    tenantId: string,
    ruleId: string,
  ): Promise<GuardrailRule> {
    const rows = await sql`
      SELECT * FROM mod_ai.guardrail_rules
      WHERE id = ${ruleId} AND tenant_id = ${tenantId}
    `;
    if (rows.length === 0) throw new NotFoundError('Guardrail rule not found');
    return this.mapRule(rows[0]);
  }

  async listRules(
    sql: postgres.Sql,
    tenantId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: GuardrailRule[]; total: number }> {
    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM mod_ai.guardrail_rules
      WHERE tenant_id = ${tenantId}
    `;
    const rows = await sql`
      SELECT * FROM mod_ai.guardrail_rules
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
    input: UpdateGuardrailRuleInput,
  ): Promise<GuardrailRule> {
    await this.getRule(sql, tenantId, ruleId);

    // Build dynamic update
    const sets: string[] = [];
    if (input.name !== undefined) sets.push('name');
    if (input.description !== undefined) sets.push('description');
    if (input.kind !== undefined) sets.push('kind');
    if (input.action_pattern !== undefined) sets.push('action_pattern');
    if (input.condition !== undefined) sets.push('condition');
    if (input.message !== undefined) sets.push('message');
    if (input.status !== undefined) sets.push('status');

    if (sets.length === 0) return this.getRule(sql, tenantId, ruleId);

    // Use explicit field updates to avoid SQL injection
    const rows = await sql`
      UPDATE mod_ai.guardrail_rules SET
        name = COALESCE(${input.name ?? null}, name),
        description = COALESCE(${input.description ?? null}, description),
        kind = COALESCE(${input.kind ?? null}, kind),
        action_pattern = COALESCE(${input.action_pattern ?? null}, action_pattern),
        condition = COALESCE(${input.condition ? JSON.stringify(input.condition) : null}::jsonb, condition),
        message = COALESCE(${input.message ?? null}, message),
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
      DELETE FROM mod_ai.guardrail_rules
      WHERE id = ${ruleId} AND tenant_id = ${tenantId}
    `;
  }

  // ═══════════════════════════════════════════
  // EVALUATION — transparent, logged, no hidden logic
  // ═══════════════════════════════════════════

  /**
   * Evaluate all active guardrail rules that match the given action_id.
   * Returns a verdict and logs every evaluation to guardrail_evaluations.
   *
   * IMPORTANT: This does NOT modify input, does NOT rewrite prompts,
   * does NOT silently filter anything. It only:
   * - Validates inputs against rule conditions
   * - Flags sensitivity
   * - Requires explicit confirmation
   * - Blocks execution explicitly with clear error
   */
  async evaluate(
    sql: postgres.Sql,
    tenantId: string,
    userId: string,
    actionId: string,
    input: Record<string, unknown>,
    confirmationToken?: string,
  ): Promise<GuardrailEvaluationResult> {
    // Fetch all active rules matching this action
    const rules = await sql`
      SELECT * FROM mod_ai.guardrail_rules
      WHERE tenant_id = ${tenantId}
        AND status = 'active'
        AND (
          action_pattern = ${actionId}
          OR ${actionId} LIKE REPLACE(REPLACE(action_pattern, '*', '%'), '?', '_')
        )
      ORDER BY kind ASC
    `;

    const evaluations: GuardrailEvaluation[] = [];
    let finalVerdict: GuardrailVerdict = 'pass';
    let blockedBy: string | undefined;
    let blockedMessage: string | undefined;

    for (const ruleRow of rules) {
      const rule = this.mapRule(ruleRow);
      const { verdict, message } = this.evaluateRule(rule, input, confirmationToken);

      const evalId = uuidv7();
      // Truncate input snapshot to prevent unbounded storage
      const inputSnapshot = this.truncateSnapshot(input);

      await sql`
        INSERT INTO mod_ai.guardrail_evaluations
          (id, tenant_id, user_id, action_id, rule_id, rule_name, rule_kind, verdict, message, input_snapshot)
        VALUES (
          ${evalId}, ${tenantId}, ${userId}, ${actionId},
          ${rule.id}, ${rule.name}, ${rule.kind}, ${verdict},
          ${message}, ${JSON.stringify(inputSnapshot)}::jsonb
        )
      `;

      const evaluation: GuardrailEvaluation = {
        id: evalId,
        tenant_id: tenantId,
        user_id: userId,
        action_id: actionId,
        rule_id: rule.id,
        rule_name: rule.name,
        rule_kind: rule.kind,
        verdict,
        message,
        input_snapshot: inputSnapshot,
        created_at: new Date().toISOString(),
      };
      evaluations.push(evaluation);

      // Escalate verdict: block > require_confirmation > flag > pass
      if (verdict === 'block') {
        finalVerdict = 'block';
        blockedBy = rule.id;
        blockedMessage = message;
        break; // Stop on first block
      }
      if (verdict === 'require_confirmation' && finalVerdict !== 'block') {
        finalVerdict = 'require_confirmation';
        blockedBy = rule.id;
        blockedMessage = message;
      }
      if (verdict === 'flag' && finalVerdict === 'pass') {
        finalVerdict = 'flag';
      }
    }

    return {
      verdict: finalVerdict,
      evaluations,
      blocked_by: blockedBy,
      blocked_message: blockedMessage,
    };
  }

  /**
   * Evaluate a single rule against input.
   * All logic is transparent — condition is a simple JSON structure:
   *
   * For input_validation:
   *   { "required_fields": ["field1", "field2"] }
   *   { "max_length": { "field": "content", "limit": 1000 } }
   *   { "forbidden_patterns": ["pattern1", "pattern2"] }
   *
   * For sensitivity_flag / require_confirmation / block:
   *   { "match_any": true } — always triggers for matching action
   *   { "input_contains": ["keyword1", "keyword2"] }
   */
  private evaluateRule(
    rule: GuardrailRule,
    input: Record<string, unknown>,
    confirmationToken?: string,
  ): { verdict: GuardrailVerdict; message: string } {
    const condition = rule.condition;

    // ── input_validation rules ──
    if (rule.kind === 'input_validation') {
      // Check required_fields
      if (Array.isArray(condition.required_fields)) {
        for (const field of condition.required_fields as string[]) {
          if (input[field] === undefined || input[field] === null || input[field] === '') {
            return { verdict: 'block', message: `${rule.message} (missing: ${field})` };
          }
        }
      }
      // Check max_length
      if (condition.max_length && typeof condition.max_length === 'object') {
        const ml = condition.max_length as { field: string; limit: number };
        const val = input[ml.field];
        if (typeof val === 'string' && val.length > ml.limit) {
          return { verdict: 'block', message: `${rule.message} (${ml.field} exceeds ${ml.limit} chars)` };
        }
      }
      // Check forbidden_patterns
      if (Array.isArray(condition.forbidden_patterns)) {
        const inputStr = JSON.stringify(input);
        for (const pattern of condition.forbidden_patterns as string[]) {
          if (inputStr.includes(pattern)) {
            return { verdict: 'block', message: `${rule.message} (forbidden pattern detected)` };
          }
        }
      }
      return { verdict: 'pass', message: 'Input validation passed' };
    }

    // ── sensitivity_flag rules ──
    if (rule.kind === 'sensitivity_flag') {
      if (this.conditionMatches(condition, input)) {
        return { verdict: 'flag', message: rule.message };
      }
      return { verdict: 'pass', message: 'No sensitivity flag triggered' };
    }

    // ── require_confirmation rules ──
    if (rule.kind === 'require_confirmation') {
      if (this.conditionMatches(condition, input)) {
        // If a valid confirmation token is provided, pass
        if (confirmationToken && confirmationToken === `confirm:${rule.id}`) {
          return { verdict: 'pass', message: 'Confirmation accepted' };
        }
        return {
          verdict: 'require_confirmation',
          message: `${rule.message} (provide confirmation_token: "confirm:${rule.id}")`,
        };
      }
      return { verdict: 'pass', message: 'Confirmation not required' };
    }

    // ── block rules ──
    if (rule.kind === 'block') {
      if (this.conditionMatches(condition, input)) {
        return { verdict: 'block', message: rule.message };
      }
      return { verdict: 'pass', message: 'Block rule did not trigger' };
    }

    return { verdict: 'pass', message: 'Unknown rule kind — pass by default' };
  }

  /**
   * Check if a condition matches the input.
   * Transparent logic — no hidden filtering.
   */
  private conditionMatches(
    condition: Record<string, unknown>,
    input: Record<string, unknown>,
  ): boolean {
    // match_any: true — always matches
    if (condition.match_any === true) return true;

    // input_contains: check if any keyword appears in serialized input
    if (Array.isArray(condition.input_contains)) {
      const inputStr = JSON.stringify(input).toLowerCase();
      for (const keyword of condition.input_contains as string[]) {
        if (inputStr.includes(keyword.toLowerCase())) return true;
      }
    }

    return false;
  }

  /**
   * Truncate input snapshot to max 4 KB for storage.
   * Does NOT modify the actual input — only the logged snapshot.
   */
  private truncateSnapshot(input: Record<string, unknown>): Record<string, unknown> {
    const str = JSON.stringify(input);
    if (str.length <= 4_096) return input;
    return { _truncated: true, _size: str.length, _preview: str.slice(0, 2_000) };
  }

  // ═══════════════════════════════════════════
  // EVALUATION LOG QUERIES
  // ═══════════════════════════════════════════

  async listEvaluations(
    sql: postgres.Sql,
    tenantId: string,
    filters: { action_id?: string; rule_id?: string; verdict?: string },
    limit = 50,
    offset = 0,
  ): Promise<{ items: GuardrailEvaluation[]; total: number }> {
    const actionId = filters.action_id ?? null;
    const ruleId = filters.rule_id ?? null;
    const verdict = filters.verdict ?? null;

    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM mod_ai.guardrail_evaluations
      WHERE tenant_id = ${tenantId}
        AND (${actionId}::text IS NULL OR action_id = ${actionId})
        AND (${ruleId}::text IS NULL OR rule_id = ${ruleId})
        AND (${verdict}::text IS NULL OR verdict = ${verdict})
    `;
    const rows = await sql`
      SELECT * FROM mod_ai.guardrail_evaluations
      WHERE tenant_id = ${tenantId}
        AND (${actionId}::text IS NULL OR action_id = ${actionId})
        AND (${ruleId}::text IS NULL OR rule_id = ${ruleId})
        AND (${verdict}::text IS NULL OR verdict = ${verdict})
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return {
      items: rows.map((r: any) => this.mapEvaluation(r)),
      total: countRows[0].total,
    };
  }

  // ═══════════════════════════════════════════
  // MAPPERS
  // ═══════════════════════════════════════════

  private mapRule(row: any): GuardrailRule {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      kind: row.kind,
      action_pattern: row.action_pattern,
      condition: typeof row.condition === 'string' ? JSON.parse(row.condition) : row.condition,
      message: row.message,
      status: row.status,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapEvaluation(row: any): GuardrailEvaluation {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      action_id: row.action_id,
      rule_id: row.rule_id,
      rule_name: row.rule_name,
      rule_kind: row.rule_kind,
      verdict: row.verdict,
      message: row.message,
      input_snapshot: typeof row.input_snapshot === 'string' ? JSON.parse(row.input_snapshot) : row.input_snapshot,
      created_at: String(row.created_at),
    };
  }
}

export const guardrailsService = new GuardrailsService();

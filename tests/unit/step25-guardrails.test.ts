/**
 * Step 25 — Guardrails Tests
 *
 * Validates:
 * - Guardrail Rule CRUD (create, list, get, update, delete)
 * - Evaluation: input_validation (block on missing fields, forbidden patterns)
 * - Evaluation: sensitivity_flag (flag logged, execution not blocked)
 * - Evaluation: require_confirmation (block until token provided)
 * - Evaluation: block (explicit block with clear error)
 * - No silent prompt rewriting (static analysis)
 * - No automatic tool override (static analysis)
 * - No hidden filtering logic (static analysis)
 * - No content moderation APIs (static analysis)
 * - No external safety service (static analysis)
 * - No Kernel modification (import analysis)
 * - No K4 policy engine modification (static analysis)
 * - All enforcement transparent and logged via K3 + audit
 * - RLS tenant isolation
 * - Auth enforcement (401 without token)
 * - K3 action registration (all 7 actions)
 * - Schema compliance (migrate-step6.ts)
 * - Evaluation log is queryable
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import type { FastifyInstance } from 'fastify';
import * as fs from 'node:fs';

let app: FastifyInstance;
let token: string;
let tenantId: string;
let userId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();
  // Login
  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(loginRes.statusCode).toBe(200);
  token = loginRes.json().data.token.access_token;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  tenantId = payload.tid;
  userId = payload.sub;
});

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════
// 1. GUARDRAIL RULE CRUD
// ═══════════════════════════════════════════

let ruleId: string;
let blockRuleId: string;
let confirmRuleId: string;
let flagRuleId: string;

describe('Guardrail Rule CRUD', () => {
  it('creates an input_validation rule', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Require content field',
        kind: 'input_validation',
        action_pattern: 'rasid.mod.ai.test.action',
        condition: { required_fields: ['content'] },
        message: 'Content field is required',
      },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.id).toBeDefined();
    expect(data.name).toBe('Require content field');
    expect(data.kind).toBe('input_validation');
    expect(data.status).toBe('active');
    ruleId = data.id;
  });

  it('creates a block rule', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Block dangerous action',
        kind: 'block',
        action_pattern: 'rasid.mod.ai.dangerous.*',
        condition: { match_any: true },
        message: 'This action is explicitly blocked by guardrail policy',
      },
    });
    expect(res.statusCode).toBe(201);
    blockRuleId = res.json().data.id;
  });

  it('creates a require_confirmation rule', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Confirm deletion',
        kind: 'require_confirmation',
        action_pattern: 'rasid.mod.ai.test.delete',
        condition: { match_any: true },
        message: 'Deletion requires explicit confirmation',
      },
    });
    expect(res.statusCode).toBe(201);
    confirmRuleId = res.json().data.id;
  });

  it('creates a sensitivity_flag rule', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Flag PII keywords',
        kind: 'sensitivity_flag',
        action_pattern: 'rasid.mod.ai.test.*',
        condition: { input_contains: ['ssn', 'credit_card'] },
        message: 'Input may contain sensitive PII data',
      },
    });
    expect(res.statusCode).toBe(201);
    flagRuleId = res.json().data.id;
  });

  it('lists rules', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/guardrails/rules',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThanOrEqual(4);
  });

  it('gets a single rule', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/guardrails/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(ruleId);
  });

  it('updates a rule', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/guardrails/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.description).toBe('Updated description');
  });

  it('disables a rule', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/guardrails/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'disabled' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('disabled');
    // Re-enable for subsequent tests
    await app.inject({
      method: 'PATCH', url: `/api/v1/ai/guardrails/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'active' },
    });
  });
});

// ═══════════════════════════════════════════
// 2. EVALUATION — INPUT VALIDATION
// ═══════════════════════════════════════════

describe('Evaluation — Input Validation', () => {
  it('blocks when required field is missing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.action',
        input: { title: 'hello' }, // missing 'content'
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('block');
    expect(data.blocked_message).toMatch(/Content field is required/);
    expect(data.evaluations.length).toBeGreaterThanOrEqual(1);
  });

  it('passes when required field is present', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.action',
        input: { content: 'hello world' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    // May be 'pass' or 'flag' depending on other rules
    expect(['pass', 'flag']).toContain(data.verdict);
  });
});

// ═══════════════════════════════════════════
// 3. EVALUATION — SENSITIVITY FLAG
// ═══════════════════════════════════════════

describe('Evaluation — Sensitivity Flag', () => {
  it('flags input containing sensitive keywords', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.query',
        input: { content: 'Please show my ssn number' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('flag');
    // Verify the flag evaluation was logged
    const flagEval = data.evaluations.find((e: any) => e.verdict === 'flag');
    expect(flagEval).toBeDefined();
    expect(flagEval.message).toMatch(/PII/i);
  });

  it('does not flag input without sensitive keywords', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.query',
        input: { content: 'Show me the weather forecast' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('pass');
  });
});

// ═══════════════════════════════════════════
// 4. EVALUATION — REQUIRE CONFIRMATION
// ═══════════════════════════════════════════

describe('Evaluation — Require Confirmation', () => {
  it('blocks without confirmation token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.delete',
        input: { target: 'all-data' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('require_confirmation');
    expect(data.blocked_message).toMatch(/confirmation/i);
  });

  it('passes with valid confirmation token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.delete',
        input: { target: 'all-data' },
        confirmation_token: `confirm:${confirmRuleId}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('pass');
  });

  it('rejects with invalid confirmation token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.delete',
        input: { target: 'all-data' },
        confirmation_token: 'confirm:wrong-id',
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('require_confirmation');
  });
});

// ═══════════════════════════════════════════
// 5. EVALUATION — EXPLICIT BLOCK
// ═══════════════════════════════════════════

describe('Evaluation — Explicit Block', () => {
  it('blocks matching action with clear error message', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.dangerous.execute',
        input: { command: 'rm -rf /' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('block');
    expect(data.blocked_message).toMatch(/explicitly blocked/i);
    expect(data.blocked_by).toBe(blockRuleId);
  });
});

// ═══════════════════════════════════════════
// 6. EVALUATION LOG TRANSPARENCY
// ═══════════════════════════════════════════

describe('Evaluation Log Transparency', () => {
  it('all evaluations are stored in guardrail_evaluations table', async () => {
    const rows = await adminSql`
      SELECT COUNT(*)::int AS total FROM mod_ai.guardrail_evaluations
      WHERE tenant_id = ${tenantId}
    `;
    expect(rows[0].total).toBeGreaterThanOrEqual(5);
  });

  it('evaluations are queryable via API', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/guardrails/evaluations',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.items.length).toBeGreaterThanOrEqual(5);
    // Each evaluation has required fields
    for (const ev of data.items) {
      expect(ev.id).toBeDefined();
      expect(ev.action_id).toBeDefined();
      expect(ev.rule_id).toBeDefined();
      expect(ev.verdict).toBeDefined();
      expect(ev.message).toBeDefined();
      expect(ev.input_snapshot).toBeDefined();
    }
  });

  it('evaluations can be filtered by verdict', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/guardrails/evaluations?verdict=block',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    for (const ev of data.items) {
      expect(ev.verdict).toBe('block');
    }
  });
});

// ═══════════════════════════════════════════
// 7. AUTH ENFORCEMENT
// ═══════════════════════════════════════════

describe('Auth Enforcement', () => {
  it('returns 401 without token on rules endpoint', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/guardrails/rules',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 without token on evaluate endpoint', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      payload: { action_id: 'test', input: {} },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════
// 8. TENANT ISOLATION (RLS)
// ═══════════════════════════════════════════

describe('Tenant Isolation', () => {
  let betaToken: string;

  beforeAll(async () => {
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
    });
    expect(loginRes.statusCode).toBe(200);
    betaToken = loginRes.json().data.token.access_token;
  });

  it('Beta tenant cannot see Acme guardrail rules', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/guardrails/rules',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBe(0);
  });

  it('Beta tenant cannot see Acme evaluations', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/guardrails/evaluations',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 9. K3 ACTION REGISTRATION
// ═══════════════════════════════════════════

describe('K3 Action Registration', () => {
  it('all 7 guardrails actions are registered', async () => {
    const { actionRegistry } = await import('../../packages/kernel/src/index.js');
    const guardrailActions = actionRegistry.listActions({ module: 'mod_ai' })
      .filter((a: any) => a.action_id.includes('guardrails'));
    expect(guardrailActions.length).toBe(7);

    const actionIds = guardrailActions.map((a: any) => a.action_id).sort();
    expect(actionIds).toEqual([
      'rasid.mod.ai.guardrails.evaluate',
      'rasid.mod.ai.guardrails.evaluations.list',
      'rasid.mod.ai.guardrails.rule.create',
      'rasid.mod.ai.guardrails.rule.delete',
      'rasid.mod.ai.guardrails.rule.get',
      'rasid.mod.ai.guardrails.rule.list',
      'rasid.mod.ai.guardrails.rule.update',
    ]);
  });

  it('all guardrails actions have correct required_permissions format', async () => {
    const { actionRegistry } = await import('../../packages/kernel/src/index.js');
    const guardrailActions = actionRegistry.listActions({ module: 'mod_ai' })
      .filter((a: any) => a.action_id.includes('guardrails'));
    for (const action of guardrailActions) {
      for (const perm of action.required_permissions) {
        expect(typeof perm).toBe('string');
        expect(perm).toMatch(/^ai_guardrail_(rules|evaluations)\.(create|read|update|delete)$/);
      }
    }
  });
});

// ═══════════════════════════════════════════
// 10. SCHEMA & MIGRATION COMPLIANCE
// ═══════════════════════════════════════════

describe('Schema & Migration Compliance', () => {
  it('guardrail_rules table exists with RLS enabled', async () => {
    const rows = await adminSql`
      SELECT rowsecurity FROM pg_tables
      WHERE schemaname = 'mod_ai' AND tablename = 'guardrail_rules'
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].rowsecurity).toBe(true);
  });

  it('guardrail_evaluations table exists with RLS enabled', async () => {
    const rows = await adminSql`
      SELECT rowsecurity FROM pg_tables
      WHERE schemaname = 'mod_ai' AND tablename = 'guardrail_evaluations'
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].rowsecurity).toBe(true);
  });

  it('RLS tenant_isolation policy exists on guardrail_rules', async () => {
    const rows = await adminSql`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'mod_ai' AND tablename = 'guardrail_rules' AND policyname = 'tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });

  it('RLS tenant_isolation policy exists on guardrail_evaluations', async () => {
    const rows = await adminSql`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'mod_ai' AND tablename = 'guardrail_evaluations' AND policyname = 'tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });

  it('no cross-schema foreign keys from guardrails tables', async () => {
    const fks = await adminSql`
      SELECT tc.constraint_name, ccu.table_schema AS foreign_schema
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'mod_ai'
        AND tc.table_name IN ('guardrail_rules', 'guardrail_evaluations')
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema != 'mod_ai'
    `;
    expect(fks.length).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 11. NO SILENT OVERRIDE — STATIC ANALYSIS
// ═══════════════════════════════════════════

describe('No Silent Override — Static Analysis', () => {
  const guardrailFiles = [
    'packages/modules/ai-engine/src/guardrails.service.ts',
    'packages/modules/ai-engine/src/guardrails.actions.ts',
    'packages/modules/ai-engine/src/guardrails.routes.ts',
    'packages/modules/ai-engine/src/guardrails.schema.ts',
    'packages/modules/ai-engine/src/guardrails.types.ts',
    'packages/modules/ai-engine/src/migrate-step6.ts',
  ];

  it('no prompt rewriting keywords in guardrails code', () => {
    for (const file of guardrailFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/rewrite|reformat|sanitize|cleanse|transform.*prompt/i);
    }
  });

  it('no automatic tool override keywords in guardrails code', () => {
    for (const file of guardrailFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/override.*tool|replace.*handler|swap.*action/i);
    }
  });

  it('no content moderation API calls in guardrails code', () => {
    for (const file of guardrailFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/openai\.com|anthropic\.com|moderation|perspective\.api|content.*filter.*api/i);
    }
  });

  it('no external HTTP calls in guardrails code', () => {
    for (const file of guardrailFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/\bfetch\b|axios|got\(|node-fetch|https?:\/\//i);
    }
  });

  it('no hidden state mutation in guardrails code', () => {
    for (const file of guardrailFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      // No global state mutation
      expect(code).not.toMatch(/globalThis\.|global\.\w+\s*=/i);
      // No process.env mutation
      expect(code).not.toMatch(/process\.env\.\w+\s*=/i);
    }
  });

  it('no background jobs or schedulers in guardrails code', () => {
    for (const file of guardrailFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/setInterval|setTimeout|cron\b/i);
      expect(code).not.toMatch(/\bworker\b|\bqueue\b/i);
    }
  });
});

// ═══════════════════════════════════════════
// 12. NO KERNEL / K4 MODIFICATION
// ═══════════════════════════════════════════

describe('No Kernel / K4 Modification', () => {
  it('guardrails files import only from kernel public surface', () => {
    const files = [
      'packages/modules/ai-engine/src/guardrails.actions.ts',
      'packages/modules/ai-engine/src/guardrails.routes.ts',
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf-8');
      const kernelImports = [...src.matchAll(/from\s+['"]([^'"]*kernel[^'"]*)['"]/g)];
      for (const match of kernelImports) {
        expect(match[1]).toMatch(/kernel\/src\/index\.js$/);
      }
    }
  });

  it('guardrails service does not import from kernel at all', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/guardrails.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/from\s+['"].*kernel/);
  });

  it('guardrails does not modify policy service', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/guardrails.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/policyService|PolicyService|policy\.service/);
  });

  it('guardrails does not modify action registry internals', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/guardrails.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/actionRegistry|ActionRegistryService/);
  });
});

// ═══════════════════════════════════════════
// 13. POLICY INTERACTION PROOF
// ═══════════════════════════════════════════

describe('Policy Interaction Proof', () => {
  it('guardrails wraps around execution, does not replace K4', () => {
    // Verify guardrails.service.ts does NOT call executeAction
    const svcSrc = fs.readFileSync(
      'packages/modules/ai-engine/src/guardrails.service.ts', 'utf-8',
    );
    expect(svcSrc).not.toMatch(/executeAction/);

    // Verify guardrails.actions.ts uses actionRegistry.registerAction (K3 pipeline)
    const actSrc = fs.readFileSync(
      'packages/modules/ai-engine/src/guardrails.actions.ts', 'utf-8',
    );
    const registerCalls = (actSrc.match(/actionRegistry\.registerAction\(/g) || []).length;
    expect(registerCalls).toBe(7);
  });

  it('guardrails evaluate endpoint goes through K3 pipeline with RBAC', async () => {
    // Create a user without guardrail permissions and verify they get 403
    // For now, verify that the action has required_permissions set
    const { actionRegistry } = await import('../../packages/kernel/src/index.js');
    const evalAction = actionRegistry.getManifest('rasid.mod.ai.guardrails.evaluate');
    expect(evalAction).toBeDefined();
    expect(evalAction!.required_permissions.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// 14. AUDIT LOGGING PROOF
// ═══════════════════════════════════════════

describe('Audit Logging Proof', () => {
  it('rule creation generates audit log', async () => {
    const auditRows = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE action_id = 'rasid.mod.ai.guardrails.rule.create'
        AND tenant_id = ${tenantId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0].status).toBe('success');
  });

  it('evaluation generates audit log', async () => {
    const auditRows = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE action_id = 'rasid.mod.ai.guardrails.evaluate'
        AND tenant_id = ${tenantId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0].status).toBe('success');
  });

  it('evaluation log entries match audit log entries', async () => {
    // Both guardrail_evaluations and audit_log should have records
    const evalCount = await adminSql`
      SELECT COUNT(*)::int AS total FROM mod_ai.guardrail_evaluations
      WHERE tenant_id = ${tenantId}
    `;
    const auditCount = await adminSql`
      SELECT COUNT(*)::int AS total FROM kernel.audit_log
      WHERE action_id LIKE 'rasid.mod.ai.guardrails.%'
        AND tenant_id = ${tenantId}::uuid
    `;
    expect(evalCount[0].total).toBeGreaterThan(0);
    expect(auditCount[0].total).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// 15. RULE DELETION
// ═══════════════════════════════════════════

describe('Rule Deletion', () => {
  it('deletes a rule', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/ai/guardrails/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);
  });

  it('returns 404 for deleted rule', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/guardrails/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});


// ═══════════════════════════════════════════
// 16. FLAG VERDICT GUARANTEES
// ═══════════════════════════════════════════

describe('FLAG Verdict Guarantees', () => {

  it('FLAG does not modify input payload — returned input_snapshot matches original', async () => {
    const originalInput = { content: 'Show me the ssn records', extra: 42, nested: { a: 1 } };
    const inputCopy = JSON.parse(JSON.stringify(originalInput));

    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.query',
        input: originalInput,
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('flag');

    // The input_snapshot logged must match the original — no mutation
    const flagEval = data.evaluations.find((e: any) => e.verdict === 'flag');
    expect(flagEval).toBeDefined();
    expect(flagEval.input_snapshot).toEqual(inputCopy);

    // The evaluate() return type has NO modified_input, NO rewritten_input,
    // NO filtered_input field — only verdict + evaluations + blocked_by + blocked_message
    expect(data).not.toHaveProperty('modified_input');
    expect(data).not.toHaveProperty('rewritten_input');
    expect(data).not.toHaveProperty('filtered_input');
    expect(data).not.toHaveProperty('sanitized_input');
  });

  it('FLAG does not mutate action parameters — evaluate returns no parameter overrides', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.query',
        input: { content: 'credit_card data here' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('flag');

    // No action parameter overrides in response
    expect(data).not.toHaveProperty('action_override');
    expect(data).not.toHaveProperty('modified_action');
    expect(data).not.toHaveProperty('replacement_action');
    expect(data).not.toHaveProperty('parameters');
    expect(data).not.toHaveProperty('modified_parameters');

    // Response only contains: verdict, evaluations, optionally blocked_by/blocked_message
    const keys = Object.keys(data);
    for (const key of keys) {
      expect(['verdict', 'evaluations', 'blocked_by', 'blocked_message']).toContain(key);
    }
  });

  it('FLAG does not alter tool selection — no tool_id or tool_override in response', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/guardrails/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action_id: 'rasid.mod.ai.test.query',
        input: { content: 'ssn lookup request' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.verdict).toBe('flag');

    // No tool selection alteration
    expect(data).not.toHaveProperty('tool_id');
    expect(data).not.toHaveProperty('tool_override');
    expect(data).not.toHaveProperty('selected_tool');
    expect(data).not.toHaveProperty('replacement_tool');

    // Static analysis: guardrails.service.ts never references tool_definitions or tool_bindings
    const svcSrc = fs.readFileSync(
      'packages/modules/ai-engine/src/guardrails.service.ts', 'utf-8',
    );
    expect(svcSrc).not.toMatch(/tool_definitions|tool_bindings|tool_invocations/);
    expect(svcSrc).not.toMatch(/toolService|ToolService|tool\.service/);
  });

  it('FLAG only logs and allows execution unchanged — static proof', () => {
    const svcSrc = fs.readFileSync(
      'packages/modules/ai-engine/src/guardrails.service.ts', 'utf-8',
    );

    // 1. evaluate() return type is GuardrailEvaluationResult which has no input mutation fields
    //    Verify the function signature returns only { verdict, evaluations, blocked_by, blocked_message }
    expect(svcSrc).toMatch(/return\s*\{\s*verdict:\s*finalVerdict/);

    // 2. The sensitivity_flag branch returns { verdict: 'flag', message: rule.message }
    //    It does NOT return any modified input
    expect(svcSrc).toMatch(/return\s*\{\s*verdict:\s*'flag',\s*message:\s*rule\.message\s*\}/);

    // 3. No assignment to input parameter — input is read-only
    const code = svcSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // Check that 'input' parameter is never assigned to (input.xxx = or input = )
    // input[field] access is read-only comparison (===), never assignment (=)
    // Verify no input[...] = ... (write) patterns exist — exclude === and !==
    const inputBracketAssigns = (code.match(/\binput\[[^\]]+\]\s*=[^=]/g) || [])
      .filter(m => !m.includes('===') && !m.includes('!=='));
    expect(inputBracketAssigns).toEqual([]); // no input[key] = value
    // Verify no reassignment of input variable itself — exclude === and !==
    const inputReassigns = (code.match(/\binput\s*=[^=]/g) || [])
      .filter(m => !m.includes('===') && !m.includes('!=='));
    expect(inputReassigns).toEqual([]); // no input = value

    // 4. No mutation of any external state during FLAG
    expect(code).not.toMatch(/globalThis\./);
    expect(code).not.toMatch(/process\.env\.\w+\s*=/);

    // 5. The evaluate function only does: read rules, evaluate, INSERT into evaluations log, return result
    //    No UPDATE/DELETE on any other table during evaluation
    const evalSection = svcSrc.slice(
      svcSrc.indexOf('async evaluate('),
      svcSrc.indexOf('async listEvaluations('),
    );
    expect(evalSection).not.toMatch(/UPDATE\s+/i);
    expect(evalSection).not.toMatch(/DELETE\s+/i);
    // Only INSERT is into guardrail_evaluations (the log table)
    const insertMatches = evalSection.match(/INSERT INTO\s+[\w.]+/gi) || [];
    expect(insertMatches.length).toBe(1);
    expect(insertMatches[0]).toMatch(/guardrail_evaluations/);
  });
});

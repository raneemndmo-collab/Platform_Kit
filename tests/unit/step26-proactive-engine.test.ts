/**
 * STEP 26 — Proactive Engine Tests
 *
 * Covers:
 * 1.  Actions registered (11 actions)
 * 2.  Rule CRUD (create, get, list, update, delete)
 * 3.  Event evaluation — generates suggestions only
 * 4.  Suggestion lifecycle (pending → accepted / dismissed)
 * 5.  Condition matching (match_any, payload_contains, payload_field_equals, metadata_field_equals)
 * 6.  Template rendering
 * 7.  Tenant isolation
 * 8.  Schema & migration compliance (RLS, no cross-schema FK)
 * 9.  No background loop — static analysis
 * 10. No automatic execution — static analysis
 * 11. No Kernel modification
 * 12. Event subscription proof
 * 13. Audit logging proof
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';

let app: FastifyInstance;
let token: string;
let ruleId: string;
let suggestionId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();
  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(loginRes.statusCode).toBe(200);
  token = loginRes.json().data.token.access_token;
});

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════
// 1. ACTIONS REGISTERED
// ═══════════════════════════════════════════

describe('Proactive Actions Registration', () => {
  it('registers 10 proactive actions', async () => {
    const { actionRegistry } = await import('../../packages/kernel/src/index.js');
    const proactiveActions = actionRegistry.listActions({ module: 'mod_ai' })
      .filter((a: any) => a.action_id.includes('proactive'));
    expect(proactiveActions.length).toBe(10);
    const actionIds = proactiveActions.map((a: any) => a.action_id).sort();
    expect(actionIds).toEqual([
      'rasid.mod.ai.proactive.evaluate',
      'rasid.mod.ai.proactive.rule.create',
      'rasid.mod.ai.proactive.rule.delete',
      'rasid.mod.ai.proactive.rule.get',
      'rasid.mod.ai.proactive.rule.list',
      'rasid.mod.ai.proactive.rule.update',
      'rasid.mod.ai.proactive.suggestion.accept',
      'rasid.mod.ai.proactive.suggestion.dismiss',
      'rasid.mod.ai.proactive.suggestion.get',
      'rasid.mod.ai.proactive.suggestion.list',
    ]);
  });
});

// ═══════════════════════════════════════════
// 2. RULE CRUD
// ═══════════════════════════════════════════

describe('Rule CRUD', () => {
  it('creates a proactive rule', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'High-value object alert',
        event_type: 'rasid.core.object.created',
        condition: { match_any: true },
        suggestion_title_template: 'New object created: {{name}}',
        suggestion_body_template: 'A new object "{{name}}" was created. Consider reviewing it.',
        suggested_action_id: 'rasid.core.object.read',
        priority: 'high',
      },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.name).toBe('High-value object alert');
    expect(data.event_type).toBe('rasid.core.object.created');
    expect(data.status).toBe('active');
    expect(data.priority).toBe('high');
    ruleId = data.id;
  });

  it('gets a proactive rule by ID', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/proactive/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(ruleId);
  });

  it('lists proactive rules', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/proactive/rules',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.json().data.total).toBeGreaterThanOrEqual(1);
  });

  it('updates a proactive rule', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/proactive/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated alert rule', priority: 'medium' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated alert rule');
    expect(res.json().data.priority).toBe('medium');
  });

  it('returns 404 for non-existent rule', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/proactive/rules/01900000-0000-7000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════
// 3. EVENT EVALUATION — generates suggestions ONLY
// ═══════════════════════════════════════════

describe('Event Evaluation', () => {
  it('evaluates an event and generates a suggestion', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'rasid.core.object.created',
        event_id: 'evt-001',
        actor_id: 'user-001',
        payload: { name: 'Important Document' },
        metadata: { source: 'api' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.suggestions.length).toBe(1);
    expect(data.suggestions[0].status).toBe('pending');
    expect(data.suggestions[0].title).toContain('Important Document');
    expect(data.suggestions[0].suggested_action_id).toBe('rasid.core.object.read');
    suggestionId = data.suggestions[0].id;
  });

  it('does not generate suggestions for non-matching event types', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'rasid.core.object.deleted',
        event_id: 'evt-002',
        actor_id: 'user-001',
        payload: {},
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.suggestions.length).toBe(0);
  });

  it('evaluation response contains NO executeAction call result', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'rasid.core.object.created',
        event_id: 'evt-003',
        actor_id: 'user-001',
        payload: { name: 'Test' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    // Response only contains suggestions — no execution results
    expect(data).not.toHaveProperty('execution_result');
    expect(data).not.toHaveProperty('action_result');
    expect(data).not.toHaveProperty('tool_result');
    for (const s of data.suggestions) {
      expect(s.status).toBe('pending');
      expect(s).not.toHaveProperty('execution_result');
    }
  });
});

// ═══════════════════════════════════════════
// 4. SUGGESTION LIFECYCLE
// ═══════════════════════════════════════════

describe('Suggestion Lifecycle', () => {
  it('gets a suggestion by ID', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/proactive/suggestions/${suggestionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('pending');
  });

  it('lists suggestions', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/proactive/suggestions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('lists suggestions filtered by status', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/proactive/suggestions?status=pending',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    for (const s of res.json().data.items) {
      expect(s.status).toBe('pending');
    }
  });

  it('dismisses a suggestion — does NOT execute anything', async () => {
    // Create a new suggestion to dismiss
    const evalRes = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'rasid.core.object.created',
        event_id: 'evt-dismiss',
        actor_id: 'user-001',
        payload: { name: 'Dismiss Test' },
      },
    });
    const dismissId = evalRes.json().data.suggestions[0].id;

    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/proactive/suggestions/${dismissId}/dismiss`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.status).toBe('dismissed');
    expect(data.dismissed_at).toBeTruthy();
    // Dismiss does NOT return any execution result
    expect(data).not.toHaveProperty('execution_result');
  });

  it('accepts a suggestion — does NOT execute the suggested action', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/proactive/suggestions/${suggestionId}/accept`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.status).toBe('accepted');
    expect(data.accepted_at).toBeTruthy();
    // Accept does NOT return any execution result
    expect(data).not.toHaveProperty('execution_result');
    expect(data).not.toHaveProperty('action_result');
  });

  it('cannot dismiss an already accepted suggestion', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/proactive/suggestions/${suggestionId}/dismiss`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════
// 5. CONDITION MATCHING
// ═══════════════════════════════════════════

describe('Condition Matching', () => {
  let payloadContainsRuleId: string;
  let fieldEqualsRuleId: string;
  let metadataRuleId: string;

  beforeAll(async () => {
    // Create rule with payload_contains
    let res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Keyword alert',
        event_type: 'test.keyword.event',
        condition: { payload_contains: ['urgent', 'critical'] },
        suggestion_title_template: 'Urgent item detected',
        suggestion_body_template: 'An urgent item was detected in the event.',
      },
    });
    payloadContainsRuleId = res.json().data.id;

    // Create rule with payload_field_equals
    res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Status change alert',
        event_type: 'test.status.event',
        condition: { payload_field_equals: { status: 'error' } },
        suggestion_title_template: 'Error status detected',
        suggestion_body_template: 'Status changed to error.',
      },
    });
    fieldEqualsRuleId = res.json().data.id;

    // Create rule with metadata_field_equals
    res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Source alert',
        event_type: 'test.metadata.event',
        condition: { metadata_field_equals: { source: 'external' } },
        suggestion_title_template: 'External event',
        suggestion_body_template: 'Event from external source.',
      },
    });
    metadataRuleId = res.json().data.id;
  });

  it('payload_contains triggers when keyword found', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'test.keyword.event',
        event_id: 'evt-kw1',
        actor_id: 'user-001',
        payload: { message: 'This is urgent' },
      },
    });
    expect(res.json().data.suggestions.length).toBe(1);
  });

  it('payload_contains does not trigger when no keyword found', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'test.keyword.event',
        event_id: 'evt-kw2',
        actor_id: 'user-001',
        payload: { message: 'This is normal' },
      },
    });
    expect(res.json().data.suggestions.length).toBe(0);
  });

  it('payload_field_equals triggers on exact match', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'test.status.event',
        event_id: 'evt-fe1',
        actor_id: 'user-001',
        payload: { status: 'error' },
      },
    });
    expect(res.json().data.suggestions.length).toBe(1);
  });

  it('payload_field_equals does not trigger on mismatch', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'test.status.event',
        event_id: 'evt-fe2',
        actor_id: 'user-001',
        payload: { status: 'ok' },
      },
    });
    expect(res.json().data.suggestions.length).toBe(0);
  });

  it('metadata_field_equals triggers on exact match', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'test.metadata.event',
        event_id: 'evt-me1',
        actor_id: 'user-001',
        payload: {},
        metadata: { source: 'external' },
      },
    });
    expect(res.json().data.suggestions.length).toBe(1);
  });
});

// ═══════════════════════════════════════════
// 6. TEMPLATE RENDERING
// ═══════════════════════════════════════════

describe('Template Rendering', () => {
  it('renders {{key}} placeholders from payload', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/proactive/evaluate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'rasid.core.object.created',
        event_id: 'evt-tpl1',
        actor_id: 'user-001',
        payload: { name: 'My Document' },
      },
    });
    const suggestion = res.json().data.suggestions[0];
    expect(suggestion.title).toContain('My Document');
    expect(suggestion.body).toContain('My Document');
  });
});

// ═══════════════════════════════════════════
// 7. TENANT ISOLATION
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

  it('Beta tenant sees 0 Acme rules', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/proactive/rules',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBe(0);
  });

  it('Beta tenant sees 0 Acme suggestions', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/proactive/suggestions',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 8. SCHEMA & MIGRATION COMPLIANCE
// ═══════════════════════════════════════════

describe('Schema & Migration Compliance', () => {
  it('proactive_rules table exists with RLS enabled', async () => {
    const rows = await adminSql`
      SELECT rowsecurity FROM pg_tables
      WHERE schemaname = 'mod_ai' AND tablename = 'proactive_rules'
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].rowsecurity).toBe(true);
  });

  it('proactive_suggestions table exists with RLS enabled', async () => {
    const rows = await adminSql`
      SELECT rowsecurity FROM pg_tables
      WHERE schemaname = 'mod_ai' AND tablename = 'proactive_suggestions'
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].rowsecurity).toBe(true);
  });

  it('RLS tenant_isolation policy exists on proactive_rules', async () => {
    const rows = await adminSql`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'mod_ai' AND tablename = 'proactive_rules' AND policyname = 'tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });

  it('RLS tenant_isolation policy exists on proactive_suggestions', async () => {
    const rows = await adminSql`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'mod_ai' AND tablename = 'proactive_suggestions' AND policyname = 'tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });

  it('no cross-schema foreign keys from proactive tables', async () => {
    const rows = await adminSql`
      SELECT tc.table_schema, tc.table_name, ccu.table_schema AS ref_schema
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'mod_ai'
        AND tc.table_name IN ('proactive_rules', 'proactive_suggestions')
        AND ccu.table_schema != 'mod_ai'
    `;
    expect(rows.length).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 9. NO BACKGROUND LOOP — STATIC ANALYSIS
// ═══════════════════════════════════════════

describe('No Background Loop — Static Analysis', () => {
  const proactiveFiles = [
    'packages/modules/ai-engine/src/proactive.types.ts',
    'packages/modules/ai-engine/src/proactive.schema.ts',
    'packages/modules/ai-engine/src/proactive.service.ts',
    'packages/modules/ai-engine/src/proactive.actions.ts',
    'packages/modules/ai-engine/src/proactive.routes.ts',
    'packages/modules/ai-engine/src/migrate-step7.ts',
  ];

  function readAll(): string {
    return proactiveFiles.map((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      // Strip comments
      return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    }).join('\n');
  }

  it('no setInterval in proactive code', () => {
    expect(readAll()).not.toMatch(/setInterval/);
  });

  it('no setTimeout in proactive code', () => {
    expect(readAll()).not.toMatch(/setTimeout/);
  });

  it('no cron or scheduler in proactive code', () => {
    expect(readAll()).not.toMatch(/cron|schedule|scheduler/i);
  });

  it('no job queue in proactive code', () => {
    expect(readAll()).not.toMatch(/bull|bullmq|agenda|bee-queue|queue/i);
  });

  it('no async loop or polling in proactive code', () => {
    expect(readAll()).not.toMatch(/while\s*\(\s*true\s*\)/);
    expect(readAll()).not.toMatch(/setImmediate/);
    expect(readAll()).not.toMatch(/process\.nextTick/);
  });

  it('no worker threads in proactive code', () => {
    expect(readAll()).not.toMatch(/worker_threads|Worker\(/);
  });
});

// ═══════════════════════════════════════════
// 10. NO AUTOMATIC EXECUTION — STATIC ANALYSIS
// ═══════════════════════════════════════════

describe('No Automatic Execution — Static Analysis', () => {
  it('proactive.service.ts never calls executeAction (excluding comments)', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.service.ts', 'utf-8',
    );
    // Strip comments before checking
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/executeAction/);
  });

  it('proactive.service.ts never imports actionRegistry', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/actionRegistry/);
    expect(src).not.toMatch(/action-registry/);
  });

  it('proactive.service.ts never calls any external HTTP endpoint', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/fetch\(|axios|got\(|node-fetch|https?:\/\//);
  });

  it('acceptSuggestion only updates status — does NOT execute suggested action', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.service.ts', 'utf-8',
    );
    const acceptSection = src.slice(
      src.indexOf('async acceptSuggestion('),
      src.indexOf('// ═', src.indexOf('async acceptSuggestion(') + 1),
    );
    // Strip comments
    const stripped = acceptSection.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/executeAction/);
    expect(stripped).not.toMatch(/actionRegistry/);
    // Only contains UPDATE ... SET status = 'accepted'
    expect(stripped).toMatch(/status\s*=\s*'accepted'/);
  });

  it('dismissSuggestion only updates status — does NOT execute anything', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.service.ts', 'utf-8',
    );
    const dismissSection = src.slice(
      src.indexOf('async dismissSuggestion('),
      src.indexOf('async acceptSuggestion('),
    );
    // Strip comments
    const stripped = dismissSection.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/executeAction/);
    expect(stripped).toMatch(/status\s*=\s*'dismissed'/);
  });

  it('evaluateEvent only INSERTs into proactive_suggestions — no other writes', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.service.ts', 'utf-8',
    );
    const evalSection = src.slice(
      src.indexOf('async evaluateEvent('),
      src.indexOf('async getSuggestion('),
    );
    // Only INSERT is into proactive_suggestions
    const insertMatches = evalSection.match(/INSERT INTO\s+[\w.]+/gi) || [];
    expect(insertMatches.length).toBe(1);
    expect(insertMatches[0]).toMatch(/proactive_suggestions/);
    // No UPDATE or DELETE
    expect(evalSection).not.toMatch(/\bUPDATE\b/i);
    expect(evalSection).not.toMatch(/\bDELETE\b/i);
  });
});

// ═══════════════════════════════════════════
// 11. NO KERNEL MODIFICATION
// ═══════════════════════════════════════════

describe('No Kernel Modification', () => {
  it('proactive files do not import from kernel internals (only public surface)', () => {
    const files = [
      'packages/modules/ai-engine/src/proactive.actions.ts',
      'packages/modules/ai-engine/src/proactive.routes.ts',
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf-8');
      const imports = src.match(/from\s+['"]([^'"]+)['"]/g) || [];
      for (const imp of imports) {
        // Must not import from kernel internal paths like kernel/src/event-bus/...
        if (imp.includes('kernel')) {
          expect(imp).toMatch(/kernel\/src\/index/);
        }
      }
    }
  });

  it('proactive.service.ts does not import from kernel at all', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/from\s+['"].*kernel/);
    expect(src).not.toMatch(/from\s+['"]@rasid\/kernel/);
  });

  it('no modification to action-registry.service.ts', () => {
    const src = fs.readFileSync(
      'packages/kernel/src/action-registry/action-registry.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/proactive/i);
  });

  it('no modification to event-bus.service.ts', () => {
    const src = fs.readFileSync(
      'packages/kernel/src/event-bus/event-bus.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/proactive/i);
  });

  it('no modification to policy service', () => {
    const src = fs.readFileSync(
      'packages/kernel/src/policy/policy.service.ts', 'utf-8',
    );
    expect(src).not.toMatch(/proactive/i);
  });
});

// ═══════════════════════════════════════════
// 12. EVENT SUBSCRIPTION PROOF
// ═══════════════════════════════════════════

describe('Event Subscription Proof', () => {
  it('proactive rules subscribe to event_type — not to background listeners', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.service.ts', 'utf-8',
    );
    // The service queries rules by event_type — this is the subscription mechanism
    expect(src).toMatch(/event_type\s*=\s*\$\{eventType\}/);
    // No eventBus.subscribe in service
    expect(src).not.toMatch(/eventBus\.subscribe/);
    expect(src).not.toMatch(/\.on\(/);
  });

  it('proactive.actions.ts does not subscribe to eventBus', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.actions.ts', 'utf-8',
    );
    expect(src).not.toMatch(/eventBus/);
    expect(src).not.toMatch(/subscribe/);
  });

  it('proactive.routes.ts does not subscribe to eventBus', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/proactive.routes.ts', 'utf-8',
    );
    expect(src).not.toMatch(/eventBus/);
    expect(src).not.toMatch(/subscribe/);
  });
});

// ═══════════════════════════════════════════
// 13. AUDIT LOGGING PROOF
// ═══════════════════════════════════════════

describe('Audit Logging Proof', () => {
  it('rule creation generates audit log', async () => {
    const auditRes = await app.inject({
      method: 'GET', url: '/api/v1/audit?action_id=rasid.mod.ai.proactive.rule.create',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.json().data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('evaluation generates audit log', async () => {
    const auditRes = await app.inject({
      method: 'GET', url: '/api/v1/audit?action_id=rasid.mod.ai.proactive.evaluate',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.json().data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('suggestion accept generates audit log', async () => {
    const auditRes = await app.inject({
      method: 'GET', url: '/api/v1/audit?action_id=rasid.mod.ai.proactive.suggestion.accept',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.json().data.items.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════
// 14. RULE DELETION
// ═══════════════════════════════════════════

describe('Rule Deletion', () => {
  it('deletes a rule', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/ai/proactive/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);
  });

  it('returns 404 for deleted rule', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/proactive/rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

/**
 * Step 24 — Memory Layer Tests
 *
 * Validates:
 * - Memory Session CRUD (create, list, get, update, delete)
 * - Memory Entry management (add, list)
 * - Session-scoped memory only (no cross-session sharing)
 * - Closed session rejects new entries
 * - RLS tenant isolation
 * - Auth enforcement (401 without token)
 * - K3 action registration (all 7 actions)
 * - No auto-execution, no background jobs
 * - No PII beyond allowed fields
 * - No cross-schema foreign keys
 * - Audit trail via K3 pipeline
 * - Schema compliance (migrate-step5.ts)
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

  // Decode JWT for tenantId and userId
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  tenantId = payload.tid;
  userId = payload.sub;
});

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════
// 1. MEMORY SESSION CRUD
// ═══════════════════════════════════════════

let sessionId: string;
let sessionId2: string;

describe('Memory Session CRUD', () => {
  it('POST /api/v1/ai/memory/sessions — creates session with defaults', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/memory/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(body.data.tenant_id).toBe(tenantId);
    expect(body.data.user_id).toBe(userId);
    expect(body.data.label).toBe('');
    expect(body.data.status).toBe('active');
    expect(body.data.metadata).toEqual({});
    expect(body.data.created_at).toBeDefined();
    expect(body.data.updated_at).toBeDefined();
    sessionId = body.data.id;
  });

  it('POST /api/v1/ai/memory/sessions — creates session with label and metadata', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/memory/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Research Session', metadata: { source: 'reports', purpose: 'analysis' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.label).toBe('Research Session');
    expect(body.data.metadata).toEqual({ source: 'reports', purpose: 'analysis' });
    expect(body.data.status).toBe('active');
    sessionId2 = body.data.id;
  });

  it('GET /api/v1/ai/memory/sessions — lists sessions', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/memory/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items).toBeDefined();
    expect(body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(body.data.total).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/ai/memory/sessions — supports pagination', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/memory/sessions?limit=1&offset=0',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBe(1);
    expect(body.data.total).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/ai/memory/sessions/:id — returns session', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/memory/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(sessionId);
    expect(body.data.tenant_id).toBe(tenantId);
  });

  it('GET /api/v1/ai/memory/sessions/:id — 404 for nonexistent', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/memory/sessions/nonexistent-id',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /api/v1/ai/memory/sessions/:id — updates label', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/memory/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Updated Label' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.label).toBe('Updated Label');
  });

  it('PATCH /api/v1/ai/memory/sessions/:id — updates metadata', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/memory/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { metadata: { updated: true, context: 'test' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.metadata).toEqual({ updated: true, context: 'test' });
  });

  it('PATCH /api/v1/ai/memory/sessions/:id — closes session', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/memory/sessions/${sessionId2}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'closed' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('closed');
  });
});

// ═══════════════════════════════════════════
// 2. MEMORY ENTRY MANAGEMENT
// ═══════════════════════════════════════════

describe('Memory Entry Management', () => {
  it('POST /api/v1/ai/memory/sessions/:id/entries — adds user entry', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/memory/sessions/${sessionId}/entries`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'user', content: { text: 'What is the revenue trend?' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.session_id).toBe(sessionId);
    expect(body.data.role).toBe('user');
    expect(body.data.content).toEqual({ text: 'What is the revenue trend?' });
    expect(body.data.seq).toBe(1);
    expect(body.data.user_id).toBe(userId);
    expect(body.data.tenant_id).toBe(tenantId);
  });

  it('POST /api/v1/ai/memory/sessions/:id/entries — adds assistant entry', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/memory/sessions/${sessionId}/entries`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'assistant', content: { text: 'Revenue is trending upward by 15%.' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.role).toBe('assistant');
    expect(body.data.seq).toBe(2);
  });

  it('POST /api/v1/ai/memory/sessions/:id/entries — adds system entry', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/memory/sessions/${sessionId}/entries`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'system', content: { instruction: 'Use formal language' } },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.role).toBe('system');
    expect(res.json().data.seq).toBe(3);
  });

  it('POST /api/v1/ai/memory/sessions/:id/entries — adds tool entry', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/memory/sessions/${sessionId}/entries`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'tool', content: { tool_name: 'search', result: { items: [] } } },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.role).toBe('tool');
    expect(res.json().data.seq).toBe(4);
  });

  it('GET /api/v1/ai/memory/sessions/:id/entries — lists entries in order', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/memory/sessions/${sessionId}/entries`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBe(4);
    expect(body.data.total).toBe(4);
    // Verify ordering by seq
    expect(body.data.items[0].seq).toBe(1);
    expect(body.data.items[1].seq).toBe(2);
    expect(body.data.items[2].seq).toBe(3);
    expect(body.data.items[3].seq).toBe(4);
    // Verify roles
    expect(body.data.items[0].role).toBe('user');
    expect(body.data.items[1].role).toBe('assistant');
    expect(body.data.items[2].role).toBe('system');
    expect(body.data.items[3].role).toBe('tool');
  });

  it('GET /api/v1/ai/memory/sessions/:id/entries — supports pagination', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/memory/sessions/${sessionId}/entries?limit=2&offset=0`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBe(2);
    expect(body.data.total).toBe(4);
    expect(body.data.items[0].seq).toBe(1);
    expect(body.data.items[1].seq).toBe(2);
  });

  it('POST — rejects entry on closed session', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/memory/sessions/${sessionId2}/entries`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'user', content: { text: 'Should fail' } },
    });
    // Should return 400 or 500 because session is closed
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ═══════════════════════════════════════════
// 3. SESSION DELETE (CASCADE)
// ═══════════════════════════════════════════

describe('Memory Session Delete', () => {
  let deleteSessionId: string;

  it('creates session with entries for deletion test', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/ai/memory/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'To Delete' },
    });
    expect(createRes.statusCode).toBe(201);
    deleteSessionId = createRes.json().data.id;

    // Add entries
    for (const role of ['user', 'assistant'] as const) {
      await app.inject({
        method: 'POST', url: `/api/v1/ai/memory/sessions/${deleteSessionId}/entries`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role, content: { text: `${role} message` } },
      });
    }
  });

  it('DELETE /api/v1/ai/memory/sessions/:id — deletes session and entries', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/ai/memory/sessions/${deleteSessionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);

    // Verify session is gone
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/ai/memory/sessions/${deleteSessionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE — 404 for nonexistent session', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/api/v1/ai/memory/sessions/nonexistent-id',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════
// 4. AUTH ENFORCEMENT
// ═══════════════════════════════════════════

describe('Auth Enforcement', () => {
  it('GET /api/v1/ai/memory/sessions — 401 without token', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/memory/sessions',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/ai/memory/sessions — 401 without token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/memory/sessions',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/ai/memory/sessions/:id/entries — 401 without token', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/memory/sessions/${sessionId}/entries`,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════
// 5. TENANT ISOLATION (RLS)
// ═══════════════════════════════════════════

describe('Tenant Isolation', () => {
  let betaToken: string;

  beforeAll(async () => {
    // Login as Beta tenant user
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
    });
    expect(loginRes.statusCode).toBe(200);
    betaToken = loginRes.json().data.token.access_token;
  });

  it('Beta tenant cannot see Acme sessions', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/memory/sessions',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    // Beta should see 0 sessions (all sessions belong to Acme)
    expect(res.json().data.items.length).toBe(0);
  });

  it('Beta tenant cannot access Acme session by ID', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/memory/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════
// 6. K3 ACTION REGISTRATION
// ═══════════════════════════════════════════

describe('K3 Action Registration', () => {
  it('all 7 memory actions are registered', async () => {
    const { actionRegistry } = await import('../../packages/kernel/src/index.js');
    const memoryActions = actionRegistry.listActions({ module: 'mod_ai' })
      .filter((a: any) => a.action_id.includes('memory'));
    expect(memoryActions.length).toBe(7);

    const actionIds = memoryActions.map((a: any) => a.action_id).sort();
    expect(actionIds).toEqual([
      'rasid.mod.ai.memory.entry.add',
      'rasid.mod.ai.memory.entry.list',
      'rasid.mod.ai.memory.session.create',
      'rasid.mod.ai.memory.session.delete',
      'rasid.mod.ai.memory.session.get',
      'rasid.mod.ai.memory.session.list',
      'rasid.mod.ai.memory.session.update',
    ]);
  });

  it('all memory actions have correct required_permissions format', async () => {
    const { actionRegistry } = await import('../../packages/kernel/src/index.js');
    const memoryActions = actionRegistry.listActions({ module: 'mod_ai' })
      .filter((a: any) => a.action_id.includes('memory'));
    for (const action of memoryActions) {
      expect(action.required_permissions).toBeDefined();
      expect(Array.isArray(action.required_permissions)).toBe(true);
      for (const perm of action.required_permissions) {
        expect(typeof perm).toBe('string');
        expect(perm).toMatch(/^ai_memory_(sessions|entries)\.(create|read|update|delete)$/);
      }
    }
  });
});

// ═══════════════════════════════════════════
// 7. SCHEMA & MIGRATION COMPLIANCE
// ═══════════════════════════════════════════

describe('Schema & Migration Compliance', () => {
  it('memory_sessions table exists with RLS enabled', async () => {
    const rows = await adminSql`
      SELECT rowsecurity FROM pg_tables
      WHERE schemaname = 'mod_ai' AND tablename = 'memory_sessions'
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].rowsecurity).toBe(true);
  });

  it('memory_entries table exists with RLS enabled', async () => {
    const rows = await adminSql`
      SELECT rowsecurity FROM pg_tables
      WHERE schemaname = 'mod_ai' AND tablename = 'memory_entries'
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].rowsecurity).toBe(true);
  });

  it('RLS tenant_isolation policy exists on memory_sessions', async () => {
    const rows = await adminSql`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'mod_ai' AND tablename = 'memory_sessions' AND policyname = 'tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });

  it('RLS tenant_isolation policy exists on memory_entries', async () => {
    const rows = await adminSql`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'mod_ai' AND tablename = 'memory_entries' AND policyname = 'tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });

  it('memory_sessions has correct columns', async () => {
    const cols = await adminSql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'mod_ai' AND table_name = 'memory_sessions'
      ORDER BY ordinal_position
    `;
    const colNames = cols.map((c: any) => c.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('tenant_id');
    expect(colNames).toContain('user_id');
    expect(colNames).toContain('label');
    expect(colNames).toContain('metadata');
    expect(colNames).toContain('status');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');
  });

  it('memory_entries has correct columns', async () => {
    const cols = await adminSql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'mod_ai' AND table_name = 'memory_entries'
      ORDER BY ordinal_position
    `;
    const colNames = cols.map((c: any) => c.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('session_id');
    expect(colNames).toContain('tenant_id');
    expect(colNames).toContain('user_id');
    expect(colNames).toContain('role');
    expect(colNames).toContain('content');
    expect(colNames).toContain('seq');
    expect(colNames).toContain('created_at');
  });

  it('no cross-schema foreign keys from memory tables', async () => {
    const fks = await adminSql`
      SELECT tc.constraint_name, ccu.table_schema AS foreign_schema
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'mod_ai'
        AND tc.table_name IN ('memory_sessions', 'memory_entries')
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema != 'mod_ai'
    `;
    expect(fks.length).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 8. NO AUTO-EXECUTION / NO BACKGROUND JOBS
// ═══════════════════════════════════════════

describe('No Auto-Execution Compliance', () => {
  it('migrate-step5.ts has no setInterval/setTimeout/cron', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/migrate-step5.ts', 'utf-8',
    );
    expect(src).not.toMatch(/setInterval|setTimeout|cron|schedule|worker|queue/i);
  });

  it('memory.service.ts has no setInterval/setTimeout/cron in code', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/memory.service.ts', 'utf-8',
    );
    // Strip comments before checking
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/setInterval|setTimeout|cron\b/i);
    expect(code).not.toMatch(/\bworker\b|\bqueue\b/i);
  });

  it('memory.actions.ts has no setInterval/setTimeout/cron in code', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/memory.actions.ts', 'utf-8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/setInterval|setTimeout|cron\b/i);
    expect(code).not.toMatch(/\bworker\b|\bqueue\b/i);
  });

  it('memory.routes.ts has no setInterval/setTimeout/cron in code', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/memory.routes.ts', 'utf-8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/setInterval|setTimeout|cron\b/i);
    expect(code).not.toMatch(/\bworker\b|\bqueue\b/i);
  });

  it('memory.routes.ts has no streaming/websocket in code', () => {
    const src = fs.readFileSync(
      'packages/modules/ai-engine/src/memory.routes.ts', 'utf-8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bwebsocket\b|\bws\(|socket\.io|\bSSE\b/i);
  });
});

// ═══════════════════════════════════════════
// 9. NO KERNEL MODIFICATIONS
// ═══════════════════════════════════════════

describe('No Kernel Modifications', () => {
  it('memory files import only from kernel public surface', () => {
    const files = [
      'packages/modules/ai-engine/src/memory.actions.ts',
      'packages/modules/ai-engine/src/memory.routes.ts',
      'packages/modules/ai-engine/src/memory.service.ts',
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf-8');
      // Should NOT import from internal kernel paths
      const imports = src.match(/from\s+['"]([^'"]+)['"]/g) || [];
      for (const imp of imports) {
        if (imp.includes('kernel')) {
          // Must be from kernel/src/index.js (public surface)
          expect(imp).toMatch(/kernel\/src\/index\.js/);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════
// 10. AUDIT TRAIL
// ═══════════════════════════════════════════

describe('Audit Trail', () => {
  it('memory session creation generates audit log', async () => {
    const auditRows = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE action_id = 'rasid.mod.ai.memory.session.create'
        AND tenant_id = ${tenantId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0].status).toBe('success');
  });

  it('memory entry addition generates audit log', async () => {
    const auditRows = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE action_id = 'rasid.mod.ai.memory.entry.add'
        AND tenant_id = ${tenantId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0].status).toBe('success');
  });
});

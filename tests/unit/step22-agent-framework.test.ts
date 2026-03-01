/**
 * Step 22 — Agent Framework Core (Minimal Version)
 *
 * Tests:
 * 1. Agent CRUD (create, list, get, update, delete)
 * 2. Agent execution — one tool per request via Tool Registry → K3
 * 3. Policy enforcement (K4) — rejected when tool not in allowed list
 * 4. Policy enforcement — rejected when agent is disabled
 * 5. Policy enforcement — rejected when tool does not exist
 * 6. Execution history (list, get)
 * 7. Audit trail — execution logged
 * 8. No autonomous loop — single request/response
 * 9. RBAC — 401 without auth
 * 10. K3 action registration verification
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let tenantId: string;
let userId: string;

// Shared tool IDs populated after sync
let syncedToolId: string;
let syncedToolId2: string;

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

  // Decode JWT to get userId and tenantId
  const [, payloadB64] = token.split('.');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  userId = payload.sub;
  tenantId = payload.tid;

  // Sync tool registry to populate tool definitions
  const syncRes = await app.inject({
    method: 'POST', url: '/api/v1/ai/tool-registry/sync',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(syncRes.statusCode).toBe(200);

  // Get synced tools
  const toolsRes = await app.inject({
method: 'GET', url: '/api/v1/ai/tool-definitions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(toolsRes.statusCode).toBe(200);
    const tools = toolsRes.json().data;
    expect(tools.length).toBeGreaterThanOrEqual(2);
    syncedToolId = tools[0].id;
    syncedToolId2 = tools[1].id;
});

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════
// 1. AGENT CRUD
// ═══════════════════════════════════════════

describe('Agent CRUD', () => {
  let agentId: string;

  it('POST /api/v1/ai/agents — creates agent', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/agents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Test Agent',
        description: 'A minimal test agent',
        system_prompt: 'You are a test agent.',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Test Agent');
    expect(body.data.description).toBe('A minimal test agent');
    expect(body.data.status).toBe('active');
    expect(body.data.allowed_tool_ids).toEqual([]);
    expect(body.data.system_prompt).toBe('You are a test agent.');
    agentId = body.data.id;
  });

  it('GET /api/v1/ai/agents — lists agents', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/agents',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/ai/agents/:id — gets single agent', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/agents/${agentId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(agentId);
    expect(res.json().data.name).toBe('Test Agent');
  });

  it('PATCH /api/v1/ai/agents/:id — updates agent', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/agents/${agentId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated Agent', description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Agent');
    expect(res.json().data.description).toBe('Updated description');
  });

  it('PATCH /api/v1/ai/agents/:id — disables agent', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/agents/${agentId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'disabled' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('disabled');
  });

  it('PATCH /api/v1/ai/agents/:id — re-enables agent', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/agents/${agentId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'active' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('active');
  });

  it('DELETE /api/v1/ai/agents/:id — deletes agent', async () => {
    // Create a disposable agent
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/ai/agents',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Disposable Agent', description: 'To be deleted' },
    });
    expect(createRes.statusCode).toBe(201);
    const disposableId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/ai/agents/${disposableId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);

    // Verify it's gone
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/ai/agents/${disposableId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('GET /api/v1/ai/agents/:id — 404 for non-existent', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/agents/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/ai/agents — 400 for missing name', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/agents',
      headers: { authorization: `Bearer ${token}` },
      payload: { description: 'No name' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════
// 2. AGENT EXECUTION — ONE TOOL PER REQUEST
// ═══════════════════════════════════════════

describe('Agent Execution — Single Tool Invocation', () => {
  let agentId: string;
  let executionId: string;

  beforeAll(async () => {
    // Create agent with synced tool in allowed list
    const agentRes = await app.inject({
      method: 'POST', url: '/api/v1/ai/agents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Executor Agent',
        description: 'Agent for execution tests',
        allowed_tool_ids: [syncedToolId],
      },
    });
    expect(agentRes.statusCode).toBe(201);
    agentId = agentRes.json().data.id;
  });

  it('POST /api/v1/ai/agents/:id/execute — executes tool via K3 pipeline', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/agents/${agentId}/execute`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tool_id: syncedToolId, input: {} },
    });
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.agent_id).toBe(agentId);
    expect(body.data.tool_id).toBe(syncedToolId);
    expect(body.data.user_id).toBe(userId);
    expect(['completed', 'failed', 'rejected']).toContain(body.data.status);
    expect(body.data.duration_ms).toBeGreaterThanOrEqual(0);
    expect(body.data.executed_at).toBeDefined();
    executionId = body.data.id;
  });

  it('execution record has action_id resolved from tool binding', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/agents/executions/${executionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const exec = res.json().data;
    expect(exec.action_id).toBeDefined();
    expect(exec.action_id).not.toBe('unknown');
  });

  it('GET /api/v1/ai/agents/:id/executions — lists execution history', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/agents/${agentId}/executions`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/ai/agents/executions/:id — gets single execution', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/agents/executions/${executionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(executionId);
  });
});

// ═══════════════════════════════════════════
// 3. POLICY ENFORCEMENT
// ═══════════════════════════════════════════

describe('Agent Policy Enforcement', () => {
  let agentId: string;

  beforeAll(async () => {
    // Create agent with only ONE tool allowed
    const agentRes = await app.inject({
      method: 'POST', url: '/api/v1/ai/agents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Restricted Agent',
        description: 'Agent with limited tools',
        allowed_tool_ids: [syncedToolId],
      },
    });
    expect(agentRes.statusCode).toBe(201);
    agentId = agentRes.json().data.id;
  });

  it('rejects execution when tool is NOT in allowed list', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/agents/${agentId}/execute`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tool_id: syncedToolId2, input: {} },
    });
    const body = res.json();
    expect(body.data.status).toBe('rejected');
    expect(body.data.policy_decision).toBe('deny');
    expect(body.data.error_message).toContain('not in agent');
  });

  it('rejects execution when agent is disabled', async () => {
    // Disable the agent
    await app.inject({
      method: 'PATCH', url: `/api/v1/ai/agents/${agentId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'disabled' },
    });

    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/agents/${agentId}/execute`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tool_id: syncedToolId, input: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('disabled');

    // Re-enable
    await app.inject({
      method: 'PATCH', url: `/api/v1/ai/agents/${agentId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'active' },
    });
  });

  it('rejects execution when tool does not exist', async () => {
    // Add a fake tool ID to allowed list
    const fakeToolId = '00000000-0000-0000-0000-000000000099';
    await app.inject({
      method: 'PATCH', url: `/api/v1/ai/agents/${agentId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { allowed_tool_ids: [syncedToolId, fakeToolId] },
    });

    const res = await app.inject({
      method: 'POST', url: `/api/v1/ai/agents/${agentId}/execute`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tool_id: fakeToolId, input: {} },
    });
    const body = res.json();
    expect(body.data.status).toBe('rejected');
    expect(body.data.policy_decision).toBe('deny');
    expect(body.data.error_message).toContain('not found or disabled');
  });
});

// ═══════════════════════════════════════════
// 4. AUDIT TRAIL
// ═══════════════════════════════════════════

describe('Agent Audit Trail', () => {
  it('agent creation is logged in audit', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit?action_id=rasid.mod.ai.agent.create',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.items;
    expect(items.length).toBeGreaterThan(0);
  });

  it('agent execution is logged in audit', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit?action_id=rasid.mod.ai.agent.execute',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.items;
    expect(items.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// 5. RBAC — NO PERMISSIONS
// ═══════════════════════════════════════════

describe('Agent RBAC', () => {
  it('401 without auth token', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/agents',
    });
    expect(res.statusCode).toBe(401);
  });

  it('401 for execution without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/agents/some-id/execute',
      payload: { tool_id: 'some-tool', input: {} },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════
// 6. NO AUTONOMOUS LOOP CONFIRMATION
// ═══════════════════════════════════════════

describe('No Autonomous Loop', () => {
  it('execution returns exactly ONE result — no chaining, no recursion', async () => {
    // Create agent with synced tool
    const agentRes = await app.inject({
      method: 'POST', url: '/api/v1/ai/agents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'No Loop Agent',
        description: 'Verifies no autonomous loop',
        allowed_tool_ids: [syncedToolId],
      },
    });
    expect(agentRes.statusCode).toBe(201);
    const agentId = agentRes.json().data.id;

    // Execute
    const execRes = await app.inject({
      method: 'POST', url: `/api/v1/ai/agents/${agentId}/execute`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tool_id: syncedToolId, input: {} },
    });
    const body = execRes.json();

    // Verify single execution — not an array, not a chain
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(Array.isArray(body.data)).toBe(false);

    // Verify exactly 1 execution was recorded for this agent
    const histRes = await app.inject({
      method: 'GET', url: `/api/v1/ai/agents/${agentId}/executions`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(histRes.json().data.length).toBe(1);
  });
});

// ═══════════════════════════════════════════
// 7. K3 ACTION REGISTRATION
// ═══════════════════════════════════════════

describe('K3 Action Registration', () => {
  it('agent actions are registered in K3 registry (in-memory)', async () => {
    // Action Registry stores manifests in memory, not in DB.
    // Use the public listActions() interface to verify registration.
    const { actionRegistry } = await import('../../packages/kernel/src/index.js');
    const allActions = actionRegistry.listActions();
    const agentActions = allActions.filter(
      (a) => a.action_id.startsWith('rasid.mod.ai.agent'),
    );
    // 8 actions: create, list, get, update, delete, execute, executions.list, execution.get
    expect(agentActions.length).toBe(8);
    const ids = agentActions.map((a) => a.action_id);
    expect(ids).toContain('rasid.mod.ai.agent.create');
    expect(ids).toContain('rasid.mod.ai.agent.list');
    expect(ids).toContain('rasid.mod.ai.agent.get');
    expect(ids).toContain('rasid.mod.ai.agent.update');
    expect(ids).toContain('rasid.mod.ai.agent.delete');
    expect(ids).toContain('rasid.mod.ai.agent.execute');
    expect(ids).toContain('rasid.mod.ai.agent.executions.list');
    expect(ids).toContain('rasid.mod.ai.agent.execution.get');
  });
});

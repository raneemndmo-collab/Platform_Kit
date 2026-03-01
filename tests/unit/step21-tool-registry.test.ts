/**
 * Step 21 — M21 AI Engine Tool Registry tests (Phase 4, Step 2)
 *
 * Tool definitions, tool bindings, sync from registry.
 * All via K3 pipeline with RBAC enforcement.
 * No external LLM. No external calls.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let adminToken: string;
let viewerToken: string;
let toolDefId: string;
let bindingId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();

  // Login as admin
  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  adminToken = JSON.parse(adminLogin.body).data.token.access_token;

  // Login as viewer
  const viewerLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'viewer@acme.com', password: 'Viewer123!', tenant_slug: 'acme' },
  });
  viewerToken = JSON.parse(viewerLogin.body).data.token.access_token;
});

afterAll(async () => {
  await app?.close();
});

const auth = (token?: string) => ({
  authorization: `Bearer ${token ?? adminToken}`,
});

describe('M21 AI Engine Tool Registry (Step 2)', () => {
  // ═══════════════════════════════════════════
  // TOOL DEFINITIONS CRUD
  // ═══════════════════════════════════════════

  it('POST /api/v1/ai/tool-definitions → 201 creates a tool definition', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-definitions',
      headers: auth(),
      payload: {
        action_id: 'rasid.mod.ai.conversation.create',
        name: 'Create Conversation Tool',
        description: 'Creates a new AI conversation',
        category: 'ai',
        tags: ['ai', 'conversation'],
        examples: [
          { input: 'Create a new conversation', description: 'Basic creation' },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Create Conversation Tool');
    expect(body.data.action_id).toBe('rasid.mod.ai.conversation.create');
    expect(body.data.category).toBe('ai');
    expect(body.data.status).toBe('enabled');
    expect(body.data.tags).toContain('ai');
    expect(body.data.examples.length).toBe(1);
    expect(body.meta.audit_id).toBeDefined();
    toolDefId = body.data.id;
  });

  it('POST /api/v1/ai/tool-definitions → 400 for invalid action_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-definitions',
      headers: auth(),
      payload: {
        action_id: 'rasid.nonexistent.action',
        name: 'Invalid Tool',
        description: 'Should fail',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/ai/tool-definitions → 200 lists tool definitions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tool-definitions',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/ai/tool-definitions?category=ai → filters by category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tool-definitions?category=ai',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    for (const tool of body.data) {
      expect(tool.category).toBe('ai');
    }
  });

  it('GET /api/v1/ai/tool-definitions/:id → 200 returns tool definition', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/tool-definitions/${toolDefId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(toolDefId);
    expect(body.data.name).toBe('Create Conversation Tool');
  });

  it('GET /api/v1/ai/tool-definitions/:id → 404 for non-existent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tool-definitions/00000000-0000-0000-0000-000000000000',
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /api/v1/ai/tool-definitions/:id → 200 updates tool', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ai/tool-definitions/${toolDefId}`,
      headers: auth(),
      payload: {
        name: 'Updated Tool Name',
        description: 'Updated description',
        tags: ['ai', 'conversation', 'updated'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Updated Tool Name');
    expect(body.data.description).toBe('Updated description');
    expect(body.data.tags).toContain('updated');
  });

  it('PATCH /api/v1/ai/tool-definitions/:id → 200 disables tool', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ai/tool-definitions/${toolDefId}`,
      headers: auth(),
      payload: { status: 'disabled' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('disabled');
  });

  it('PATCH /api/v1/ai/tool-definitions/:id → re-enable tool', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ai/tool-definitions/${toolDefId}`,
      headers: auth(),
      payload: { status: 'enabled' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('enabled');
  });

  // ═══════════════════════════════════════════
  // TOOL BINDINGS
  // ═══════════════════════════════════════════

  it('POST /api/v1/ai/tool-bindings → 201 creates a binding', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-bindings',
      headers: auth(),
      payload: {
        tool_id: toolDefId,
        action_id: 'rasid.mod.ai.conversation.list',
        input_mapping: { conversation_id: '{{context.conversation_id}}' },
        output_mapping: { result: '{{data}}' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.tool_id).toBe(toolDefId);
    expect(body.data.action_id).toBe('rasid.mod.ai.conversation.list');
    expect(body.data.input_mapping).toBeDefined();
    expect(body.meta.audit_id).toBeDefined();
    bindingId = body.data.id;
  });

  it('POST /api/v1/ai/tool-bindings → 400 for invalid action', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-bindings',
      headers: auth(),
      payload: {
        tool_id: toolDefId,
        action_id: 'rasid.nonexistent.action',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/ai/tool-bindings → 404 for non-existent tool', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-bindings',
      headers: auth(),
      payload: {
        tool_id: '00000000-0000-0000-0000-000000000000',
        action_id: 'rasid.mod.ai.conversation.list',
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/ai/tool-bindings → 200 lists all bindings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tool-bindings',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/ai/tool-bindings?tool_id=X → filters by tool', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/tool-bindings?tool_id=${toolDefId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    for (const b of body.data) {
      expect(b.tool_id).toBe(toolDefId);
    }
  });

  it('DELETE /api/v1/ai/tool-bindings/:id → 200 deletes binding', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/ai/tool-bindings/${bindingId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
  });

  // ═══════════════════════════════════════════
  // DELETE TOOL DEFINITION (CASCADE) — before sync
  // ═══════════════════════════════════════════

  it('DELETE /api/v1/ai/tool-definitions/:id → 200 deletes tool (cascade)', async () => {
    // Create a tool to delete
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-definitions',
      headers: auth(),
      payload: {
        action_id: 'rasid.mod.ai.conversation.delete',
        name: 'Delete Tool Test',
        description: 'To be deleted',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const deleteToolId = JSON.parse(createRes.body).data.id;

    // Create a binding for it
    await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-bindings',
      headers: auth(),
      payload: {
        tool_id: deleteToolId,
        action_id: 'rasid.mod.ai.conversation.list',
      },
    });

    // Delete the tool (should cascade bindings)
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/ai/tool-definitions/${deleteToolId}`,
      headers: auth(),
    });
    expect(delRes.statusCode).toBe(200);

    // Verify it's gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/tool-definitions/${deleteToolId}`,
      headers: auth(),
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /api/v1/ai/tool-definitions/:id → 404 for non-existent', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/ai/tool-definitions/00000000-0000-0000-0000-000000000000',
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  // ═══════════════════════════════════════════
  // SYNC FROM REGISTRY
  // ═══════════════════════════════════════════

  it('POST /api/v1/ai/tool-registry/sync → 200 syncs from action registry', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-registry/sync',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.created).toBeGreaterThan(0);
    expect(body.meta.audit_id).toBeDefined();
  });

  it('POST /api/v1/ai/tool-registry/sync → idempotent (no new creates)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-registry/sync',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Second sync should create 0 new tools
    expect(body.data.created).toBe(0);
  });

  it('After sync, tool-definitions list includes all K3 actions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tool-definitions',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Should have many tools (all registered K3 actions)
    expect(body.data.length).toBeGreaterThan(50);
  });

  it('Synced tools have correct categories', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tool-definitions?category=analytics',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThan(0);
    for (const tool of body.data) {
      expect(tool.category).toBe('analytics');
    }
  });

  // ═══════════════════════════════════════════
  // RBAC ENFORCEMENT
  // ═══════════════════════════════════════════

  it('Viewer cannot create tool definitions (RBAC)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-definitions',
      headers: auth(viewerToken),
      payload: {
        action_id: 'rasid.mod.ai.conversation.create',
        name: 'Viewer Tool',
        description: 'Should fail',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Viewer cannot create tool bindings (RBAC)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-bindings',
      headers: auth(viewerToken),
      payload: {
        tool_id: toolDefId,
        action_id: 'rasid.mod.ai.conversation.list',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Viewer cannot sync tool registry (RBAC)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/tool-registry/sync',
      headers: auth(viewerToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('Unauthenticated request returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tool-definitions',
    });
    expect(res.statusCode).toBe(401);
  });

  // ═══════════════════════════════════════════
  // AUDIT TRAIL
  // ═══════════════════════════════════════════

  it('Tool registry actions produce audit records', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=50',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const toolActions = body.data.items.filter(
      (a: { action_id: string }) =>
        a.action_id?.startsWith('rasid.mod.ai.tool_def.') ||
        a.action_id?.startsWith('rasid.mod.ai.tool_binding.') ||
        a.action_id?.startsWith('rasid.mod.ai.tool_registry.'),
    );
    expect(toolActions.length).toBeGreaterThan(0);
  });

});

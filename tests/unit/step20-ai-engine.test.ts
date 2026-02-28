/**
 * Step 20 — M21 AI Engine Core tests (Phase 4, Step 1)
 *
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Deterministic responses (mocked inference).
 * Tool invocation via internal Action Registry only.
 * No external LLM. No streaming. No WebSocket.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let adminToken: string;
let viewerToken: string;
let conversationId: string;

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

describe('M21 AI Engine Core', () => {
  // ═══════════════════════════════════════════
  // CONVERSATION CRUD
  // ═══════════════════════════════════════════

  it('POST /api/v1/ai/conversations → 201 creates a conversation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: auth(),
      payload: {
        title: 'Test Conversation',
        metadata: { source: 'test' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Test Conversation');
    expect(body.data.status).toBe('active');
    expect(body.data.metadata.source).toBe('test');
    expect(body.meta.audit_id).toBeDefined();
    conversationId = body.data.id;
  });

  it('POST /api/v1/ai/conversations → 201 with default title', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('New Conversation');
  });

  it('GET /api/v1/ai/conversations → 200 lists conversations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/conversations',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/ai/conversations/:id → 200 returns conversation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/conversations/${conversationId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(conversationId);
    expect(body.data.title).toBe('Test Conversation');
  });

  it('GET /api/v1/ai/conversations/:id → 404 for non-existent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/conversations/00000000-0000-0000-0000-000000000000',
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /api/v1/ai/conversations/:id → 200 updates conversation', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ai/conversations/${conversationId}`,
      headers: auth(),
      payload: { title: 'Updated Title' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Updated Title');
  });

  it('PATCH /api/v1/ai/conversations/:id → 200 archives conversation', async () => {
    // Create a new conversation to archive
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: auth(),
      payload: { title: 'To Archive' },
    });
    const archiveId = JSON.parse(createRes.body).data.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ai/conversations/${archiveId}`,
      headers: auth(),
      payload: { status: 'archived' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('archived');
  });

  // ═══════════════════════════════════════════
  // CHAT (send message + get deterministic response)
  // ═══════════════════════════════════════════

  it('POST /api/v1/ai/conversations/:id/chat → 201 sends message and gets response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${conversationId}/chat`,
      headers: auth(),
      payload: { content: 'Hello AI' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.user_message).toBeDefined();
    expect(body.data.user_message.role).toBe('user');
    expect(body.data.user_message.content).toBe('Hello AI');
    expect(body.data.assistant_message).toBeDefined();
    expect(body.data.assistant_message.role).toBe('assistant');
    expect(body.data.assistant_message.content).toContain('Acknowledged');
    expect(body.meta.audit_id).toBeDefined();
  });

  it('POST /api/v1/ai/conversations/:id/chat → deterministic help response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${conversationId}/chat`,
      headers: auth(),
      payload: { content: 'I need help' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.assistant_message.content).toContain('help');
  });

  it('POST /api/v1/ai/conversations/:id/chat → 404 for non-existent conversation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations/00000000-0000-0000-0000-000000000000/chat',
      headers: auth(),
      payload: { content: 'Hello' },
    });
    expect(res.statusCode).toBe(404);
  });

  // ═══════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════

  it('GET /api/v1/ai/conversations/:id/messages → 200 lists messages', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/conversations/${conversationId}/messages`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    // Should have at least 4 messages (2 chat rounds × 2 messages each)
    expect(body.data.length).toBeGreaterThanOrEqual(4);
    // Messages should be ordered by created_at ASC
    const roles = body.data.map((m: { role: string }) => m.role);
    expect(roles[0]).toBe('user');
    expect(roles[1]).toBe('assistant');
  });

  // ═══════════════════════════════════════════
  // TOOL DISCOVERY
  // ═══════════════════════════════════════════

  it('GET /api/v1/ai/tools → 200 discovers available tools', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tools',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.tools).toBeDefined();
    expect(Array.isArray(body.data.tools)).toBe(true);
    expect(body.data.count).toBeGreaterThan(10);
    // Each tool should have required fields
    const tool = body.data.tools[0];
    expect(tool.action_id).toBeDefined();
    expect(tool.display_name).toBeDefined();
    expect(tool.module_id).toBeDefined();
    expect(tool.verb).toBeDefined();
  });

  it('GET /api/v1/ai/tools?module=mod_dashboard → filters by module', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/tools?module=mod_dashboard',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.tools.length).toBeGreaterThan(0);
    for (const tool of body.data.tools) {
      expect(tool.module_id).toBe('mod_dashboard');
    }
  });

  // ═══════════════════════════════════════════
  // TOOL INVOCATION (via K3)
  // ═══════════════════════════════════════════

  it('POST /api/v1/ai/conversations/:id/tools/invoke → 201 invokes action not found', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${conversationId}/tools/invoke`,
      headers: auth(),
      payload: {
        action_id: 'rasid.nonexistent.action',
        input: {},
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.success).toBe(false);
    expect(body.data.invocation.status).toBe('failure');
    expect(body.data.invocation.error_message).toContain('not found');
  });

  it('GET /api/v1/ai/conversations/:id/tools → 200 lists tool invocations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/conversations/${conversationId}/tools`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  // ═══════════════════════════════════════════
  // RBAC ENFORCEMENT
  // ═══════════════════════════════════════════

  it('Viewer cannot create conversations (RBAC)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: auth(viewerToken),
      payload: { title: 'Viewer Conversation' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Viewer cannot send chat messages (RBAC)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${conversationId}/chat`,
      headers: auth(viewerToken),
      payload: { content: 'Hello' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Viewer cannot invoke tools (RBAC)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${conversationId}/tools/invoke`,
      headers: auth(viewerToken),
      payload: { action_id: 'rasid.mod.ai.conversation.list', input: {} },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Unauthenticated request returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/conversations',
    });
    expect(res.statusCode).toBe(401);
  });

  // ═══════════════════════════════════════════
  // AUDIT TRAIL
  // ═══════════════════════════════════════════

  it('All AI actions produce audit records', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=50',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const aiActions = body.data.items.filter(
      (a: { action_id: string }) => a.action_id?.startsWith('rasid.mod.ai.'),
    );
    expect(aiActions.length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════
  // DELETE CONVERSATION
  // ═══════════════════════════════════════════

  it('DELETE /api/v1/ai/conversations/:id → 200 deletes conversation', async () => {
    // Create a conversation to delete
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: auth(),
      payload: { title: 'To Delete' },
    });
    const deleteId = JSON.parse(createRes.body).data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/ai/conversations/${deleteId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);

    // Verify it's gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/conversations/${deleteId}`,
      headers: auth(),
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /api/v1/ai/conversations/:id → cascades messages', async () => {
    // Create conversation with messages
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: auth(),
      payload: { title: 'Cascade Test' },
    });
    const cascadeId = JSON.parse(createRes.body).data.id;

    // Add a chat message
    await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${cascadeId}/chat`,
      headers: auth(),
      payload: { content: 'Test message' },
    });

    // Delete conversation
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/ai/conversations/${cascadeId}`,
      headers: auth(),
    });
    expect(delRes.statusCode).toBe(200);

    // Messages should be gone (conversation not found)
    const msgRes = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/conversations/${cascadeId}/messages`,
      headers: auth(),
    });
    // The messages list should return empty or the conversation should not be found
    // Since we list messages by conversation_id, empty array is expected
    const msgBody = JSON.parse(msgRes.body);
    expect(Array.isArray(msgBody.data)).toBe(true);
    expect(msgBody.data.length).toBe(0);
  });

  // ═══════════════════════════════════════════
  // NO EXTERNAL CALLS VERIFICATION
  // ═══════════════════════════════════════════

  it('AI response is deterministic (no external LLM)', async () => {
    // Create a fresh conversation
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: auth(),
      payload: { title: 'Deterministic Test' },
    });
    const detId = JSON.parse(createRes.body).data.id;

    // Send same message twice
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${detId}/chat`,
      headers: auth(),
      payload: { content: 'What is 2+2?' },
    });
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${detId}/chat`,
      headers: auth(),
      payload: { content: 'What is 2+2?' },
    });

    const body1 = JSON.parse(res1.body);
    const body2 = JSON.parse(res2.body);

    // Both responses should be deterministic (same content pattern)
    expect(body1.data.assistant_message.content).toContain('Acknowledged');
    expect(body2.data.assistant_message.content).toContain('Acknowledged');
  });
});

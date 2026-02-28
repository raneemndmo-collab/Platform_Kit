import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let accessToken: string;
let userId: string;
let tenantId: string;

// Tenant B for isolation tests
let tenantBToken: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();

  // Login as seeded admin
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(loginRes.statusCode).toBe(200);
  accessToken = loginRes.json().data.token.access_token;

  // Get userId and tenantId from users list
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/v1/users',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(meRes.statusCode).toBe(200);
  const adminUser = meRes.json().data.items.find((u: { email: string }) => u.email === 'admin@acme.com');
  userId = adminUser.id;
  tenantId = adminUser.tenant_id;

  // Create Tenant B user for isolation tests
  const regBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'user@beta.com', password: 'Beta123!', display_name: 'Beta User', tenant_slug: 'beta' },
  });
  expect(regBRes.statusCode).toBe(201);

  const loginBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'user@beta.com', password: 'Beta123!', tenant_slug: 'beta' },
  });
  expect(loginBRes.statusCode).toBe(200);
  tenantBToken = loginBRes.json().data.token.access_token;
}, 30000);

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════════
// ─── Channel CRUD ───
// ═══════════════════════════════════════════════

describe('K10 Notification Router — Channels', () => {
  let channelId: string;

  it('POST /api/v1/notifications/channels — creates email channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/channels',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Primary Email', channel_type: 'email', config: { smtp_host: 'smtp.acme.com' }, enabled: true },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Primary Email');
    expect(body.data.channel_type).toBe('email');
    expect(body.data.config.smtp_host).toBe('smtp.acme.com');
    expect(body.data.enabled).toBe(true);
    expect(body.data.created_by).toBe(userId);
    channelId = body.data.id;
  });

  it('POST /api/v1/notifications/channels — creates in_app channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/channels',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'In-App Alerts', channel_type: 'in_app' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.channel_type).toBe('in_app');
  });

  it('POST /api/v1/notifications/channels — duplicate name returns 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/channels',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Primary Email', channel_type: 'email' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('POST /api/v1/notifications/channels — validation error on invalid type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/channels',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'SMS Channel', channel_type: 'sms' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/notifications/channels — lists all channels', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/channels',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/notifications/channels?channel_type=email — filters by type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/channels?channel_type=email',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    for (const ch of res.json().data) {
      expect(ch.channel_type).toBe('email');
    }
  });

  it('GET /api/v1/notifications/channels/:id — returns specific channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications/channels/${channelId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(channelId);
  });

  it('PATCH /api/v1/notifications/channels/:id — updates channel', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/channels/${channelId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Updated Email', enabled: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Email');
    expect(res.json().data.enabled).toBe(false);
  });

  it('DELETE /api/v1/notifications/channels/:id — deletes channel', async () => {
    // Create a throwaway channel to delete
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/channels',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'To Delete Channel', channel_type: 'email' },
    });
    expect(createRes.statusCode).toBe(201);
    const delId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notifications/channels/${delId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify deleted
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications/channels/${delId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('Tenant B cannot see Tenant A channels', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/channels',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// ─── Template CRUD ───
// ═══════════════════════════════════════════════

describe('K10 Notification Router — Templates', () => {
  let templateId: string;

  it('POST /api/v1/notifications/templates — creates template', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/templates',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Welcome Email',
        channel_type: 'email',
        subject: 'Welcome {{user_name}}!',
        body: 'Hello {{user_name}}, welcome to {{tenant_name}}.',
        variables: ['user_name', 'tenant_name'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Welcome Email');
    expect(body.data.status).toBe('draft');
    expect(body.data.variables).toEqual(['user_name', 'tenant_name']);
    templateId = body.data.id;
  });

  it('POST /api/v1/notifications/templates — duplicate name returns 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/templates',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Welcome Email', channel_type: 'email', subject: 'Dup', body: 'Dup' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('GET /api/v1/notifications/templates — lists templates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/templates',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/notifications/templates/:id — returns template', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications/templates/${templateId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(templateId);
  });

  it('PATCH /api/v1/notifications/templates/:id — updates template status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/templates/${templateId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'active', subject: 'Welcome {{user_name}} to Rasid!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('active');
    expect(res.json().data.subject).toBe('Welcome {{user_name}} to Rasid!');
  });

  it('DELETE /api/v1/notifications/templates/:id — deletes template', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/templates',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'To Delete Template', channel_type: 'in_app', subject: 'Del', body: 'Del' },
    });
    expect(createRes.statusCode).toBe(201);
    const delId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notifications/templates/${delId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it('Tenant B cannot see Tenant A templates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/templates',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// ─── Notification Send & Status ───
// ═══════════════════════════════════════════════

describe('K10 Notification Router — Notifications', () => {
  let notificationId: string;

  it('POST /api/v1/notifications/send — sends notification', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/send',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        channel_type: 'email',
        recipient_id: userId,
        subject: 'Test Notification',
        body: 'This is a test notification.',
        metadata: { priority: 'high' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.status).toBe('pending');
    expect(body.data.channel_type).toBe('email');
    expect(body.data.recipient_id).toBe(userId);
    expect(body.data.metadata.priority).toBe('high');
    notificationId = body.data.id;
  });

  it('POST /api/v1/notifications/send — invalid recipient returns 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/send',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        channel_type: 'email',
        recipient_id: '00000000-0000-0000-0000-000000000000',
        subject: 'Test',
        body: 'Test',
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/notifications — lists notifications', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/notifications?recipient_id=... — filters by recipient', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications?recipient_id=${userId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    for (const n of res.json().data) {
      expect(n.recipient_id).toBe(userId);
    }
  });

  it('GET /api/v1/notifications/:id — returns notification', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications/${notificationId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(notificationId);
  });

  it('PATCH /api/v1/notifications/:id/status — marks as delivered', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notificationId}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'delivered' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('delivered');
    expect(res.json().data.sent_at).toBeTruthy();
  });

  it('PATCH /api/v1/notifications/:id/status — marks as failed', async () => {
    // Create another notification to mark as failed
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/send',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { channel_type: 'in_app', recipient_id: userId, subject: 'Fail Test', body: 'Will fail' },
    });
    expect(sendRes.statusCode).toBe(201);
    const failId = sendRes.json().data.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${failId}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'failed' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('failed');
  });

  it('Tenant B cannot see Tenant A notifications', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// ─── Preferences ───
// ═══════════════════════════════════════════════

describe('K10 Notification Router — Preferences', () => {
  it('PUT /api/v1/notifications/preferences — creates preference', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { channel_type: 'email', enabled: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.channel_type).toBe('email');
    expect(res.json().data.enabled).toBe(true);
    expect(res.json().data.user_id).toBe(userId);
  });

  it('PUT /api/v1/notifications/preferences — upserts (updates existing)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { channel_type: 'email', enabled: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.channel_type).toBe('email');
    expect(res.json().data.enabled).toBe(false);
  });

  it('PUT /api/v1/notifications/preferences — creates in_app preference', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { channel_type: 'in_app', enabled: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.channel_type).toBe('in_app');
  });

  it('GET /api/v1/notifications/preferences — lists user preferences', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(2);
    const types = res.json().data.map((p: { channel_type: string }) => p.channel_type);
    expect(types).toContain('email');
    expect(types).toContain('in_app');
  });

  it('Tenant B preferences are isolated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// ─── Auth Guard ───
// ═══════════════════════════════════════════════

describe('K10 Notification Router — Auth', () => {
  it('GET /api/v1/notifications — no auth returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/notifications/channels — no auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/channels',
      payload: { name: 'X', channel_type: 'email' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/notifications/preferences — no auth returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications/preferences' });
    expect(res.statusCode).toBe(401);
  });
});

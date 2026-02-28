import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { eventBus } from '../../packages/kernel/src/event-bus/event-bus.service.js';
import { v7 as uuidv7 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import type { PlatformEvent } from '../../packages/kernel/src/event-bus/event-bus.types.js';

let app: FastifyInstance;
let tenantId: string;
let adminToken: string;
let adminUserId: string;
let viewerToken: string;
let viewerUserId: string;

beforeAll(async () => {
  // Clean all tables
  await adminSql`DELETE FROM kernel.design_components`;
  await adminSql`DELETE FROM kernel.design_themes`;
  await adminSql`DELETE FROM kernel.design_tokens`;
  await adminSql`DELETE FROM kernel.metrics`;
  await adminSql`DELETE FROM kernel.dataset_fields`;
  await adminSql`DELETE FROM kernel.datasets`;
  await adminSql`DELETE FROM kernel.lineage_edges`;
  await adminSql`DELETE FROM kernel.user_roles`;
  await adminSql`DELETE FROM kernel.role_permissions`;
  await adminSql`DELETE FROM kernel.audit_log`;
  await adminSql`DELETE FROM kernel.objects`;
  await adminSql`DELETE FROM kernel.object_types`;
  await adminSql`DELETE FROM kernel.users`;
  await adminSql`DELETE FROM kernel.roles`;
  await adminSql`DELETE FROM kernel.permissions`;
  await adminSql`DELETE FROM kernel.action_manifests`;
  await adminSql`DELETE FROM kernel.tenants`;

  // Create tenant
  tenantId = uuidv7();
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${tenantId}, 'Acme', 'acme')`;

  // Create permissions (15)
  const perms = [
    ['users', 'create'], ['users', 'read'], ['users', 'update'], ['users', 'delete'],
    ['roles', 'create'], ['roles', 'read'], ['roles', 'update'], ['roles', 'delete'], ['roles', 'assign'],
    ['permissions', 'assign'],
    ['objects', 'create'], ['objects', 'read'], ['objects', 'update'], ['objects', 'delete'],
    ['audit', 'read'],
  ];
  const permIds: Record<string, string> = {};
  for (const [resource, action] of perms) {
    const id = uuidv7();
    permIds[`${resource}.${action}`] = id;
    await adminSql`INSERT INTO kernel.permissions (id, resource, action) VALUES (${id}, ${resource}, ${action})`;
  }

  // Create roles
  const superAdminId = uuidv7();
  const viewerRoleId = uuidv7();
  await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${superAdminId}, ${tenantId}, 'super_admin', true)`;
  await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${viewerRoleId}, ${tenantId}, 'viewer', true)`;

  // Assign all 15 perms to super_admin
  for (const [, permId] of Object.entries(permIds)) {
    await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${superAdminId}, ${permId}, ${tenantId})`;
  }

  // Assign viewer perms: users.read, objects.read, audit.read
  for (const perm of ['users.read', 'objects.read', 'audit.read']) {
    await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${viewerRoleId}, ${permIds[perm]}, ${tenantId})`;
  }

  // Register test object type
  await adminSql`
    INSERT INTO kernel.object_types (name, display_name, module_id, json_schema)
    VALUES ('rasid.core.test', 'Test Object', 'kernel', ${JSON.stringify({
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' }, value: { type: 'number' } },
    })})
    ON CONFLICT (name) DO NOTHING
  `;

  // Build server
  app = await buildServer();
  await app.ready();

  // Register admin user
  const regRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/register',
    payload: { email: 'admin@acme.com', password: 'Admin123!', display_name: 'Admin', tenant_slug: 'acme' },
  });
  adminUserId = regRes.json().data.user.id;

  // Assign super_admin role
  await adminSql`INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by) VALUES (${adminUserId}, ${superAdminId}, ${tenantId}, ${adminUserId}) ON CONFLICT DO NOTHING`;

  // Login admin
  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  adminToken = loginRes.json().data.token.access_token;

  // Register viewer user
  const viewerReg = await app.inject({
    method: 'POST', url: '/api/v1/auth/register',
    payload: { email: 'viewer@acme.com', password: 'Viewer123!', display_name: 'Viewer', tenant_slug: 'acme' },
  });
  viewerUserId = viewerReg.json().data.user.id;

  // viewer already gets viewer role from register flow, but ensure it
  await adminSql`INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by) VALUES (${viewerUserId}, ${viewerRoleId}, ${tenantId}, ${adminUserId}) ON CONFLICT DO NOTHING`;

  // Login viewer
  const viewerLogin = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'viewer@acme.com', password: 'Viewer123!', tenant_slug: 'acme' },
  });
  viewerToken = viewerLogin.json().data.token.access_token;
});

afterAll(async () => {
  eventBus.clear();
  await app.close();
});

describe('K5 Event Bus', () => {
  it('publish + subscribe — exact match', () => {
    const events: PlatformEvent[] = [];
    const unsub = eventBus.subscribe('test.event', (e) => events.push(e));

    eventBus.publish({
      event_id: uuidv7(), event_type: 'test.event',
      timestamp: new Date().toISOString(), tenant_id: tenantId,
      actor_id: adminUserId, actor_type: 'user',
      object_id: null, object_type: null, action_id: 'test',
      payload: { before: null, after: null },
      metadata: { ip_address: null, session_id: null, correlation_id: uuidv7(), request_id: uuidv7() },
    });

    expect(events.length).toBe(1);
    unsub();
  });

  it('unsubscribe stops delivery', () => {
    const events: PlatformEvent[] = [];
    const unsub = eventBus.subscribe('test.unsub', (e) => events.push(e));
    unsub();

    eventBus.publish({
      event_id: uuidv7(), event_type: 'test.unsub',
      timestamp: new Date().toISOString(), tenant_id: tenantId,
      actor_id: adminUserId, actor_type: 'user',
      object_id: null, object_type: null, action_id: 'test',
      payload: { before: null, after: null },
      metadata: { ip_address: null, session_id: null, correlation_id: uuidv7(), request_id: uuidv7() },
    });

    expect(events.length).toBe(0);
  });

  it('handler error does not break other handlers', () => {
    const events: PlatformEvent[] = [];
    eventBus.subscribe('test.error', () => { throw new Error('boom'); });
    eventBus.subscribe('test.error', (e) => events.push(e));

    eventBus.publish({
      event_id: uuidv7(), event_type: 'test.error',
      timestamp: new Date().toISOString(), tenant_id: tenantId,
      actor_id: adminUserId, actor_type: 'user',
      object_id: null, object_type: null, action_id: 'test',
      payload: { before: null, after: null },
      metadata: { ip_address: null, session_id: null, correlation_id: uuidv7(), request_id: uuidv7() },
    });

    expect(events.length).toBe(1);
  });

  it('non-matching event type not delivered (OPT-5)', () => {
    const events: PlatformEvent[] = [];
    eventBus.subscribe('test.specific', (e) => events.push(e));

    eventBus.publish({
      event_id: uuidv7(), event_type: 'test.other',
      timestamp: new Date().toISOString(), tenant_id: tenantId,
      actor_id: adminUserId, actor_type: 'user',
      object_id: null, object_type: null, action_id: 'test',
      payload: { before: null, after: null },
      metadata: { ip_address: null, session_id: null, correlation_id: uuidv7(), request_id: uuidv7() },
    });

    expect(events.length).toBe(0);
  });
});

describe('K3 Pipeline — Admin (all permissions)', () => {
  let objectId: string;

  it('CREATE via pipeline — 201, audit + event emitted', async () => {
    const events: PlatformEvent[] = [];
    const unsub = eventBus.subscribe('rasid.core.object.created', (e) => events.push(e));

    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Pipeline Test', value: 1 } },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.meta.action_id).toBe('rasid.core.object.create');
    expect(body.meta.audit_id).toBeTruthy();
    expect(body.data.state).toBe('draft');
    objectId = body.data.id;

    // Event emitted
    expect(events.length).toBe(1);
    expect(events[0].object_id).toBe(objectId);
    unsub();
  });

  it('UPDATE via pipeline — version incremented, audit has before/after', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/objects/${objectId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { data: { name: 'Updated', value: 2 } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.version).toBe(2);
    expect(res.json().meta.audit_id).toBeTruthy();

    // Verify audit has before/after
    const auditRes = await app.inject({
      method: 'GET', url: `/api/v1/audit/object/${objectId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const records = auditRes.json().data.items;
    const updateAudit = records.find((r: { action_id: string }) => r.action_id === 'rasid.core.object.update');
    expect(updateAudit).toBeTruthy();
    expect(updateAudit.payload_before).toBeTruthy();
    expect(updateAudit.payload_after).toBeTruthy();
  });

  it('TRANSITION via pipeline — draft → active, event emitted', async () => {
    const events: PlatformEvent[] = [];
    const unsub = eventBus.subscribe('rasid.core.object.state_changed', (e) => events.push(e));

    const res = await app.inject({
      method: 'POST', url: `/api/v1/objects/${objectId}/transition`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { state: 'active' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.state).toBe('active');
    expect(events.length).toBe(1);
    unsub();
  });

  it('DELETE via pipeline — soft-delete, audit recorded', async () => {
    // Create a new object to delete
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'To Delete' } },
    });
    const delId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/objects/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify audit
    const auditRes = await app.inject({
      method: 'GET', url: `/api/v1/audit/object/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const deleteAudit = auditRes.json().data.items.find(
      (r: { action_id: string }) => r.action_id === 'rasid.core.object.delete',
    );
    expect(deleteAudit).toBeTruthy();
    expect(deleteAudit.status).toBe('success');
  });
});

describe('K4 Policy Engine — Viewer denied mutations', () => {
  it('CREATE as viewer → 403, audit with failure, policy.denied event', async () => {
    const events: PlatformEvent[] = [];
    const unsub = eventBus.subscribe('rasid.core.policy.denied', (e) => events.push(e));

    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Denied' } },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('PERMISSION_DENIED');

    // Policy denied event emitted
    expect(events.length).toBe(1);
    unsub();

    // Audit with failure recorded
    const auditRes = await app.inject({
      method: 'GET', url: '/api/v1/audit?status=failure',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const failureAudits = auditRes.json().data.items.filter(
      (r: { actor_id: string; action_id: string }) =>
        r.actor_id === viewerUserId && r.action_id === 'rasid.core.object.create',
    );
    expect(failureAudits.length).toBeGreaterThanOrEqual(1);
  });

  it('UPDATE as viewer → 403', async () => {
    // Create an object as admin first
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Admin Object' } },
    });
    const objId = createRes.json().data.id;

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/objects/${objId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { data: { name: 'Hacked' } },
    });
    expect(res.statusCode).toBe(403);
  });

  it('DELETE as viewer → 403', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Protected' } },
    });
    const objId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/objects/${objId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('READ as viewer → 200 (objects.read allowed)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('K6 Audit Engine — Search', () => {
  it('GET /api/v1/audit — returns audit records', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/audit?status=success — filters by status', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit?status=success',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    for (const item of res.json().data.items) {
      expect(item.status).toBe('success');
    }
  });

  it('GET /api/v1/audit?status=failure — filters failures', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit?status=failure',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    for (const item of res.json().data.items) {
      expect(item.status).toBe('failure');
    }
  });

  it('GET /api/v1/audit — no auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('K3 Pipeline — Tenant Isolation', () => {
  it('Tenant B admin cannot see Tenant A objects', async () => {
    // Create tenant B
    const tenantBId = uuidv7();
    await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${tenantBId}, 'Beta', 'beta')`;
    const viewerRoleId = uuidv7();
    await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${viewerRoleId}, ${tenantBId}, 'viewer', true)`;

    // Register Beta user
    const regRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'admin@beta.com', password: 'Admin123!', display_name: 'Beta Admin', tenant_slug: 'beta' },
    });
    expect(regRes.statusCode).toBe(201);

    // Login Beta
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
    });
    const betaToken = loginRes.json().data.token.access_token;

    // List objects — should see zero
    const res = await app.inject({
      method: 'GET', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBe(0);
  });
});

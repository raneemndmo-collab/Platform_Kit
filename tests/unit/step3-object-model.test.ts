import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { v7 as uuidv7 } from 'uuid';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let tenantId: string;
let accessToken: string;
let userId: string;

beforeAll(async () => {
  // Clean all tables
  await adminSql`DELETE FROM mod_ai.guardrail_evaluations`;
  await adminSql`DELETE FROM mod_ai.guardrail_rules`;
  await adminSql`DELETE FROM mod_ai.memory_entries`;
  await adminSql`DELETE FROM mod_ai.memory_sessions`;
  await adminSql`DELETE FROM mod_ai.rag_retrieval_logs`;
  await adminSql`DELETE FROM mod_ai.rag_sources`;
  await adminSql`DELETE FROM mod_ai.agent_executions`;
  await adminSql`DELETE FROM mod_ai.agent_definitions`;
  await adminSql`DELETE FROM mod_ai.tool_bindings`;
  await adminSql`DELETE FROM mod_ai.tool_definitions`;
  await adminSql`DELETE FROM mod_ai.tool_invocations`;
  await adminSql`DELETE FROM mod_ai.messages`;
  await adminSql`DELETE FROM mod_ai.conversations`;
  await adminSql`DELETE FROM mod_forms.submissions`;
  await adminSql`DELETE FROM mod_forms.forms`;
  await adminSql`DELETE FROM mod_presentations.presentations`;
  await adminSql`DELETE FROM mod_custom_pages.pages`;
  await adminSql`DELETE FROM mod_reports.report_runs`;
  await adminSql`DELETE FROM mod_reports.report_definitions`;
  await adminSql`DELETE FROM mod_file_manager.files`;
  await adminSql`DELETE FROM mod_file_manager.folders`;
  await adminSql`DELETE FROM mod_dashboard.shared_dashboards`;
  await adminSql`DELETE FROM mod_dashboard.widgets`;
  await adminSql`DELETE FROM mod_dashboard.dashboards`;
  await adminSql`DELETE FROM mod_search.search_analytics`;
  await adminSql`DELETE FROM mod_search.search_synonyms`;
  await adminSql`DELETE FROM mod_search.search_index`;
  await adminSql`DELETE FROM mod_semantic.kpi_versions`;
  await adminSql`DELETE FROM mod_semantic.relationships`;
  await adminSql`DELETE FROM mod_semantic.facts`;
  await adminSql`DELETE FROM mod_semantic.dimensions`;
  await adminSql`DELETE FROM mod_semantic.kpis`;
  await adminSql`DELETE FROM mod_semantic.models`;
  await adminSql`DELETE FROM mod_sheetforge.gap_analyses`;
  await adminSql`DELETE FROM mod_sheetforge.compositions`;
  await adminSql`DELETE FROM mod_sheetforge.sheets`;
  await adminSql`DELETE FROM mod_sheetforge.libraries`;
  await adminSql`DELETE FROM mod_connectors.custom_table_rows`;
  await adminSql`DELETE FROM mod_connectors.custom_tables`;
  await adminSql`DELETE FROM kernel.notification_preferences`;
  await adminSql`DELETE FROM kernel.notifications`;
  await adminSql`DELETE FROM kernel.notification_templates`;
  await adminSql`DELETE FROM kernel.notification_channels`;
  await adminSql`DELETE FROM kernel.design_components`;
  await adminSql`DELETE FROM kernel.design_themes`;
  await adminSql`DELETE FROM kernel.design_tokens`;
  await adminSql`DELETE FROM kernel.lineage_edges`;
  await adminSql`DELETE FROM kernel.metrics`;
  await adminSql`DELETE FROM kernel.dataset_fields`;
  await adminSql`DELETE FROM kernel.datasets`;
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

  // Create permissions
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

  // Create system roles
  const superAdminId = uuidv7();
  await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${superAdminId}, ${tenantId}, 'super_admin', true)`;
  for (const name of ['admin', 'editor', 'viewer']) {
    const id = uuidv7();
    await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${id}, ${tenantId}, ${name}, true)`;
  }

  // Assign ALL permissions to super_admin
  for (const [, permId] of Object.entries(permIds)) {
    await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${superAdminId}, ${permId}, ${tenantId})`;
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

  // Register user
  const regRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/register',
    payload: { email: 'admin@acme.com', password: 'Admin123!', display_name: 'Admin', tenant_slug: 'acme' },
  });
  expect(regRes.statusCode).toBe(201);
  userId = regRes.json().data.user.id;

  // Assign super_admin role
  await adminSql`
    INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by)
    VALUES (${userId}, ${superAdminId}, ${tenantId}, ${userId})
    ON CONFLICT DO NOTHING
  `;

  // Login
  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(loginRes.statusCode).toBe(200);
  accessToken = loginRes.json().data.token.access_token;
});

afterAll(async () => {
  await app.close();
});

describe('K2 Object Model — CRUD', () => {
  let objectId: string;

  it('POST /api/v1/objects — creates object in draft state', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Test Object', value: 42 } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.state).toBe('draft');
    expect(body.data.version).toBe(1);
    expect(body.data.type).toBe('rasid.core.test');
    expect(body.data.data.name).toBe('Test Object');
    expect(body.data.created_by).toBe(userId);
    objectId = body.data.id;
  });

  it('GET /api/v1/objects/:id — returns the object', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/objects/${objectId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(objectId);
  });

  it('PATCH /api/v1/objects/:id — updates data and increments version', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/objects/${objectId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { data: { name: 'Updated Object', value: 99 } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.version).toBe(2);
    expect(body.data.data.name).toBe('Updated Object');
    expect(body.data.updated_by).toBe(userId);
  });

  it('GET /api/v1/objects — lists objects', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/objects?type=rasid.core.test — filters by type', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/objects?type=rasid.core.test',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    for (const item of res.json().data.items) {
      expect(item.type).toBe('rasid.core.test');
    }
  });

  it('GET /api/v1/objects?state=draft — filters by state', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/objects?state=draft',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    for (const item of res.json().data.items) {
      expect(item.state).toBe('draft');
    }
  });

  it('DELETE /api/v1/objects/:id — soft-deletes object', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'To Delete' } },
    });
    expect(createRes.statusCode).toBe(201);
    const delId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/objects/${delId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify it's gone from GET
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/objects/${delId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('POST /api/v1/objects — unregistered type returns 404', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'nonexistent.type', data: { name: 'x' } },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/objects — missing required field returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'rasid.core.test', data: { value: 1 } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/objects — no auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/objects',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('K2 Object Model — Lifecycle Transitions', () => {
  let objectId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Lifecycle Test' } },
    });
    expect(res.statusCode).toBe(201);
    objectId = res.json().data.id;
  });

  it('draft → active', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/objects/${objectId}/transition`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { state: 'active' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.state).toBe('active');
  });

  it('active → archived', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/objects/${objectId}/transition`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { state: 'archived' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.state).toBe('archived');
  });

  it('archived → active (restore)', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/objects/${objectId}/transition`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { state: 'active' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.state).toBe('active');
  });

  it('active → deleted', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/objects/${objectId}/transition`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { state: 'deleted' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.state).toBe('deleted');
  });

  it('deleted → active is INVALID', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Delete Test' } },
    });
    expect(createRes.statusCode).toBe(201);
    const id = createRes.json().data.id;

    await app.inject({
      method: 'POST', url: `/api/v1/objects/${id}/transition`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { state: 'deleted' },
    });

    const res = await app.inject({
      method: 'POST', url: `/api/v1/objects/${id}/transition`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { state: 'active' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('draft → archived is INVALID', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Invalid Transition' } },
    });
    expect(createRes.statusCode).toBe(201);
    const id = createRes.json().data.id;

    const res = await app.inject({
      method: 'POST', url: `/api/v1/objects/${id}/transition`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { state: 'archived' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_STATE_TRANSITION');
  });
});

describe('K2 Object Model — Tenant Isolation', () => {
  it('Tenant B cannot see Tenant A objects', async () => {
    const tenantBId = uuidv7();
    await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${tenantBId}, 'Beta', 'beta')`;
    const viewerRoleId = uuidv7();
    await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${viewerRoleId}, ${tenantBId}, 'viewer', true)`;

    const regRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'user@beta.com', password: 'User123!', display_name: 'Beta User', tenant_slug: 'beta' },
    });
    expect(regRes.statusCode).toBe(201);

    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'user@beta.com', password: 'User123!', tenant_slug: 'beta' },
    });
    const betaToken = loginRes.json().data.token.access_token;

    const res = await app.inject({
      method: 'GET', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBe(0);
  });
});

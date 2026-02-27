import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { v7 as uuidv7 } from 'uuid';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let acmeTenantId: string;
let betaTenantId: string;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();

  // Clean up previous test data
  await adminSql`DELETE FROM kernel.user_roles`;
  await adminSql`DELETE FROM kernel.role_permissions`;
  await adminSql`DELETE FROM kernel.audit_log`;
  await adminSql`DELETE FROM kernel.objects`;
  await adminSql`DELETE FROM kernel.users`;
  await adminSql`DELETE FROM kernel.roles`;
  await adminSql`DELETE FROM kernel.permissions`;
  await adminSql`DELETE FROM kernel.tenants`;

  // Seed tenants
  acmeTenantId = uuidv7();
  betaTenantId = uuidv7();
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${acmeTenantId}, 'Acme Corporation', 'acme')`;
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${betaTenantId}, 'Beta Industries', 'beta')`;

  // Seed permissions (15)
  const perms = [
    ['users', 'create'], ['users', 'read'], ['users', 'update'], ['users', 'delete'],
    ['roles', 'create'], ['roles', 'read'], ['roles', 'update'], ['roles', 'delete'], ['roles', 'assign'],
    ['permissions', 'assign'],
    ['objects', 'create'], ['objects', 'read'], ['objects', 'update'], ['objects', 'delete'],
    ['audit', 'read'],
  ];
  for (const [resource, action] of perms) {
    await adminSql`INSERT INTO kernel.permissions (id, resource, action) VALUES (${uuidv7()}, ${resource}, ${action})`;
  }

  // Seed roles for each tenant
  for (const tenantId of [acmeTenantId, betaTenantId]) {
    const allPerms = await adminSql`SELECT id, resource, action FROM kernel.permissions`;

    // super_admin — all 15
    const saId = uuidv7();
    await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${saId}, ${tenantId}, 'super_admin', true)`;
    for (const p of allPerms) {
      await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${saId}, ${p.id}, ${tenantId})`;
    }

    // admin — all except permissions.assign
    const admId = uuidv7();
    await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${admId}, ${tenantId}, 'admin', true)`;
    for (const p of allPerms) {
      if (p.resource === 'permissions' && p.action === 'assign') continue;
      await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${admId}, ${p.id}, ${tenantId})`;
    }

    // editor
    const edId = uuidv7();
    await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${edId}, ${tenantId}, 'editor', true)`;
    const editorPerms = ['users.read', 'objects.create', 'objects.read', 'objects.update', 'objects.delete', 'audit.read'];
    for (const p of allPerms) {
      if (editorPerms.includes(`${p.resource}.${p.action}`)) {
        await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${edId}, ${p.id}, ${tenantId})`;
      }
    }

    // viewer
    const vwId = uuidv7();
    await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${vwId}, ${tenantId}, 'viewer', true)`;
    const viewerPerms = ['users.read', 'objects.read', 'audit.read'];
    for (const p of allPerms) {
      if (viewerPerms.includes(`${p.resource}.${p.action}`)) {
        await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${vwId}, ${p.id}, ${tenantId})`;
      }
    }
  }
}, 30000);

afterAll(async () => {
  await app.close();
});

describe('K1 IAM — Auth Endpoints', () => {
  it('POST /api/v1/auth/register — creates user with viewer role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@acme.com',
        password: 'TestPass123!',
        display_name: 'Test User',
        tenant_slug: 'acme',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.user.email).toBe('test@acme.com');
    expect(body.data.user.tenant_id).toBe(acmeTenantId);
    expect(body.data.token.access_token).toBeTruthy();
    expect(body.data.token.refresh_token).toBeTruthy();
    expect(body.meta.request_id).toBeTruthy();
  });

  it('POST /api/v1/auth/register — duplicate email returns 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@acme.com',
        password: 'TestPass123!',
        display_name: 'Dup User',
        tenant_slug: 'acme',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('POST /api/v1/auth/register — invalid tenant returns 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'x@x.com',
        password: 'TestPass123!',
        display_name: 'X',
        tenant_slug: 'nonexistent',
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/auth/register — validation error on missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'x@x.com' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/login — valid credentials return tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@acme.com',
        password: 'TestPass123!',
        tenant_slug: 'acme',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.token.access_token).toBeTruthy();
    expect(body.data.token.refresh_token).toBeTruthy();
  });

  it('POST /api/v1/auth/login — wrong password returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@acme.com',
        password: 'WrongPass!',
        tenant_slug: 'acme',
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/auth/refresh — valid refresh token returns new pair', async () => {
    // First login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@acme.com',
        password: 'TestPass123!',
        tenant_slug: 'acme',
      },
    });
    const refreshToken = loginRes.json().data.token.refresh_token;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.token.access_token).toBeTruthy();
  });

  it('POST /api/v1/auth/refresh — access token rejected as refresh', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@acme.com',
        password: 'TestPass123!',
        tenant_slug: 'acme',
      },
    });
    const accessToken = loginRes.json().data.token.access_token;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('K1 IAM — User Endpoints', () => {
  let accessToken: string;

  beforeAll(async () => {
    // Register admin user and assign super_admin role
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'admin@acme.com',
        password: 'Admin123!',
        display_name: 'Admin User',
        tenant_slug: 'acme',
      },
    });
    const userId = regRes.json().data.user.id;

    // Assign super_admin role
    const [saRole] = await adminSql`SELECT id FROM kernel.roles WHERE tenant_id = ${acmeTenantId} AND name = 'super_admin'`;
    await adminSql`INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by) VALUES (${userId}, ${saRole.id}, ${acmeTenantId}, ${userId}) ON CONFLICT DO NOTHING`;

    // Login to get token with super_admin role
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@acme.com',
        password: 'Admin123!',
        tenant_slug: 'acme',
      },
    });
    accessToken = loginRes.json().data.token.access_token;
  });

  it('GET /api/v1/users — returns tenant users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    // All users belong to same tenant
    for (const u of body.data.items) {
      expect(u.tenant_id).toBe(acmeTenantId);
    }
  });

  it('GET /api/v1/users/:id — returns specific user', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const userId = listRes.json().data.items[0].id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${userId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(userId);
  });

  it('PATCH /api/v1/users/:id — updates display_name', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const userId = listRes.json().data.items[0].id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${userId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { display_name: 'Updated Name' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.display_name).toBe('Updated Name');
  });

  it('GET /api/v1/users — no auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('K1 IAM — Role Endpoints', () => {
  let accessToken: string;

  beforeAll(async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@acme.com',
        password: 'Admin123!',
        tenant_slug: 'acme',
      },
    });
    accessToken = loginRes.json().data.token.access_token;
  });

  it('GET /api/v1/roles — lists tenant roles', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThanOrEqual(4);
  });

  it('POST /api/v1/roles — creates custom role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'custom_role', description: 'A test role' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('custom_role');
    expect(res.json().data.is_system).toBe(false);
  });

  it('POST /api/v1/roles — duplicate name returns 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'custom_role' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('PATCH /api/v1/roles/:id — cannot modify system role', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const systemRole = listRes.json().data.items.find((r: { is_system: boolean }) => r.is_system);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/roles/${systemRole.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'hacked' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/roles/:id/assign — assigns role to user', async () => {
    // Create a fresh role for this test
    const crRes = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'assign_test_role' },
    });
    expect(crRes.statusCode).toBe(201);
    const roleId = crRes.json().data.id;

    // Get userId from admin connection (avoids RLS transaction issues)
    const [user] = await adminSql`SELECT id FROM kernel.users WHERE email = 'admin@acme.com'`;
    const userId = user.id as string;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/roles/${roleId}/assign`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { user_id: userId },
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /api/v1/roles/:id/unassign — removes role from user', async () => {
    // Create and assign a fresh role
    const crRes = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'unassign_test_role' },
    });
    expect(crRes.statusCode).toBe(201);
    const roleId = crRes.json().data.id;

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const userId = listRes.json().data.items[0].id;

    // Assign first
    const assignRes = await app.inject({
      method: 'POST',
      url: `/api/v1/roles/${roleId}/assign`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { user_id: userId },
    });
    expect(assignRes.statusCode).toBe(201);

    // Then unassign
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/roles/${roleId}/unassign`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { user_id: userId },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /api/v1/roles/:id — deletes custom role', async () => {
    const crRes = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'delete_test_role' },
    });
    expect(crRes.statusCode).toBe(201);
    const roleId = crRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/roles/${roleId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /api/v1/roles/:id — cannot delete system role', async () => {
    const rolesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const systemRole = rolesRes.json().data.items.find((r: { is_system: boolean }) => r.is_system);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/roles/${systemRole.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('K1 IAM — Tenant Isolation', () => {
  it('Beta user cannot see Acme users', async () => {
    // Register beta user
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'user@beta.com',
        password: 'BetaPass123!',
        display_name: 'Beta User',
        tenant_slug: 'beta',
      },
    });

    // Login as beta
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'user@beta.com',
        password: 'BetaPass123!',
        tenant_slug: 'beta',
      },
    });
    const betaToken = loginRes.json().data.token.access_token;

    // List users — should only see beta users
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    const users = res.json().data.items;
    for (const u of users) {
      expect(u.tenant_id).toBe(betaTenantId);
    }
  });

  it('Same email can exist in different tenants', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@acme.com',
        password: 'BetaPass123!',
        display_name: 'Same Email Beta',
        tenant_slug: 'beta',
      },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('K1 IAM — Health Check', () => {
  it('GET /api/v1/health — returns ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});

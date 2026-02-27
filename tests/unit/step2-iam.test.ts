import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { v7 as uuidv7 } from 'uuid';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let acmeTenantId: string;
let betaTenantId: string;

/** Seed permissions, roles, and role_permissions for a tenant */
async function seedRolesForTenant(tenantId: string): Promise<void> {
  const allPerms = await adminSql`SELECT id, resource, action FROM kernel.permissions`;
  const permMap = new Map(allPerms.map((p) => [`${p.resource}.${p.action}`, p.id as string]));

  const roles: Array<{ name: string; is_system: boolean; perms: string[] }> = [
    { name: 'super_admin', is_system: true, perms: [...permMap.keys()] },
    { name: 'admin', is_system: true, perms: [...permMap.keys()].filter((p) => p !== 'permissions.assign') },
    { name: 'editor', is_system: true, perms: ['users.read', 'objects.create', 'objects.read', 'objects.update', 'objects.delete', 'audit.read'] },
    { name: 'viewer', is_system: true, perms: ['users.read', 'objects.read', 'audit.read'] },
  ];

  for (const role of roles) {
    const roleId = uuidv7();
    await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${roleId}, ${tenantId}, ${role.name}, ${role.is_system})`;
    for (const perm of role.perms) {
      const permId = permMap.get(perm);
      if (permId) {
        await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${roleId}, ${permId}, ${tenantId})`;
      }
    }
  }
}

beforeAll(async () => {
  app = await buildServer();
  await app.ready();

  // Clean
  await adminSql`DELETE FROM kernel.user_roles`;
  await adminSql`DELETE FROM kernel.role_permissions`;
  await adminSql`DELETE FROM kernel.audit_log`;
  await adminSql`DELETE FROM kernel.objects`;
  await adminSql`DELETE FROM kernel.users`;
  await adminSql`DELETE FROM kernel.roles`;
  await adminSql`DELETE FROM kernel.permissions`;
  await adminSql`DELETE FROM kernel.tenants`;

  // Tenants
  acmeTenantId = uuidv7();
  betaTenantId = uuidv7();
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${acmeTenantId}, 'Acme Corporation', 'acme')`;
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${betaTenantId}, 'Beta Industries', 'beta')`;

  // Permissions (15)
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

  // Seed roles for both tenants
  await seedRolesForTenant(acmeTenantId);
  await seedRolesForTenant(betaTenantId);
}, 30000);

afterAll(async () => {
  await app.close();
});

describe('K1 IAM — Auth Endpoints', () => {
  it('POST /api/v1/auth/register — creates user with viewer role', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'test@acme.com', password: 'TestPass123!', display_name: 'Test User', tenant_slug: 'acme' },
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
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'test@acme.com', password: 'TestPass123!', display_name: 'Dup User', tenant_slug: 'acme' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('POST /api/v1/auth/register — invalid tenant returns 404', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'x@x.com', password: 'TestPass123!', display_name: 'X', tenant_slug: 'nonexistent' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/auth/register — validation error on missing fields', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'x@x.com' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/login — valid credentials return tokens', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'test@acme.com', password: 'TestPass123!', tenant_slug: 'acme' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.token.access_token).toBeTruthy();
    expect(res.json().data.token.refresh_token).toBeTruthy();
  });

  it('POST /api/v1/auth/login — wrong password returns 401', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'test@acme.com', password: 'WrongPass!', tenant_slug: 'acme' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/auth/refresh — valid refresh token returns new pair', async () => {
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'test@acme.com', password: 'TestPass123!', tenant_slug: 'acme' },
    });
    const refreshToken = loginRes.json().data.token.refresh_token;
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.token.access_token).toBeTruthy();
  });

  it('POST /api/v1/auth/refresh — access token rejected as refresh', async () => {
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'test@acme.com', password: 'TestPass123!', tenant_slug: 'acme' },
    });
    const accessToken = loginRes.json().data.token.access_token;
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('K1 IAM — User Endpoints', () => {
  let accessToken: string;

  beforeAll(async () => {
    const regRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'admin@acme.com', password: 'Admin123!', display_name: 'Admin User', tenant_slug: 'acme' },
    });
    const userId = regRes.json().data.user.id;
    const [saRole] = await adminSql`SELECT id FROM kernel.roles WHERE tenant_id = ${acmeTenantId} AND name = 'super_admin'`;
    await adminSql`INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by) VALUES (${userId}, ${saRole.id}, ${acmeTenantId}, ${userId}) ON CONFLICT DO NOTHING`;
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
    });
    accessToken = loginRes.json().data.token.access_token;
  });

  it('GET /api/v1/users — returns tenant users', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThanOrEqual(1);
    for (const u of res.json().data.items) {
      expect(u.tenant_id).toBe(acmeTenantId);
    }
  });

  it('GET /api/v1/users/:id — returns specific user', async () => {
    const listRes = await app.inject({
      method: 'GET', url: '/api/v1/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const userId = listRes.json().data.items[0].id;
    const res = await app.inject({
      method: 'GET', url: `/api/v1/users/${userId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(userId);
  });

  it('PATCH /api/v1/users/:id — updates display_name', async () => {
    const listRes = await app.inject({
      method: 'GET', url: '/api/v1/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const userId = listRes.json().data.items[0].id;
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/users/${userId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { display_name: 'Updated Name' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.display_name).toBe('Updated Name');
  });

  it('GET /api/v1/users — no auth returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users' });
    expect(res.statusCode).toBe(401);
  });
});

describe('K1 IAM — Role Endpoints', () => {
  let accessToken: string;

  beforeAll(async () => {
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
    });
    accessToken = loginRes.json().data.token.access_token;
  });

  it('GET /api/v1/roles — lists tenant roles', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThanOrEqual(4);
  });

  it('POST /api/v1/roles — creates custom role', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'custom_role', description: 'A test role' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('custom_role');
    expect(res.json().data.is_system).toBe(false);
  });

  it('POST /api/v1/roles — duplicate name returns 409', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'custom_role' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('PATCH /api/v1/roles/:id — cannot modify system role', async () => {
    const listRes = await app.inject({
      method: 'GET', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const systemRole = listRes.json().data.items.find((r: { is_system: boolean }) => r.is_system);
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/roles/${systemRole.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'hacked' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/roles/:id/assign — assigns role to user', async () => {
    const crRes = await app.inject({
      method: 'POST', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'assign_test_role' },
    });
    expect(crRes.statusCode).toBe(201);
    const roleId = crRes.json().data.id;
    const [user] = await adminSql`SELECT id FROM kernel.users WHERE email = 'admin@acme.com'`;
    const res = await app.inject({
      method: 'POST', url: `/api/v1/roles/${roleId}/assign`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { user_id: user.id },
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /api/v1/roles/:id/unassign — removes role from user', async () => {
    const crRes = await app.inject({
      method: 'POST', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'unassign_test_role' },
    });
    expect(crRes.statusCode).toBe(201);
    const roleId = crRes.json().data.id;
    const [user] = await adminSql`SELECT id FROM kernel.users WHERE email = 'admin@acme.com'`;
    await app.inject({
      method: 'POST', url: `/api/v1/roles/${roleId}/assign`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { user_id: user.id },
    });
    const res = await app.inject({
      method: 'POST', url: `/api/v1/roles/${roleId}/unassign`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { user_id: user.id },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /api/v1/roles/:id — deletes custom role', async () => {
    const crRes = await app.inject({
      method: 'POST', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'delete_test_role' },
    });
    expect(crRes.statusCode).toBe(201);
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/roles/${crRes.json().data.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /api/v1/roles/:id — cannot delete system role', async () => {
    const rolesRes = await app.inject({
      method: 'GET', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const systemRole = rolesRes.json().data.items.find((r: { is_system: boolean }) => r.is_system);
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/roles/${systemRole.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('K1 IAM — Tenant Isolation', () => {
  it('Beta user cannot see Acme users', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'user@beta.com', password: 'BetaPass123!', display_name: 'Beta User', tenant_slug: 'beta' },
    });
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'user@beta.com', password: 'BetaPass123!', tenant_slug: 'beta' },
    });
    const betaToken = loginRes.json().data.token.access_token;
    const res = await app.inject({
      method: 'GET', url: '/api/v1/users',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    for (const u of res.json().data.items) {
      expect(u.tenant_id).toBe(betaTenantId);
    }
  });

  it('Same email can exist in different tenants', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'test@acme.com', password: 'BetaPass123!', display_name: 'Same Email Beta', tenant_slug: 'beta' },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('K1 IAM — Health Check', () => {
  it('GET /api/v1/health — returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});

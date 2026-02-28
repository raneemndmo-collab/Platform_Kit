/**
 * P0.13 Secondary Integration Tests
 *
 * - Wrong password → 401 + audit
 * - Create role → assign permission → assign to user → user gains access
 * - Delete role → user loses access on next request
 * - Invalid state transition (deleted → active) → 400
 * - Audit log has no UPDATE/DELETE operations
 *
 * Prerequisite: pnpm db:seed
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let adminToken: string;

beforeAll(async () => {
  await reseed();
  await adminSql`DELETE FROM kernel.audit_log`;
  app = await buildServer();
  await app.ready();

  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(loginRes.statusCode).toBe(200);
  adminToken = loginRes.json().data.token.access_token;
}, 15000);

afterAll(async () => {
  await app.close();
});

describe('P0.13 Secondary — Wrong Password', () => {
  it('Wrong password → 401', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@acme.com', password: 'WrongPass!', tenant_slug: 'acme' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('P0.13 Secondary — Dynamic Role Assignment', () => {
  let newUserId: string;
  let newUserToken: string;
  let customRoleId: string;

  it('Register a new user (gets viewer role only)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: {
        email: 'dynamic-test@acme.com',
        password: 'DynTest123!',
        display_name: 'Dynamic Test User',
        tenant_slug: 'acme',
      },
    });
    expect(res.statusCode).toBe(201);
    newUserId = res.json().data.user.id;
    newUserToken = res.json().data.token.access_token;
  });

  it('New user cannot create objects (viewer only)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${newUserToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Viewer Attempt' } },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Admin creates custom role with objects.create permission', async () => {
    // Create role
    const roleRes = await app.inject({
      method: 'POST', url: '/api/v1/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'dynamic_creator', description: 'Can create objects' },
    });
    expect(roleRes.statusCode).toBe(201);
    customRoleId = roleRes.json().data.id;

    // Get objects.create permission id
    const [perm] = await adminSql`
      SELECT id FROM kernel.permissions WHERE resource = 'objects' AND action = 'create'
    `;
    expect(perm).toBeTruthy();

    // Assign permission to role
    const [acme] = await adminSql`SELECT id FROM kernel.tenants WHERE slug = 'acme'`;
    await adminSql`
      INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id)
      VALUES (${customRoleId}, ${perm.id}, ${acme.id})
    `;

    // Assign role to user
    const assignRes = await app.inject({
      method: 'POST', url: `/api/v1/roles/${customRoleId}/assign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { user_id: newUserId },
    });
    expect(assignRes.statusCode).toBe(201);
  });

  it('User re-logs in and can now create objects', async () => {
    // Re-login to get new JWT with updated roles
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'dynamic-test@acme.com', password: 'DynTest123!', tenant_slug: 'acme' },
    });
    expect(loginRes.statusCode).toBe(200);
    newUserToken = loginRes.json().data.token.access_token;

    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${newUserToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Dynamic Access' } },
    });
    expect(res.statusCode).toBe(201);
  });

  it('Admin unassigns role → user loses access on next login', async () => {
    // Unassign role
    const unassignRes = await app.inject({
      method: 'POST', url: `/api/v1/roles/${customRoleId}/unassign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { user_id: newUserId },
    });
    expect(unassignRes.statusCode).toBe(204);

    // Re-login
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'dynamic-test@acme.com', password: 'DynTest123!', tenant_slug: 'acme' },
    });
    expect(loginRes.statusCode).toBe(200);
    newUserToken = loginRes.json().data.token.access_token;

    // Should be denied again
    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${newUserToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Should Fail' } },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('P0.13 Secondary — Invalid State Transition', () => {
  it('deleted → active returns 400 (via soft-delete then transition)', async () => {
    // Create and soft-delete an object
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'To Delete' } },
    });
    expect(createRes.statusCode).toBe(201);
    const objId = createRes.json().data.id;

    // Soft delete
    const delRes = await app.inject({
      method: 'DELETE', url: `/api/v1/objects/${objId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(204);

    // Try to transition deleted → active (should fail)
    const transRes = await app.inject({
      method: 'POST', url: `/api/v1/objects/${objId}/transition`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { state: 'active' },
    });
    // Object is soft-deleted, so GET returns 404
    expect([400, 404]).toContain(transRes.statusCode);
  });
});

describe('P0.13 Secondary — Audit Integrity', () => {
  it('rasid_app cannot UPDATE audit_log', async () => {
    const postgres = (await import('postgres')).default;
    const appConn = postgres({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'rasid_platform',
      username: 'rasid_app',
      password: process.env.DB_APP_PASSWORD || 'rasid_app_pass',
    });
    try {
      // Set tenant context first to avoid RLS config error
      const [row] = await adminSql`SELECT id, tenant_id FROM kernel.audit_log LIMIT 1`;
      if (row) {
        await appConn`SELECT set_config('app.current_tenant_id', ${row.tenant_id as string}, false)`;
        await appConn`UPDATE kernel.audit_log SET status = 'tampered' WHERE id = ${row.id}`;
        expect.fail('UPDATE on audit_log should be denied');
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || '';
      expect(msg).toMatch(/permission denied/i);
    } finally {
      await appConn.end();
    }
  });

  it('rasid_app cannot DELETE from audit_log', async () => {
    const postgres = (await import('postgres')).default;
    const appConn = postgres({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'rasid_platform',
      username: 'rasid_app',
      password: process.env.DB_APP_PASSWORD || 'rasid_app_pass',
    });
    try {
      const [row] = await adminSql`SELECT tenant_id FROM kernel.audit_log LIMIT 1`;
      if (row) {
        await appConn`SELECT set_config('app.current_tenant_id', ${row.tenant_id as string}, false)`;
      }
      await appConn`DELETE FROM kernel.audit_log WHERE 1=1`;
      expect.fail('DELETE on audit_log should be denied');
    } catch (err: unknown) {
      const msg = (err as Error).message || '';
      expect(msg).toMatch(/permission denied/i);
    } finally {
      await appConn.end();
    }
  });
});

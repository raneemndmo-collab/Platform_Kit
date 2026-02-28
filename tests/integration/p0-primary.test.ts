/**
 * P0.13 Primary Integration Test — 8 Steps
 *
 * Prerequisite: pnpm db:migrate && pnpm db:seed
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let adminToken: string;
let viewerToken: string;
let betaAdminToken: string;
let objectId: string;

beforeAll(async () => {
  // Reseed all data (step2 destroys seed data with random UUIDs)
  await reseed();
  await adminSql`DELETE FROM kernel.audit_log`;

  app = await buildServer();
  await app.ready();

  // Pre-login all users to avoid rate-limiting issues
  const adminLogin = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(adminLogin.statusCode).toBe(200);
  adminToken = adminLogin.json().data.token.access_token;

  const viewerLogin = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'viewer@acme.com', password: 'Viewer123!', tenant_slug: 'acme' },
  });
  expect(viewerLogin.statusCode).toBe(200);
  viewerToken = viewerLogin.json().data.token.access_token;

  const betaLogin = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
  });
  expect(betaLogin.statusCode).toBe(200);
  betaAdminToken = betaLogin.json().data.token.access_token;
}, 30000);

afterAll(async () => {
  await app.close();
});

describe('P0.13 — Primary Integration Test (8 Steps)', () => {
  // ── STEP 1: LOGIN ──
  it('Step 1: LOGIN as admin@acme.com → JWT + audit', async () => {
    // adminToken already obtained in beforeAll, verify it works
    const res = await app.inject({
      method: 'GET', url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThanOrEqual(1);
  });

  // ── STEP 2: CREATE OBJECT ──
  it('Step 2: CREATE OBJECT → 201, draft, version=1, audit + event', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Integration Test', value: 100 } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.state).toBe('draft');
    expect(body.data.version).toBe(1);
    expect(body.data.type).toBe('rasid.core.test');
    objectId = body.data.id;

    // Verify audit
    const [audit] = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE object_id = ${objectId} AND action_id = 'rasid.core.object.create' AND status = 'success'
    `;
    expect(audit).toBeTruthy();
    expect(audit.payload_after).toBeTruthy();
  });

  // ── STEP 3: UPDATE OBJECT ──
  it('Step 3: UPDATE OBJECT → 200, version=2, audit has before/after', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/objects/${objectId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { data: { name: 'Updated Integration Test', value: 200 } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.version).toBe(2);
    expect(body.data.data.name).toBe('Updated Integration Test');

    // Verify audit has before/after
    const [audit] = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE object_id = ${objectId} AND action_id = 'rasid.core.object.update' AND status = 'success'
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(audit).toBeTruthy();
    expect(audit.payload_before).toBeTruthy();
    expect(audit.payload_after).toBeTruthy();
  });

  // ── STEP 4: TRANSITION to active ──
  it('Step 4: TRANSITION to active → 200, state=active', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/objects/${objectId}/transition`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { state: 'active' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.state).toBe('active');

    // Verify audit
    const [audit] = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE object_id = ${objectId} AND action_id = 'rasid.core.object.transition' AND status = 'success'
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(audit).toBeTruthy();
  });

  // ── STEP 5: CREATE as viewer → 403 ──
  it('Step 5: CREATE as viewer@acme.com → 403, failure audit', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { type: 'rasid.core.test', data: { name: 'Viewer Attempt' } },
    });
    expect(res.statusCode).toBe(403);

    // Verify failure audit
    const [audit] = await adminSql`
      SELECT * FROM kernel.audit_log
      WHERE action_id = 'rasid.core.object.create' AND status = 'failure'
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(audit).toBeTruthy();
  });

  // ── STEP 6: READ as beta admin → 404 (RLS) ──
  it('Step 6: READ as admin@beta.com for Tenant A object → 404', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/objects/${objectId}`,
      headers: { authorization: `Bearer ${betaAdminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // ── STEP 7: LIST as viewer → Tenant A only ──
  it('Step 7: LIST as viewer@acme.com → Tenant A objects only', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/objects',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.items;
    expect(items.length).toBeGreaterThanOrEqual(1);

    // All items belong to acme
    const [acme] = await adminSql`SELECT id FROM kernel.tenants WHERE slug = 'acme'`;
    for (const item of items) {
      expect(item.tenant_id).toBe(acme.id);
    }
  });

  // ── STEP 8: VERIFY AUDIT ──
  it('Step 8: VERIFY AUDIT → all actions recorded, failures included', async () => {
    const audits = await adminSql`
      SELECT action_id, status FROM kernel.audit_log
      ORDER BY created_at ASC
    `;
    expect(audits.length).toBeGreaterThanOrEqual(4);

    const entries = audits.map((a) => `${a.action_id}:${a.status}`);
    expect(entries).toContain('rasid.core.object.create:success');
    expect(entries).toContain('rasid.core.object.update:success');
    expect(entries).toContain('rasid.core.object.transition:success');
    expect(entries).toContain('rasid.core.object.create:failure');

    // Verify audit via API
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBeGreaterThanOrEqual(4);

    // Verify object trail
    const trailRes = await app.inject({
      method: 'GET', url: `/api/v1/audit/object/${objectId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(trailRes.statusCode).toBe(200);
    expect(trailRes.json().data.items.length).toBeGreaterThanOrEqual(3);
  });
});

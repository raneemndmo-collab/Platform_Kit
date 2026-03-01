/**
 * Step 30 — M30 Billing / Licensing tests (Metadata Only)
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Schema: mod_billing — isolated, no cross-schema FK.
 * No payment gateway, no invoice engine, no Stripe/PayPal.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let betaToken: string;
let planId: string;
let flagId: string;
let quotaId: string;
let subscriptionId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();
  const loginRes = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' } });
  token = JSON.parse(loginRes.body).data.token.access_token;
  const betaRes = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' } });
  betaToken = JSON.parse(betaRes.body).data.token.access_token;
});

afterAll(async () => { await app.close(); });

const acmeAuth = () => ({ authorization: `Bearer ${token}` });
const betaAuth = () => ({ authorization: `Bearer ${betaToken}` });

describe('M30 Billing / Licensing (Metadata Only)', () => {
  describe('Plans', () => {
    it('POST /api/v1/billing/plans → 201 creates a plan', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/billing/plans', headers: acmeAuth(),
        payload: { name: 'Enterprise Plan', slug: 'enterprise', tier: 'enterprise', max_users: 500, max_storage_mb: 100000, max_api_calls_per_month: 1000000, features: { sso: true, audit: true } },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Enterprise Plan');
      expect(body.data.slug).toBe('enterprise');
      expect(body.data.tier).toBe('enterprise');
      planId = body.data.id;
    });

    it('GET /api/v1/billing/plans → 200 lists plans', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/billing/plans', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/billing/plans/:id → 200 gets plan', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/billing/plans/${planId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.slug).toBe('enterprise');
    });

    it('PATCH /api/v1/billing/plans/:id → 200 updates plan', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/billing/plans/${planId}`, headers: acmeAuth(),
        payload: { max_users: 1000 },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.max_users).toBe(1000);
    });

    it('tenant isolation — Beta cannot see Acme plans', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/billing/plans/${planId}`, headers: betaAuth() });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Feature Flags', () => {
    it('POST /api/v1/billing/flags → 201 creates a flag', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/billing/flags', headers: acmeAuth(),
        payload: { key: 'feature.sso', label: 'SSO Enabled', plan_id: planId },
      });
      expect(res.statusCode).toBe(201);
      flagId = JSON.parse(res.body).data.id;
    });

    it('GET /api/v1/billing/flags → 200 lists flags', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/billing/flags', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/billing/flags/:id → 200 updates flag', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/billing/flags/${flagId}`, headers: acmeAuth(),
        payload: { is_enabled: false },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.is_enabled).toBe(false);
    });

    it('DELETE /api/v1/billing/flags/:id → 200 deletes flag', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/billing/flags/${flagId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Usage Records', () => {
    it('POST /api/v1/billing/usage → 201 creates usage record', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/billing/usage', headers: acmeAuth(),
        payload: { resource_type: 'api_calls', quantity: 150, unit: 'calls', period_start: '2026-03-01T00:00:00Z', period_end: '2026-03-31T23:59:59Z' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('GET /api/v1/billing/usage → 200 lists usage', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/billing/usage', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Quota Configs', () => {
    it('POST /api/v1/billing/quotas → 201 creates quota', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/billing/quotas', headers: acmeAuth(),
        payload: { resource_type: 'api_calls', max_quantity: 10000, unit: 'calls', enforcement_mode: 'hard' },
      });
      expect(res.statusCode).toBe(201);
      quotaId = JSON.parse(res.body).data.id;
    });

    it('PATCH /api/v1/billing/quotas/:id → 200 updates quota', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/billing/quotas/${quotaId}`, headers: acmeAuth(),
        payload: { max_quantity: 20000 },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.max_quantity).toBe(20000);
    });

    it('DELETE /api/v1/billing/quotas/:id → 200 deletes quota', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/billing/quotas/${quotaId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Subscriptions', () => {
    it('POST /api/v1/billing/subscriptions → 201 creates subscription', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/billing/subscriptions', headers: acmeAuth(),
        payload: { plan_id: planId, status: 'active' },
      });
      expect(res.statusCode).toBe(201);
      subscriptionId = JSON.parse(res.body).data.id;
    });

    it('GET /api/v1/billing/subscriptions → 200 lists subscriptions', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/billing/subscriptions', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/billing/subscriptions/:id → 200 updates subscription', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/billing/subscriptions/${subscriptionId}`, headers: acmeAuth(),
        payload: { status: 'suspended' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.status).toBe('suspended');
    });
  });

  describe('Cleanup', () => {
    it('DELETE /api/v1/billing/plans/:id → 200 deletes plan', async () => {
      // First delete subscription
      await adminSql`DELETE FROM mod_billing.subscriptions WHERE plan_id = ${planId}`;
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/billing/plans/${planId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });
  });
});

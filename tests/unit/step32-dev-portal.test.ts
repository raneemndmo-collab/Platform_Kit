/**
 * Step 32 — M32 Developer Portal tests (Metadata Only)
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Schema: mod_dev_portal — isolated, no cross-schema FK.
 * No external SDK publishing. No OpenAPI runtime generator. No Swagger UI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let betaToken: string;
let keyId: string;
let docId: string;
let webhookId: string;

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

describe('M32 Developer Portal (Metadata Only)', () => {
  describe('Portal API Keys', () => {
    it('POST /api/v1/portal/keys → 201 creates API key', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/portal/keys', headers: acmeAuth(),
        payload: { name: 'Production Key', environment: 'production', scopes: ['read', 'write'], rate_limit: 5000 },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Production Key');
      expect(body.data.environment).toBe('production');
      expect(body.data.key_prefix).toBeTruthy();
      expect(body.data.raw_key).toBeTruthy();
      keyId = body.data.id;
    });

    it('GET /api/v1/portal/keys → 200 lists keys', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/portal/keys', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      // raw_key should NOT be in list response (only on create)
      expect(body.data[0].key_hash).toBeUndefined();
    });

    it('GET /api/v1/portal/keys/:id → 200 gets key', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/portal/keys/${keyId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe('Production Key');
    });

    it('PATCH /api/v1/portal/keys/:id → 200 updates key', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/portal/keys/${keyId}`, headers: acmeAuth(),
        payload: { name: 'Updated Key', rate_limit: 10000 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Updated Key');
      expect(body.data.rate_limit).toBe(10000);
    });

    it('tenant isolation — Beta cannot see Acme keys', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/portal/keys/${keyId}`, headers: betaAuth() });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Usage Logs', () => {
    it('POST /api/v1/portal/usage → 201 creates usage log', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/portal/usage', headers: acmeAuth(),
        payload: { api_key_id: keyId, endpoint: '/api/v1/objects', method: 'GET', status_code: 200, response_time_ms: 45, ip_address: '10.0.0.1' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('GET /api/v1/portal/usage → 200 lists usage logs', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/portal/usage', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/portal/usage?api_key_id=... → 200 filters by key', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/portal/usage?api_key_id=${keyId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Doc Pages', () => {
    it('POST /api/v1/portal/docs → 201 creates doc page', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/portal/docs', headers: acmeAuth(),
        payload: { slug: 'getting-started', title: 'Getting Started', category: 'guides', content_ref: 'docs/getting-started.md', version: '1.0', is_published: true, sort_order: 1 },
      });
      expect(res.statusCode).toBe(201);
      docId = JSON.parse(res.body).data.id;
    });

    it('GET /api/v1/portal/docs → 200 lists doc pages', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/portal/docs', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/portal/docs/:id → 200 updates doc page', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/portal/docs/${docId}`, headers: acmeAuth(),
        payload: { title: 'Getting Started (Updated)', version: '1.1' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.title).toBe('Getting Started (Updated)');
    });

    it('DELETE /api/v1/portal/docs/:id → 200 deletes doc page', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/portal/docs/${docId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Webhooks', () => {
    it('POST /api/v1/portal/webhooks → 201 creates webhook', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/portal/webhooks', headers: acmeAuth(),
        payload: { name: 'Deploy Hook', url: 'https://example.com/webhook', events: ['object.created', 'object.updated'] },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Deploy Hook');
      expect(body.data.signing_secret).toBeTruthy();
      webhookId = body.data.id;
    });

    it('GET /api/v1/portal/webhooks → 200 lists webhooks', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/portal/webhooks', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/portal/webhooks/:id → 200 updates webhook', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/portal/webhooks/${webhookId}`, headers: acmeAuth(),
        payload: { is_active: false },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.is_active).toBe(false);
    });

    it('DELETE /api/v1/portal/webhooks/:id → 200 deletes webhook', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/portal/webhooks/${webhookId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Cleanup', () => {
    it('DELETE /api/v1/portal/keys/:id → 200 deletes key', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/portal/keys/${keyId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });
  });
});

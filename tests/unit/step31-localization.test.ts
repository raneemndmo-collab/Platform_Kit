/**
 * Step 31 — M31 Localization tests (Metadata Only)
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Schema: mod_localization — isolated, no cross-schema FK.
 * No runtime translation engine.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let betaToken: string;
let langId: string;
let keyId: string;
let translationId: string;

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

describe('M31 Localization (Metadata Only)', () => {
  describe('Languages', () => {
    it('POST /api/v1/l10n/languages → 201 creates Arabic language', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/l10n/languages', headers: acmeAuth(),
        payload: { code: 'ar', name: 'Arabic', native_name: 'العربية', direction: 'rtl', is_default: true },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.code).toBe('ar');
      expect(body.data.direction).toBe('rtl');
      expect(body.data.is_default).toBe(true);
      langId = body.data.id;
    });

    it('POST /api/v1/l10n/languages → 201 creates English language', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/l10n/languages', headers: acmeAuth(),
        payload: { code: 'en', name: 'English', native_name: 'English', direction: 'ltr' },
      });
      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.direction).toBe('ltr');
    });

    it('GET /api/v1/l10n/languages → 200 lists languages', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/l10n/languages', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/v1/l10n/languages/:id → 200 gets language', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/l10n/languages/${langId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.code).toBe('ar');
    });

    it('PATCH /api/v1/l10n/languages/:id → 200 updates language', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/l10n/languages/${langId}`, headers: acmeAuth(),
        payload: { name: 'Arabic (SA)' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe('Arabic (SA)');
    });

    it('tenant isolation — Beta cannot see Acme languages', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/l10n/languages/${langId}`, headers: betaAuth() });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Translation Keys', () => {
    it('POST /api/v1/l10n/keys → 201 creates translation key', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/l10n/keys', headers: acmeAuth(),
        payload: { namespace: 'common', key: 'welcome_message', description: 'Main welcome message' },
      });
      expect(res.statusCode).toBe(201);
      keyId = JSON.parse(res.body).data.id;
    });

    it('GET /api/v1/l10n/keys → 200 lists keys', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/l10n/keys', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/l10n/keys/:id → 200 updates key', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/l10n/keys/${keyId}`, headers: acmeAuth(),
        payload: { description: 'Updated description' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Translations', () => {
    it('POST /api/v1/l10n/translations → 201 creates translation', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/l10n/translations', headers: acmeAuth(),
        payload: { key_id: keyId, language_id: langId, value: 'مرحباً بك في رصيد' },
      });
      expect(res.statusCode).toBe(201);
      translationId = JSON.parse(res.body).data.id;
    });

    it('GET /api/v1/l10n/translations → 200 lists translations', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/l10n/translations', headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/l10n/translations/:id → 200 updates translation', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/l10n/translations/${translationId}`, headers: acmeAuth(),
        payload: { value: 'مرحباً بك في منصة رصيد', is_reviewed: true },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.is_reviewed).toBe(true);
    });

    it('DELETE /api/v1/l10n/translations/:id → 200 deletes translation', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/l10n/translations/${translationId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Cleanup', () => {
    it('DELETE /api/v1/l10n/keys/:id → 200 deletes key', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/l10n/keys/${keyId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });

    it('DELETE /api/v1/l10n/languages/:id → 200 deletes language', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/l10n/languages/${langId}`, headers: acmeAuth() });
      expect(res.statusCode).toBe(200);
    });
  });
});

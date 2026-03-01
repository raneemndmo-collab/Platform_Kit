/**
 * Step 29 — M29 API Gateway Hardening tests (Metadata Only)
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Schema: mod_gateway — isolated, no cross-schema FK.
 * No actual network enforcement. No reverse proxy. No NGINX.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import type { FastifyInstance } from 'fastify';
import fs from 'fs';

let app: FastifyInstance;
let token: string;
let betaToken: string;
let viewerToken: string;
let apiKeyId: string;
let ipEntryId: string;
let rateLimitId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();
  const loginRes = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' } });
  token = JSON.parse(loginRes.body).data.token.access_token;
  const betaRes = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' } });
  betaToken = JSON.parse(betaRes.body).data.token.access_token;
  const viewerRes = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'viewer@acme.com', password: 'Viewer123!', tenant_slug: 'acme' } });
  viewerToken = JSON.parse(viewerRes.body).data.token.access_token;
});

afterAll(async () => { await app?.close(); });

const auth = () => ({ authorization: `Bearer ${token}` });
const betaAuth = () => ({ authorization: `Bearer ${betaToken}` });
const viewerAuth = () => ({ authorization: `Bearer ${viewerToken}` });

describe('M29 API Gateway Hardening (Metadata Only)', () => {
  /* ═══════════════════════════════════════════
   * API KEYS CRUD
   * ═══════════════════════════════════════════ */
  describe('API Keys', () => {
    it('POST /api/v1/gateway/api-keys → 201 creates an API key', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/gateway/api-keys', headers: auth(),
        payload: { name: 'Production Key', scopes: ['read:data', 'write:data'] },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Production Key');
      expect(body.data.scopes).toEqual(['read:data', 'write:data']);
      expect(body.data.status).toBe('active');
      expect(body.data.key_prefix).toBeDefined();
      expect(body.data.raw_key).toBeDefined();
      expect(body.data.raw_key.length).toBe(64); // 32 bytes hex
      apiKeyId = body.data.id;
    });

    it('GET /api/v1/gateway/api-keys → 200 lists keys (no raw_key)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/gateway/api-keys', headers: auth() });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      // raw_key should NOT be in list response
      expect(body.data[0].raw_key).toBeUndefined();
      expect(body.data[0].key_hash).toBeUndefined();
    });

    it('GET /api/v1/gateway/api-keys/:id → 200 gets key', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/gateway/api-keys/${apiKeyId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.id).toBe(apiKeyId);
      expect(body.data.key_hash).toBeUndefined(); // hash not exposed
    });

    it('PATCH /api/v1/gateway/api-keys/:id → 200 updates key', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/gateway/api-keys/${apiKeyId}`, headers: auth(),
        payload: { name: 'Updated Key', status: 'revoked' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Updated Key');
      expect(body.data.status).toBe('revoked');
    });

    it('tenant isolation — Beta cannot see Acme keys', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/gateway/api-keys/${apiKeyId}`, headers: betaAuth() });
      expect(res.statusCode).toBe(404);
    });

    it('viewer cannot create API keys (RBAC)', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/gateway/api-keys', headers: viewerAuth(),
        payload: { name: 'Viewer Key', scopes: [] },
      });
      expect(res.statusCode).toBe(403);
    });

    it('DELETE /api/v1/gateway/api-keys/:id → 200 deletes key', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/gateway/api-keys/${apiKeyId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.deleted).toBe(true);
    });

    it('GET deleted key → 404', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/gateway/api-keys/${apiKeyId}`, headers: auth() });
      expect(res.statusCode).toBe(404);
    });
  });

  /* ═══════════════════════════════════════════
   * IP ALLOWLIST CRUD
   * ═══════════════════════════════════════════ */
  describe('IP Allowlist', () => {
    it('POST /api/v1/gateway/ip-allowlist → 201 creates entry', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/gateway/ip-allowlist', headers: auth(),
        payload: { cidr: '10.0.0.0/8', label: 'Internal Network' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.cidr).toBe('10.0.0.0/8');
      expect(body.data.label).toBe('Internal Network');
      expect(body.data.is_active).toBe(true);
      ipEntryId = body.data.id;
    });

    it('GET /api/v1/gateway/ip-allowlist → 200 lists entries', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/gateway/ip-allowlist', headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/gateway/ip-allowlist/:id → 200 updates entry', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/gateway/ip-allowlist/${ipEntryId}`, headers: auth(),
        payload: { label: 'Updated Network', is_active: false },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.label).toBe('Updated Network');
      expect(body.data.is_active).toBe(false);
    });

    it('tenant isolation — Beta cannot see Acme IP entries', async () => {
      const res = await app.inject({ method: 'PATCH', url: `/api/v1/gateway/ip-allowlist/${ipEntryId}`, headers: betaAuth(), payload: { label: 'hack' } });
      expect(res.statusCode).toBe(404);
    });

    it('DELETE /api/v1/gateway/ip-allowlist/:id → 200 deletes entry', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/gateway/ip-allowlist/${ipEntryId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
    });
  });

  /* ═══════════════════════════════════════════
   * RATE LIMITS CRUD
   * ═══════════════════════════════════════════ */
  describe('Rate Limits', () => {
    it('POST /api/v1/gateway/rate-limits → 201 creates rate limit', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/gateway/rate-limits', headers: auth(),
        payload: { name: 'API Rate Limit', endpoint_pattern: '/api/v1/*', max_requests: 1000, window_seconds: 60 },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('API Rate Limit');
      expect(body.data.max_requests).toBe(1000);
      expect(body.data.window_seconds).toBe(60);
      expect(body.data.is_active).toBe(true);
      rateLimitId = body.data.id;
    });

    it('GET /api/v1/gateway/rate-limits → 200 lists rate limits', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/gateway/rate-limits', headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/gateway/rate-limits/:id → 200 updates rate limit', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/gateway/rate-limits/${rateLimitId}`, headers: auth(),
        payload: { max_requests: 2000, is_active: false },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.max_requests).toBe(2000);
      expect(body.data.is_active).toBe(false);
    });

    it('tenant isolation — Beta cannot see Acme rate limits', async () => {
      const res = await app.inject({ method: 'PATCH', url: `/api/v1/gateway/rate-limits/${rateLimitId}`, headers: betaAuth(), payload: { name: 'hack' } });
      expect(res.statusCode).toBe(404);
    });

    it('DELETE /api/v1/gateway/rate-limits/:id → 200 deletes rate limit', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/gateway/rate-limits/${rateLimitId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
    });
  });

  /* ═══════════════════════════════════════════
   * VALIDATION
   * ═══════════════════════════════════════════ */
  describe('Validation', () => {
    it('rejects invalid rate limit (max_requests = 0)', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/gateway/rate-limits', headers: auth(),
        payload: { name: 'Bad', endpoint_pattern: '/x', max_requests: 0, window_seconds: 60 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects empty API key name', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/gateway/api-keys', headers: auth(),
        payload: { name: '', scopes: [] },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  /* ═══════════════════════════════════════════
   * COMPLIANCE CHECKS
   * ═══════════════════════════════════════════ */
  describe('Compliance', () => {
    it('RLS enabled on all mod_gateway tables', async () => {
      const result = await adminSql`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'mod_gateway' AND rowsecurity = true
        ORDER BY tablename`;
      const tables = result.map(r => r.tablename);
      expect(tables).toContain('api_keys');
      expect(tables).toContain('ip_allowlist');
      expect(tables).toContain('rate_limit_configs');
      expect(tables.length).toBe(3);
    });

    it('no cross-schema foreign keys', async () => {
      const result = await adminSql`
        SELECT conname, conrelid::regclass, confrelid::regclass
        FROM pg_constraint
        WHERE contype = 'f'
          AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'mod_gateway')`;
      expect(result.length).toBe(0);
    });

    it('source code has no NGINX, no reverse proxy, no network enforcement', () => {
      const files = ['gateway.service.ts', 'gateway.actions.ts', 'gateway.routes.ts', 'migrate.ts'];
      for (const f of files) {
        const content = fs.readFileSync(`packages/modules/api-gateway/src/${f}`, 'utf-8');
        expect(content).not.toMatch(/http\.createServer|net\.createServer/i);
        expect(content).not.toMatch(/setInterval|setTimeout|cron|schedule/i);
        expect(content).not.toMatch(/aws-sdk|@aws-sdk/i);
      }
    });

    it('no cross-schema queries in service', () => {
      const content = fs.readFileSync('packages/modules/api-gateway/src/gateway.service.ts', 'utf-8');
      expect(content).not.toMatch(/kernel\./);
      expect(content).not.toMatch(/mod_ai\./);
      expect(content).not.toMatch(/mod_backup\./);
    });
  });
});

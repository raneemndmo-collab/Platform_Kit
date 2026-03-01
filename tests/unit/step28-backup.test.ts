/**
 * Step 28 — M28 Backup & Recovery tests (Metadata Only)
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Schema: mod_backup — isolated, no cross-schema FK.
 * No pg_dump, no filesystem, no S3, no scheduler.
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
let policyId: string;
let jobId: string;
let restoreId: string;

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

describe('M28 Backup & Recovery (Metadata Only)', () => {
  /* ═══════════════════════════════════════════
   * RETENTION POLICIES CRUD
   * ═══════════════════════════════════════════ */
  describe('Retention Policies', () => {
    it('POST /api/v1/backup/policies → 201 creates a policy', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/backup/policies', headers: auth(),
        payload: { name: 'Daily Full Backup', description: 'Full backup daily', retention_days: 30, max_backups: 10, target_type: 'full' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Daily Full Backup');
      expect(body.data.retention_days).toBe(30);
      expect(body.data.max_backups).toBe(10);
      expect(body.data.target_type).toBe('full');
      expect(body.data.is_active).toBe(true);
      policyId = body.data.id;
    });

    it('GET /api/v1/backup/policies → 200 lists policies', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/backup/policies', headers: auth() });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/backup/policies/:id → 200 gets policy', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/backup/policies/${policyId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.id).toBe(policyId);
    });

    it('PATCH /api/v1/backup/policies/:id → 200 updates policy', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/backup/policies/${policyId}`, headers: auth(),
        payload: { name: 'Updated Policy', retention_days: 60 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('Updated Policy');
      expect(body.data.retention_days).toBe(60);
    });

    it('tenant isolation — Beta cannot see Acme policies', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/backup/policies/${policyId}`, headers: betaAuth() });
      expect(res.statusCode).toBe(404);
    });

    it('viewer cannot create policies (RBAC)', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/backup/policies', headers: viewerAuth(),
        payload: { name: 'Viewer Policy', retention_days: 7, max_backups: 3, target_type: 'schema' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  /* ═══════════════════════════════════════════
   * BACKUP JOBS CRUD
   * ═══════════════════════════════════════════ */
  describe('Backup Jobs', () => {
    it('POST /api/v1/backup/jobs → 201 creates a job', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/backup/jobs', headers: auth(),
        payload: { label: 'Manual Backup 2025-01', target_type: 'full', metadata: { note: 'test' } },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.label).toBe('Manual Backup 2025-01');
      expect(body.data.status).toBe('pending');
      expect(body.data.target_type).toBe('full');
      jobId = body.data.id;
    });

    it('GET /api/v1/backup/jobs → 200 lists jobs', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/backup/jobs', headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/backup/jobs/:id → 200 gets job', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/backup/jobs/${jobId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.id).toBe(jobId);
    });

    it('PATCH /api/v1/backup/jobs/:id/status → 200 updates status', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/backup/jobs/${jobId}/status`, headers: auth(),
        payload: { status: 'completed', size_bytes: 1024000 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('completed');
      expect(Number(body.data.size_bytes)).toBe(1024000);
    });

    it('tenant isolation — Beta cannot see Acme jobs', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/backup/jobs/${jobId}`, headers: betaAuth() });
      expect(res.statusCode).toBe(404);
    });
  });

  /* ═══════════════════════════════════════════
   * RESTORE POINTS CRUD
   * ═══════════════════════════════════════════ */
  describe('Restore Points', () => {
    it('POST /api/v1/backup/restores → 201 creates a restore point', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/backup/restores', headers: auth(),
        payload: { backup_job_id: jobId, label: 'Restore to Jan 1' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.label).toBe('Restore to Jan 1');
      expect(body.data.status).toBe('pending');
      restoreId = body.data.id;
    });

    it('GET /api/v1/backup/restores → 200 lists restore points', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/backup/restores', headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/backup/restores/:id → 200 gets restore point', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/backup/restores/${restoreId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.id).toBe(restoreId);
    });

    it('PATCH /api/v1/backup/restores/:id/status → 200 updates status', async () => {
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/backup/restores/${restoreId}/status`, headers: auth(),
        payload: { status: 'completed' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.status).toBe('completed');
    });

    it('tenant isolation — Beta cannot see Acme restores', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/backup/restores/${restoreId}`, headers: betaAuth() });
      expect(res.statusCode).toBe(404);
    });
  });

  /* ═══════════════════════════════════════════
   * CLEANUP — DELETE
   * ═══════════════════════════════════════════ */
  describe('Cleanup', () => {
    it('DELETE /api/v1/backup/jobs/:id → 200 deletes job', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/backup/jobs/${jobId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
    });

    it('DELETE /api/v1/backup/policies/:id → 200 deletes policy', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/backup/policies/${policyId}`, headers: auth() });
      expect(res.statusCode).toBe(200);
    });
  });

  /* ═══════════════════════════════════════════
   * COMPLIANCE CHECKS
   * ═══════════════════════════════════════════ */
  describe('Compliance', () => {
    it('RLS enabled on all mod_backup tables', async () => {
      const result = await adminSql`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'mod_backup' AND rowsecurity = true
        ORDER BY tablename`;
      const tables = result.map(r => r.tablename);
      expect(tables).toContain('retention_policies');
      expect(tables).toContain('backup_jobs');
      expect(tables).toContain('restore_points');
      expect(tables.length).toBe(3);
    });

    it('no cross-schema foreign keys', async () => {
      const result = await adminSql`
        SELECT conname, conrelid::regclass, confrelid::regclass
        FROM pg_constraint
        WHERE contype = 'f'
          AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'mod_backup')`;
      expect(result.length).toBe(0);
    });

    it('source code has no pg_dump, no fs.write, no S3, no scheduler', () => {
      const files = ['backup.service.ts', 'backup.actions.ts', 'backup.routes.ts', 'migrate.ts'];
      for (const f of files) {
        const content = fs.readFileSync(`packages/modules/backup/src/${f}`, 'utf-8');
        expect(content).not.toMatch(/pg_dump|pg_restore/i);
        expect(content).not.toMatch(/fs\.write|writeFileSync/i);
        expect(content).not.toMatch(/aws-sdk|@aws-sdk|S3Client/i);
        expect(content).not.toMatch(/setInterval|setTimeout|cron|schedule/i);
      }
    });

    it('no cross-schema queries in service', () => {
      const content = fs.readFileSync('packages/modules/backup/src/backup.service.ts', 'utf-8');
      expect(content).not.toMatch(/kernel\./);
      expect(content).not.toMatch(/mod_ai\./);
      expect(content).not.toMatch(/mod_observability\./);
    });
  });
});

/**
 * Step 15 — M17 File Manager tests
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Metadata-only: no binary storage, no file uploads.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let folderId: string;
let subFolderId: string;
let fileId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  const loginBody = JSON.parse(loginRes.body);
  token = loginBody.data.token.access_token;
});

afterAll(async () => {
  await app?.close();
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe('M17 File Manager', () => {

  // ──── Folder CRUD ────

  it('POST /folders → 201 creates a root folder', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/file-manager/folders',
      headers: auth(),
      payload: { name: 'Documents' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Documents');
    expect(body.data.parent_id).toBeNull();
    folderId = body.data.id;
  });

  it('POST /folders → 201 creates a sub-folder', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/file-manager/folders',
      headers: auth(),
      payload: { name: 'Reports', parent_id: folderId },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Reports');
    expect(body.data.parent_id).toBe(folderId);
    subFolderId = body.data.id;
  });

  it('GET /folders → lists root folders', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/file-manager/folders',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /folders?parent_id → lists sub-folders', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/file-manager/folders?parent_id=${folderId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.some((f: any) => f.id === subFolderId)).toBe(true);
  });

  it('GET /folders/:id → returns single folder', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/file-manager/folders/${folderId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(folderId);
  });

  it('PATCH /folders/:id → renames folder', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/file-manager/folders/${folderId}`,
      headers: auth(),
      payload: { name: 'My Documents' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('My Documents');
  });

  it('POST /folders → 400 rejects empty name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/file-manager/folders',
      headers: auth(),
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  // ──── File CRUD (metadata only) ────

  it('POST /files → 201 creates file metadata', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/file-manager/files',
      headers: auth(),
      payload: {
        name: 'report-q1.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1048576,
        folder_id: folderId,
        tags: ['quarterly', 'finance'],
        metadata: { author: 'system' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('report-q1.pdf');
    expect(body.data.mime_type).toBe('application/pdf');
    expect(body.data.size_bytes).toBe(1048576);
    expect(body.data.category).toBe('document');
    expect(body.data.status).toBe('active');
    expect(body.data.folder_id).toBe(folderId);
    fileId = body.data.id;
  });

  it('POST /files → auto-infers category from mime_type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/file-manager/files',
      headers: auth(),
      payload: {
        name: 'logo.png',
        mime_type: 'image/png',
        size_bytes: 204800,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.category).toBe('image');
    expect(body.data.folder_id).toBeNull();
  });

  it('GET /files → lists files in root', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/file-manager/files',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /files?folder_id → lists files in folder', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/file-manager/files?folder_id=${folderId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.some((f: any) => f.id === fileId)).toBe(true);
  });

  it('GET /files/:id → returns single file metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/file-manager/files/${fileId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(fileId);
  });

  it('PATCH /files/:id → updates file metadata', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/file-manager/files/${fileId}`,
      headers: auth(),
      payload: { name: 'report-q1-final.pdf', tags: ['quarterly', 'finance', 'final'] },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('report-q1-final.pdf');
    expect(body.data.tags).toContain('final');
  });

  it('POST /files/:id/move → moves file to sub-folder', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/file-manager/files/${fileId}/move`,
      headers: auth(),
      payload: { folder_id: subFolderId },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.folder_id).toBe(subFolderId);
  });

  it('POST /files/:id/archive → archives file', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/file-manager/files/${fileId}/archive`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('archived');
  });

  it('POST /files → 400 rejects missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/file-manager/files',
      headers: auth(),
      payload: { name: 'test.txt' },
    });
    expect(res.statusCode).toBe(400);
  });

  // ──── Tenant isolation ────

  it('Tenant B cannot see Tenant A files', async () => {
    // Login as tenant B (beta)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
    });
    const tokenB = JSON.parse(loginRes.body).data.token.access_token;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/file-manager/files',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const tenantAFiles = body.data.filter((f: any) => f.id === fileId);
    expect(tenantAFiles.length).toBe(0);
  });

  it('Tenant B cannot see Tenant A folders', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
    });
    const tokenB = JSON.parse(loginRes.body).data.token.access_token;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/file-manager/folders',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const tenantAFolders = body.data.filter((f: any) => f.id === folderId);
    expect(tenantAFolders.length).toBe(0);
  });

  // ──── Cleanup ────

  it('DELETE /files/:id → deletes file metadata', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/file-manager/files/${fileId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /folders/:id → deletes folder (cascade)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/file-manager/folders/${folderId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(204);
  });

  // ──── Audit trail ────

  it('Audit log contains file_manager events', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const items = body.data.items || body.data;
    const fmEvents = items.filter(
      (e: any) => e.action_id?.startsWith('rasid.mod.file_manager'),
    );
    expect(fmEvents.length).toBeGreaterThan(0);
  });
});

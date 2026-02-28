/**
 * M15 Forms Builder — Full Test Suite
 *
 * Tests:
 * 1. Form CRUD (create, list, get, update, delete)
 * 2. Form lifecycle (publish, archive)
 * 3. Submission CRUD (create, list, get, delete)
 * 4. Validation (missing required fields)
 * 5. Tenant isolation (Tenant B cannot see Tenant A data)
 * 6. RBAC enforcement (viewer cannot create forms)
 * 7. Audit trail (K3 pipeline emits audit entries)
 * 8. Page reference by ID only (no FK validation)
 * 9. Cascade delete (deleting form deletes submissions)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let tokenA: string;
let tokenB: string;
let viewerToken: string;

async function login(app: FastifyInstance, email: string, password: string, slug: string): Promise<string> {
  const res = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email, password, tenant_slug: slug },
  });
  return res.json().data.token.access_token;
}

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();
  tokenA = await login(app, 'admin@acme.com', 'Admin123!', 'acme');
  tokenB = await login(app, 'admin@beta.com', 'Admin123!', 'beta');
  viewerToken = await login(app, 'viewer@acme.com', 'Viewer123!', 'acme');
});

afterAll(async () => { await app.close(); });

const BASE = '/api/v1/forms';

const sampleFields = [
  { field_id: 'name', label: 'Full Name', type: 'text' as const, required: true },
  { field_id: 'email', label: 'Email', type: 'email' as const, required: true },
  { field_id: 'age', label: 'Age', type: 'number' as const },
];

describe('M15 Forms Builder — Form CRUD', () => {
  let formId: string;

  it('POST /api/v1/forms — creates a form', async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Contact Form', description: 'A simple contact form', fields: sampleFields },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Contact Form');
    expect(body.data.status).toBe('draft');
    expect(body.data.fields).toHaveLength(3);
    expect(body.audit_id).toBeDefined();
    formId = body.data.id;
  });

  it('GET /api/v1/forms — lists forms', async () => {
    const res = await app.inject({
      method: 'GET', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/forms/:id — gets a form', async () => {
    const res = await app.inject({
      method: 'GET', url: `${BASE}/${formId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(formId);
  });

  it('PATCH /api/v1/forms/:id — updates a form', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `${BASE}/${formId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Updated Contact Form', description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Contact Form');
    expect(res.json().audit_id).toBeDefined();
  });

  it('DELETE /api/v1/forms/:id — deletes a form', async () => {
    // Create a throwaway form
    const createRes = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Throwaway', fields: sampleFields },
    });
    const throwawayId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE', url: `${BASE}/${throwawayId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);

    // Verify it's gone
    const getRes = await app.inject({
      method: 'GET', url: `${BASE}/${throwawayId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(getRes.statusCode).toBe(404);
  });
});

describe('M15 Forms Builder — Form Lifecycle', () => {
  let formId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Lifecycle Form', fields: sampleFields },
    });
    formId = res.json().data.id;
  });

  it('POST /api/v1/forms/:id/publish — publishes a form', async () => {
    const res = await app.inject({
      method: 'POST', url: `${BASE}/${formId}/publish`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('published');
  });

  it('POST /api/v1/forms/:id/archive — archives a form', async () => {
    const res = await app.inject({
      method: 'POST', url: `${BASE}/${formId}/archive`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('archived');
  });
});

describe('M15 Forms Builder — Submission CRUD', () => {
  let formId: string;
  let submissionId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Submission Test Form', fields: sampleFields },
    });
    formId = res.json().data.id;
  });

  it('POST /api/v1/forms/:id/submissions — creates a submission', async () => {
    const res = await app.inject({
      method: 'POST', url: `${BASE}/${formId}/submissions`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { data: { name: 'John Doe', email: 'john@example.com', age: 30 } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.form_id).toBe(formId);
    expect(body.data.data.name).toBe('John Doe');
    expect(body.audit_id).toBeDefined();
    submissionId = body.data.id;
  });

  it('GET /api/v1/forms/:id/submissions — lists submissions', async () => {
    const res = await app.inject({
      method: 'GET', url: `${BASE}/${formId}/submissions`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/forms/:id/submissions/:submissionId — gets a submission', async () => {
    const res = await app.inject({
      method: 'GET', url: `${BASE}/${formId}/submissions/${submissionId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(submissionId);
  });

  it('DELETE /api/v1/forms/:id/submissions/:submissionId — deletes a submission', async () => {
    // Create another submission to delete
    const createRes = await app.inject({
      method: 'POST', url: `${BASE}/${formId}/submissions`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { data: { name: 'To Delete', email: 'del@example.com' } },
    });
    const delId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE', url: `${BASE}/${formId}/submissions/${delId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);
  });
});

describe('M15 Forms Builder — Validation', () => {
  it('POST /api/v1/forms — missing name returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { fields: sampleFields },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/forms — missing fields returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'No Fields Form' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/forms — empty fields array returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Empty Fields', fields: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/forms/:id/submissions — missing data returns 400', async () => {
    // Create a form first
    const createRes = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Validation Form', fields: sampleFields },
    });
    const formId = createRes.json().data.id;

    const res = await app.inject({
      method: 'POST', url: `${BASE}/${formId}/submissions`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('M15 Forms Builder — Page Reference by ID', () => {
  it('POST /api/v1/forms — accepts page_id as plain string (no FK validation)', async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Page Ref Form', fields: sampleFields, page_id: 'some-page-id-12345' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.page_id).toBe('some-page-id-12345');
  });
});

describe('M15 Forms Builder — Tenant Isolation', () => {
  let formIdA: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Tenant A Form', fields: sampleFields },
    });
    formIdA = res.json().data.id;
  });

  it('Tenant B cannot see Tenant A forms', async () => {
    const res = await app.inject({
      method: 'GET', url: BASE,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.map((f: any) => f.id);
    expect(ids).not.toContain(formIdA);
  });

  it('Tenant B cannot get Tenant A form by ID', async () => {
    const res = await app.inject({
      method: 'GET', url: `${BASE}/${formIdA}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('M15 Forms Builder — RBAC Enforcement', () => {
  it('Viewer cannot create forms (403)', async () => {
    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: 'Viewer Form', fields: sampleFields },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('M15 Forms Builder — Cascade Delete', () => {
  it('Deleting a form also deletes its submissions', async () => {
    // Create form
    const formRes = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Cascade Form', fields: sampleFields },
    });
    const formId = formRes.json().data.id;

    // Create submission
    await app.inject({
      method: 'POST', url: `${BASE}/${formId}/submissions`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { data: { name: 'Cascade Sub', email: 'c@test.com' } },
    });

    // Delete form
    const delRes = await app.inject({
      method: 'DELETE', url: `${BASE}/${formId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(delRes.statusCode).toBe(200);

    // Submissions should be gone too
    const subRes = await app.inject({
      method: 'GET', url: `${BASE}/${formId}/submissions`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(subRes.statusCode).toBe(200);
    expect(subRes.json().data).toHaveLength(0);
  });
});

describe('M15 Forms Builder — Audit Trail', () => {
  it('Form creation generates audit entry', async () => {
    const createRes = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Audit Form', fields: sampleFields },
    });
    expect(createRes.statusCode).toBe(201);
    const auditId = createRes.json().audit_id;
    expect(auditId).toBeDefined();

    // Check audit log
    const auditRes = await app.inject({
      method: 'GET', url: '/api/v1/audit',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const entries = auditRes.json().data.items || auditRes.json().data;
    const found = entries.find((e: any) => e.id === auditId);
    expect(found).toBeDefined();
  });
});

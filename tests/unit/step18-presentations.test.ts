/**
 * M16 Presentations — Test Suite
 *
 * Tests: CRUD, slides, status transitions, tenant isolation, RBAC, audit trail
 * Metadata-only — no PPTX, no PDF, no rendering
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let tokenA: string;
let tokenB: string;
let viewerToken: string;

async function login(a: FastifyInstance, email: string, password: string, slug: string): Promise<string> {
  const res = await a.inject({
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
}, 30_000);

afterAll(async () => { await app.close(); });

const h = (t: string) => ({ authorization: `Bearer ${t}` });

describe('M16 Presentations — CRUD', () => {
  let presId: string;

  it('POST /api/v1/presentations — creates presentation', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(tokenA),
      payload: { name: 'Q1 Review', description: 'Quarterly review deck' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Q1 Review');
    expect(body.data.status).toBe('draft');
    expect(body.data.slides).toEqual([]);
    expect(body.meta.audit_id).toBeDefined();
    presId = body.data.id;
  });

  it('GET /api/v1/presentations — lists presentations', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/presentations',
      headers: h(tokenA),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/presentations/:id — returns single presentation', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/presentations/${presId}`,
      headers: h(tokenA),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(presId);
  });

  it('PATCH /api/v1/presentations/:id — updates presentation', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/presentations/${presId}`,
      headers: h(tokenA),
      payload: { name: 'Q1 Review Updated', description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Q1 Review Updated');
    expect(res.json().meta.audit_id).toBeDefined();
  });

  it('POST /api/v1/presentations — validation: missing name returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(tokenA),
      payload: { description: 'No name' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /api/v1/presentations/:id — deletes presentation', async () => {
    // Create one to delete
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(tokenA),
      payload: { name: 'To Delete' },
    });
    const delId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/presentations/${delId}`,
      headers: h(tokenA),
    });
    expect(res.statusCode).toBe(204);

    // Verify deleted
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/presentations/${delId}`,
      headers: h(tokenA),
    });
    expect(getRes.statusCode).toBe(404);
  });
});

describe('M16 Presentations — Slide Management', () => {
  let presId: string;
  let slideId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(tokenA),
      payload: { name: 'Slide Deck' },
    });
    presId = res.json().data.id;
  });

  it('POST /presentations/:id/slides — adds slide with report reference', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/presentations/${presId}/slides`,
      headers: h(tokenA),
      payload: {
        title: 'Revenue Overview',
        layout: 'single_chart',
        content: { report_id: '01234567-89ab-cdef-0123-456789abcdef', notes: 'Key metrics' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.title).toBe('Revenue Overview');
    expect(body.data.id).toBeDefined();
    slideId = body.data.id;
  });

  it('POST /presentations/:id/slides — adds second slide', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/presentations/${presId}/slides`,
      headers: h(tokenA),
      payload: {
        title: 'Cost Analysis',
        layout: 'two_column',
        content: { report_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('GET /presentations/:id — returns presentation with slides', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/presentations/${presId}`,
      headers: h(tokenA),
    });
    expect(res.statusCode).toBe(200);
    const slides = res.json().data.slides;
    expect(slides.length).toBe(2);
    expect(slides[0].sort_order).toBe(0);
    expect(slides[1].sort_order).toBe(1);
  });

  it('PATCH /presentations/:id/slides/:slideId — updates slide', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/presentations/${presId}/slides/${slideId}`,
      headers: h(tokenA),
      payload: { title: 'Revenue Overview v2', layout: 'full_width' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.title).toBe('Revenue Overview v2');
  });

  it('POST /presentations/:id/slides — validation: missing title returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/presentations/${presId}/slides`,
      headers: h(tokenA),
      payload: { layout: 'single_chart' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /presentations/:id/slides/reorder — reorders slides', async () => {
    // Get current slides
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/presentations/${presId}`,
      headers: h(tokenA),
    });
    const slides = getRes.json().data.slides;
    const ids = slides.map((s: any) => s.id).reverse();

    const res = await app.inject({
      method: 'POST', url: `/api/v1/presentations/${presId}/slides/reorder`,
      headers: h(tokenA),
      payload: { slide_ids: ids },
    });
    expect(res.statusCode).toBe(200);

    // Verify order
    const verifyRes = await app.inject({
      method: 'GET', url: `/api/v1/presentations/${presId}`,
      headers: h(tokenA),
    });
    const reordered = verifyRes.json().data.slides;
    expect(reordered[0].id).toBe(ids[0]);
    expect(reordered[1].id).toBe(ids[1]);
  });

  it('DELETE /presentations/:id/slides/:slideId — removes slide', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/presentations/${presId}/slides/${slideId}`,
      headers: h(tokenA),
    });
    expect(res.statusCode).toBe(204);

    // Verify removed
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/presentations/${presId}`,
      headers: h(tokenA),
    });
    const remaining = getRes.json().data.slides;
    expect(remaining.find((s: any) => s.id === slideId)).toBeUndefined();
  });
});

describe('M16 Presentations — Status Transitions', () => {
  let presId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(tokenA),
      payload: { name: 'Status Test' },
    });
    presId = res.json().data.id;
  });

  it('POST /presentations/:id/publish — draft → published', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/presentations/${presId}/publish`,
      headers: h(tokenA),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('published');
  });

  it('POST /presentations/:id/archive — published → archived', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/presentations/${presId}/archive`,
      headers: h(tokenA),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('archived');
  });
});

describe('M16 Presentations — Tenant Isolation', () => {
  let presIdA: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(tokenA),
      payload: { name: 'Tenant A Deck' },
    });
    presIdA = res.json().data.id;
  });

  it('Tenant B cannot see Tenant A presentations', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/presentations',
      headers: h(tokenB),
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.map((p: any) => p.id);
    expect(ids).not.toContain(presIdA);
  });

  it('Tenant B cannot access Tenant A presentation by ID', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/presentations/${presIdA}`,
      headers: h(tokenB),
    });
    expect(res.statusCode).toBe(404);
  });

  it('Tenant B cannot update Tenant A presentation', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/presentations/${presIdA}`,
      headers: h(tokenB),
      payload: { name: 'Hijacked' },
    });
    expect([404, 500]).toContain(res.statusCode);
  });

  it('Tenant B cannot delete Tenant A presentation', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/presentations/${presIdA}`,
      headers: h(tokenB),
    });
    expect([204, 404, 500]).toContain(res.statusCode);

    // Verify still exists for Tenant A
    const verify = await app.inject({
      method: 'GET', url: `/api/v1/presentations/${presIdA}`,
      headers: h(tokenA),
    });
    expect(verify.statusCode).toBe(200);
  });
});

describe('M16 Presentations — RBAC', () => {
  it('Viewer cannot create presentations (no presentations.create permission)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(viewerToken),
      payload: { name: 'Viewer Deck' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('No auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/presentations',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('M16 Presentations — Audit Trail', () => {
  it('Presentation creation generates audit entry', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(tokenA),
      payload: { name: 'Audit Test Deck' },
    });
    expect(createRes.statusCode).toBe(201);

    const auditRes = await app.inject({
      method: 'GET', url: '/api/v1/audit',
      headers: h(tokenA),
    });
    expect(auditRes.statusCode).toBe(200);
    const body = auditRes.json();
    const entries = body.data?.items || body.data;
    const found = entries.find((e: any) =>
      e.action_id === 'rasid.mod.presentations.presentation.create'
    );
    expect(found).toBeDefined();
  });
});

describe('M16 Presentations — Metadata-Only Proof', () => {
  it('Slides store report_id as plain string reference, not FK', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/presentations',
      headers: h(tokenA),
      payload: { name: 'Metadata Proof' },
    });
    const presId = createRes.json().data.id;

    // Add slide with arbitrary report_id (no validation against mod_reports)
    const slideRes = await app.inject({
      method: 'POST', url: `/api/v1/presentations/${presId}/slides`,
      headers: h(tokenA),
      payload: {
        title: 'Fake Report Ref',
        layout: 'single_chart',
        content: { report_id: 'non-existent-report-id-12345' },
      },
    });
    expect(slideRes.statusCode).toBe(201);
    expect(slideRes.json().data.content.report_id).toBe('non-existent-report-id-12345');
  });
});

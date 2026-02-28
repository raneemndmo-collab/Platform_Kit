/**
 * M14 Custom Pages — Full Test Suite
 *
 * Tests: CRUD, sections, status transitions, tenant isolation, RBAC, audit, validation
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let tokenA: string;
let tokenB: string;

async function login(a: FastifyInstance, email: string, password: string, slug: string): Promise<string> {
  const r = await a.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password, tenant_slug: slug } });
  return r.json().data.token.access_token;
}

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();
  tokenA = await login(app, 'admin@acme.com', 'Admin123!', 'acme');
  tokenB = await login(app, 'admin@beta.com', 'Admin123!', 'beta');
}, 30_000);

afterAll(async () => { await app.close(); });

const H = (t: string) => ({ authorization: `Bearer ${t}` });

describe('M14 Custom Pages — Page CRUD', () => {
  let pageId: string;

  it('POST /api/v1/pages — creates a page', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: { name: 'Overview Page', description: 'Main overview', icon: 'layout' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Overview Page');
    expect(body.data.slug).toBe('overview-page');
    expect(body.data.status).toBe('draft');
    expect(body.data.sections).toEqual([]);
    expect(body.data.layout).toEqual({});
    expect(body.meta.audit_id).toBeDefined();
    pageId = body.data.id;
  });

  it('GET /api/v1/pages — lists pages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/pages', headers: H(tokenA) });
    expect(res.statusCode).toBe(200);
    const items = res.json().data;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/pages/:id — returns page', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pages/${pageId}`, headers: H(tokenA) });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(pageId);
  });

  it('PATCH /api/v1/pages/:id — updates page', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/pages/${pageId}`, headers: H(tokenA),
      payload: { name: 'Updated Overview', description: 'Updated desc' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Overview');
    expect(res.json().data.description).toBe('Updated desc');
  });

  it('DELETE /api/v1/pages/:id — deletes page', async () => {
    // Create a throwaway page
    const cr = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: { name: 'To Delete' },
    });
    const delId = cr.json().data.id;
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/pages/${delId}`, headers: H(tokenA) });
    expect(res.statusCode).toBe(204);
    // Verify gone
    const get = await app.inject({ method: 'GET', url: `/api/v1/pages/${delId}`, headers: H(tokenA) });
    expect(get.statusCode).toBe(404);
  });

  it('GET /api/v1/pages/:id — non-existent returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/pages/00000000-0000-0000-0000-000000000000', headers: H(tokenA) });
    expect(res.statusCode).toBe(404);
  });
});

describe('M14 Custom Pages — Status Transitions', () => {
  let pageId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: { name: 'Status Test Page' },
    });
    pageId = res.json().data.id;
  });

  it('POST /api/v1/pages/:id/publish — publishes page', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/v1/pages/${pageId}/publish`, headers: H(tokenA) });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('published');
  });

  it('POST /api/v1/pages/:id/archive — archives page', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/v1/pages/${pageId}/archive`, headers: H(tokenA) });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('archived');
  });
});

describe('M14 Custom Pages — Section Management', () => {
  let pageId: string;
  let sectionId1: string;
  let sectionId2: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: { name: 'Section Test Page' },
    });
    pageId = res.json().data.id;
  });

  it('POST /api/v1/pages/:id/sections — adds dashboard_embed section', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/pages/${pageId}/sections`, headers: H(tokenA),
      payload: { section_type: 'dashboard_embed', reference_id: 'some-dashboard-id', config: { height: 400 } },
    });
    expect(res.statusCode).toBe(201);
    const sections = res.json().data.sections;
    expect(sections.length).toBe(1);
    expect(sections[0].section_type).toBe('dashboard_embed');
    expect(sections[0].reference_id).toBe('some-dashboard-id');
    expect(sections[0].config.height).toBe(400);
    sectionId1 = sections[0].id;
  });

  it('POST /api/v1/pages/:id/sections — adds report_embed section', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/pages/${pageId}/sections`, headers: H(tokenA),
      payload: { section_type: 'report_embed', reference_id: 'some-report-id' },
    });
    expect(res.statusCode).toBe(201);
    const sections = res.json().data.sections;
    expect(sections.length).toBe(2);
    sectionId2 = sections[1].id;
  });

  it('POST /api/v1/pages/:id/sections — adds text_block section', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/pages/${pageId}/sections`, headers: H(tokenA),
      payload: { section_type: 'text_block', config: { content: 'Welcome to the page' } },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.sections.length).toBe(3);
  });

  it('PATCH /api/v1/pages/:id/sections/:sectionId — updates section', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/pages/${pageId}/sections/${sectionId1}`, headers: H(tokenA),
      payload: { config: { height: 600 } },
    });
    expect(res.statusCode).toBe(200);
    const s = res.json().data.sections.find((s: any) => s.id === sectionId1);
    expect(s.config.height).toBe(600);
  });

  it('POST /api/v1/pages/:id/sections/reorder — reorders sections', async () => {
    const getRes = await app.inject({ method: 'GET', url: `/api/v1/pages/${pageId}`, headers: H(tokenA) });
    const allIds = getRes.json().data.sections.map((s: any) => s.id);
    const reversed = [...allIds].reverse();
    const res = await app.inject({
      method: 'POST', url: `/api/v1/pages/${pageId}/sections/reorder`, headers: H(tokenA),
      payload: { section_ids: reversed },
    });
    expect(res.statusCode).toBe(200);
    const sections = res.json().data.sections;
    expect(sections[0].id).toBe(reversed[0]);
    expect(sections[0].order).toBe(0);
  });

  it('DELETE /api/v1/pages/:id/sections/:sectionId — removes section', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/pages/${pageId}/sections/${sectionId2}`, headers: H(tokenA),
    });
    expect(res.statusCode).toBe(204);
    // Verify removed
    const getRes = await app.inject({ method: 'GET', url: `/api/v1/pages/${pageId}`, headers: H(tokenA) });
    const ids = getRes.json().data.sections.map((s: any) => s.id);
    expect(ids).not.toContain(sectionId2);
  });
});

describe('M14 Custom Pages — Sections reference by ID only (no FK)', () => {
  it('can reference any arbitrary string as dashboard/report ID', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: {
        name: 'Reference Test',
        sections: [
          { section_type: 'dashboard_embed', reference_id: 'non-existent-dashboard-uuid' },
          { section_type: 'report_embed', reference_id: 'non-existent-report-uuid' },
          { section_type: 'spacer' },
          { section_type: 'divider' },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const sections = res.json().data.sections;
    expect(sections.length).toBe(4);
    expect(sections[0].reference_id).toBe('non-existent-dashboard-uuid');
    expect(sections[1].reference_id).toBe('non-existent-report-uuid');
  });
});

describe('M14 Custom Pages — Validation', () => {
  it('POST /api/v1/pages — missing name returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: { description: 'no name' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/pages/:id/sections — invalid section_type returns 400', async () => {
    const cr = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: { name: 'Validation Test' },
    });
    const pageId = cr.json().data.id;
    const res = await app.inject({
      method: 'POST', url: `/api/v1/pages/${pageId}/sections`, headers: H(tokenA),
      payload: { section_type: 'invalid_type' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('M14 Custom Pages — Tenant Isolation', () => {
  let pageIdA: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: { name: 'Tenant A Page' },
    });
    pageIdA = res.json().data.id;
  });

  it('Tenant B cannot see Tenant A pages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/pages', headers: H(tokenB) });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.map((p: any) => p.id);
    expect(ids).not.toContain(pageIdA);
  });

  it('Tenant B cannot access Tenant A page by ID', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pages/${pageIdA}`, headers: H(tokenB) });
    expect(res.statusCode).toBe(404);
  });

  it('Tenant B cannot update Tenant A page', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/pages/${pageIdA}`, headers: H(tokenB),
      payload: { name: 'Hacked' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('Tenant B cannot delete Tenant A page', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/pages/${pageIdA}`, headers: H(tokenB) });
    // Should return 204 (no rows deleted) — page still exists for A
    const getA = await app.inject({ method: 'GET', url: `/api/v1/pages/${pageIdA}`, headers: H(tokenA) });
    expect(getA.statusCode).toBe(200);
  });
});

describe('M14 Custom Pages — RBAC (viewer denied)', () => {
  let viewerToken: string;

  beforeAll(async () => {
    viewerToken = await login(app, 'viewer@acme.com', 'Viewer123!', 'acme');
  });

  it('viewer cannot create page', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(viewerToken),
      payload: { name: 'Viewer Page' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('M14 Custom Pages — No auth returns 401', () => {
  it('GET /api/v1/pages without token returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/pages' });
    expect(res.statusCode).toBe(401);
  });
});

describe('M14 Custom Pages — Audit Trail', () => {
  it('page creation is audited', async () => {
    const cr = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: { name: 'Audit Test Page' },
    });
    expect(cr.statusCode).toBe(201);
    const auditId = cr.json().meta.audit_id;
    expect(auditId).toBeDefined();

    const res = await app.inject({ method: 'GET', url: '/api/v1/audit', headers: H(tokenA) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const entries = body.data.items || body.data;
    const entry = entries.find((e: any) => e.id === auditId);
    expect(entry).toBeDefined();
    expect(entry.action_id).toBe('rasid.mod.custom_pages.page.create');
  });
});

describe('M14 Custom Pages — Metadata-only proof', () => {
  it('page contains only metadata, no HTML or rendering logic', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pages', headers: H(tokenA),
      payload: {
        name: 'Metadata Proof',
        layout: { columns: 2, gap: '16px' },
        sections: [
          { section_type: 'dashboard_embed', reference_id: 'dash-123', config: { title: 'Sales', height: 400 } },
          { section_type: 'text_block', config: { content: 'Summary text' } },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const page = res.json().data;
    // Verify pure metadata — no HTML, no rendering
    const json = JSON.stringify(page);
    expect(json).not.toContain('<html');
    expect(json).not.toContain('<div');
    expect(json).not.toContain('render');
    expect(json).not.toContain('template');
    // Verify sections store IDs only, not embedded data
    expect(page.sections[0].reference_id).toBe('dash-123');
    expect(page.sections[0]).not.toHaveProperty('dashboard');
    expect(page.sections[0]).not.toHaveProperty('embedded_data');
  });
});

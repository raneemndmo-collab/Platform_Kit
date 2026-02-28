/**
 * Step 14 — M9 Dashboard Engine tests
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Dashboard is read-only consumer of semantic layer.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let dashboardId: string;
let widgetId: string;
let shareId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();

  // Login
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

describe('M9 Dashboard Engine', () => {

  // ---- Dashboard CRUD ----

  it('POST /api/v1/dashboards → 201 creates a dashboard', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards',
      headers: auth(),
      payload: {
        name: 'Sales Overview',
        description: 'Monthly sales dashboard',
        layout: [{ row: 0, col: 0, w: 6, h: 4 }],
        filters: [{ field: 'region', operator: 'eq', value: 'SA' }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Sales Overview');
    expect(body.data.status).toBe('draft');
    expect(body.meta.audit_id).toBeDefined();
    dashboardId = body.data.id;
  });

  it('GET /api/v1/dashboards → 200 lists dashboards', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/dashboards/:id → 200 returns dashboard', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboards/${dashboardId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(dashboardId);
    expect(body.data.name).toBe('Sales Overview');
  });

  it('PATCH /api/v1/dashboards/:id → 200 updates dashboard', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dashboards/${dashboardId}`,
      headers: auth(),
      payload: { name: 'Sales Overview v2' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Sales Overview v2');
  });

  it('POST /api/v1/dashboards/:id/publish → 200 publishes dashboard', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/publish`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('published');
  });

  // ---- Widget CRUD ----

  it('POST /api/v1/dashboards/:id/widgets → 201 adds a widget', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/widgets`,
      headers: auth(),
      payload: {
        title: 'Revenue KPI',
        widget_type: 'kpi_card',
        config: { color: 'blue' },
        position: { x: 0, y: 0, w: 4, h: 3 },
        data_source: { kpi_name: 'Total Revenue', model_id: 'simulated' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Revenue KPI');
    expect(body.data.widget_type).toBe('kpi_card');
    widgetId = body.data.id;
  });

  it('GET /api/v1/dashboards/:id/widgets → 200 lists widgets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboards/${dashboardId}/widgets`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/dashboards/:id/widgets/:widgetId → 200 returns widget', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboards/${dashboardId}/widgets/${widgetId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(widgetId);
  });

  it('PATCH /api/v1/dashboards/:id/widgets/:widgetId → 200 updates widget', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dashboards/${dashboardId}/widgets/${widgetId}`,
      headers: auth(),
      payload: { title: 'Revenue KPI v2' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Revenue KPI v2');
  });

  // ---- Widget Data Query (semantic layer) ----

  it('GET /api/v1/dashboards/:id/widgets/:widgetId/query → 200 returns simulated data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboards/${dashboardId}/widgets/${widgetId}/query`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.widget_id).toBe(widgetId);
    expect(body.data.widget_type).toBe('kpi_card');
    expect(body.data.result.source).toBe('semantic_layer_simulated');
    expect(body.data.queried_at).toBeDefined();
  });

  // ---- Sharing ----

  it('POST /api/v1/dashboards/:id/shares → 201 shares dashboard', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/shares`,
      headers: auth(),
      payload: {
        shared_with_type: 'user',
        shared_with_id: '019ca000-0000-7000-8000-000000000001',
        permission_level: 'view',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.shared_with_type).toBe('user');
    expect(body.data.permission_level).toBe('view');
    shareId = body.data.id;
  });

  it('GET /api/v1/dashboards/:id/shares → 200 lists shares', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboards/${dashboardId}/shares`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('DELETE /api/v1/dashboards/:id/shares/:shareId → 200 removes share', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/dashboards/${dashboardId}/shares/${shareId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
  });

  // ---- Audit trail ----

  it('Audit log contains dashboard actions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const items = body.data.items || body.data;
    const dashboardAudits = items.filter((a: any) => a.action_id?.startsWith('rasid.mod.dashboard'));
    expect(dashboardAudits.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Cleanup ----

  it('DELETE /api/v1/dashboards/:id/widgets/:widgetId → 200 removes widget', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/dashboards/${dashboardId}/widgets/${widgetId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
  });

  it('DELETE /api/v1/dashboards/:id → 200 deletes dashboard', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/dashboards/${dashboardId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
  });

  // ---- Validation ----

  it('POST /api/v1/dashboards without name → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards',
      headers: auth(),
      payload: { description: 'No name' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/dashboards/:id/widgets without title → 400', async () => {
    // Create a temp dashboard first
    const dRes = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards',
      headers: auth(),
      payload: { name: 'Temp' },
    });
    const tempId = JSON.parse(dRes.body).data.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${tempId}/widgets`,
      headers: auth(),
      payload: { widget_type: 'kpi_card' },
    });
    expect(res.statusCode).toBe(400);

    // Cleanup
    await app.inject({ method: 'DELETE', url: `/api/v1/dashboards/${tempId}`, headers: auth() });
  });

  // ---- Query isolation: no cross-schema access ----

  it('Widget query returns only simulated data, no cross-schema data', async () => {
    // Create dashboard + widget
    const dRes = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards',
      headers: auth(),
      payload: { name: 'Isolation Test' },
    });
    const dId = JSON.parse(dRes.body).data.id;

    const wRes = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dId}/widgets`,
      headers: auth(),
      payload: { title: 'Bar Chart', widget_type: 'bar_chart', data_source: { model_id: 'test' } },
    });
    const wId = JSON.parse(wRes.body).data.id;

    const qRes = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboards/${dId}/widgets/${wId}/query`,
      headers: auth(),
    });
    expect(qRes.statusCode).toBe(200);
    const qBody = JSON.parse(qRes.body);
    expect(qBody.data.result.source).toBe('semantic_layer_simulated');
    expect(qBody.data.result.labels).toBeDefined();
    expect(qBody.data.result.series).toBeDefined();

    // Cleanup
    await app.inject({ method: 'DELETE', url: `/api/v1/dashboards/${dId}/widgets/${wId}`, headers: auth() });
    await app.inject({ method: 'DELETE', url: `/api/v1/dashboards/${dId}`, headers: auth() });
  });

  // ---- Tenant isolation ----

  it('Beta tenant cannot see Acme dashboards', async () => {
    // Create dashboard as Acme
    const dRes = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboards',
      headers: auth(),
      payload: { name: 'Acme Only Dashboard' },
    });
    const acmeDashId = JSON.parse(dRes.body).data.id;

    // Login as Beta
    const betaLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
    });
    const betaToken = JSON.parse(betaLogin.body).data.token.access_token;

    // Try to get Acme dashboard as Beta
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboards/${acmeDashId}`,
      headers: { authorization: `Bearer ${betaToken}` },
    });
    // Should be 404 (not found for this tenant) or data is null
    const getBody = JSON.parse(getRes.body);
    if (getRes.statusCode === 200) {
      expect(getBody.data).toBeNull();
    } else {
      expect(getRes.statusCode).toBe(404);
    }

    // Beta list should not contain Acme dashboard
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboards',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    const listBody = JSON.parse(listRes.body);
    const found = listBody.data.find((d: any) => d.id === acmeDashId);
    expect(found).toBeUndefined();

    // Cleanup
    await app.inject({ method: 'DELETE', url: `/api/v1/dashboards/${acmeDashId}`, headers: auth() });
  });
});

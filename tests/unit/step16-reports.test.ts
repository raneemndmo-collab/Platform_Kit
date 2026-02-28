/**
 * M10 Reports Engine — Integration Tests
 *
 * Tests: CRUD for report definitions, publish/archive lifecycle,
 * simulated execution, run history, tenant isolation, RBAC, audit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();

  // Login as admin@acme.com (super_admin)
  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(loginRes.statusCode).toBe(200);
  token = loginRes.json().data.token.access_token;
});

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════
// Report Definition CRUD
// ═══════════════════════════════════════

describe('M10 Report Definitions — CRUD', () => {
  let reportId: string;

  it('POST /api/v1/reports — creates a tabular report definition', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Monthly Sales Report',
        description: 'Monthly sales breakdown by region',
        report_type: 'tabular',
        data_source: { model_id: 'sales_model', columns: ['region', 'amount', 'date'] },
        parameters: [
          { name: 'start_date', label: 'Start Date', type: 'date', required: true },
          { name: 'end_date', label: 'End Date', type: 'date', required: true },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Monthly Sales Report');
    expect(body.data.report_type).toBe('tabular');
    expect(body.data.status).toBe('draft');
    expect(body.data.parameters).toHaveLength(2);
    reportId = body.data.id;
  });

  it('GET /api/v1/reports — lists report definitions', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/reports/:id — returns a specific report', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/reports/${reportId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(reportId);
    expect(res.json().data.name).toBe('Monthly Sales Report');
  });

  it('PATCH /api/v1/reports/:id — updates report definition', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/reports/${reportId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated Sales Report', description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Sales Report');
    expect(res.json().data.description).toBe('Updated description');
  });

  it('GET /api/v1/reports/:nonexistent — returns 404', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/reports/01961234-5678-7000-8000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/reports — missing name returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: { report_type: 'tabular', data_source: {} },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════
// Report Types
// ═══════════════════════════════════════

describe('M10 Report Types', () => {
  const types = ['tabular', 'summary', 'crosstab', 'narrative', 'kpi_scorecard'] as const;

  for (const reportType of types) {
    it(`POST /api/v1/reports — creates ${reportType} report`, async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/reports',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: `${reportType} test report`,
          report_type: reportType,
          data_source: { model_id: 'test_model' },
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.report_type).toBe(reportType);
    });
  }
});

// ═══════════════════════════════════════
// Publish / Archive Lifecycle
// ═══════════════════════════════════════

describe('M10 Report Lifecycle', () => {
  let reportId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Lifecycle Report', report_type: 'summary', data_source: { model_id: 'lc_model' } },
    });
    reportId = res.json().data.id;
  });

  it('starts as draft', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/reports/${reportId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json().data.status).toBe('draft');
  });

  it('POST /api/v1/reports/:id/publish — transitions to published', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/reports/${reportId}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('published');
  });

  it('POST /api/v1/reports/:id/archive — transitions to archived', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/reports/${reportId}/archive`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('archived');
  });
});

// ═══════════════════════════════════════
// Report Execution (simulated)
// ═══════════════════════════════════════

describe('M10 Report Execution', () => {
  let reportId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Execution Test Report',
        report_type: 'tabular',
        data_source: { model_id: 'exec_model', columns: ['a', 'b'] },
      },
    });
    reportId = res.json().data.id;
  });

  it('POST /api/v1/reports/:id/execute — returns simulated output', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/reports/${reportId}/execute`,
      headers: { authorization: `Bearer ${token}` },
      payload: { parameters: { start_date: '2025-01-01' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.source).toBe('semantic_layer_simulated');
    expect(body.data.report_id).toBe(reportId);
    expect(body.data.parameters_applied).toEqual({ start_date: '2025-01-01' });
    expect(body.data.result).toBeDefined();
    expect(body.data.result.source).toBe('semantic_layer_simulated');
  });

  it('GET /api/v1/reports/:id/runs — lists run history', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/reports/${reportId}/runs`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
    expect(res.json().data[0].report_id).toBe(reportId);
  });

  it('execute with empty parameters works', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/reports/${reportId}/execute`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.source).toBe('semantic_layer_simulated');
  });
});

// ═══════════════════════════════════════
// Simulated Output per Report Type
// ═══════════════════════════════════════

describe('M10 Simulated Output by Type', () => {
  const typeChecks: Array<{ type: string; check: (result: any) => void }> = [
    { type: 'tabular', check: (r) => { expect(r.columns).toBeDefined(); expect(r.rows).toBeDefined(); } },
    { type: 'summary', check: (r) => { expect(r.aggregations).toBeDefined(); } },
    { type: 'crosstab', check: (r) => { expect(r.row_headers).toBeDefined(); expect(r.cells).toBeDefined(); } },
    { type: 'narrative', check: (r) => { expect(r.sections).toBeDefined(); } },
    { type: 'kpi_scorecard', check: (r) => { expect(r.kpis).toBeDefined(); } },
  ];

  for (const { type, check } of typeChecks) {
    it(`${type} report returns correct simulated structure`, async () => {
      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/reports',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: `${type} sim test`,
          report_type: type,
          data_source: { model_id: 'sim_model', kpi_ids: ['kpi1', 'kpi2'] },
        },
      });
      const reportId = createRes.json().data.id;

      const execRes = await app.inject({
        method: 'POST', url: `/api/v1/reports/${reportId}/execute`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(execRes.statusCode).toBe(201);
      check(execRes.json().data.result);
    });
  }
});

// ═══════════════════════════════════════
// Delete
// ═══════════════════════════════════════

describe('M10 Report Delete', () => {
  it('DELETE /api/v1/reports/:id — deletes report and cascades runs', async () => {
    // Create
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'To Delete', report_type: 'tabular', data_source: {} },
    });
    const id = createRes.json().data.id;

    // Execute to create a run
    await app.inject({
      method: 'POST', url: `/api/v1/reports/${id}/execute`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    // Delete
    const delRes = await app.inject({
      method: 'DELETE', url: `/api/v1/reports/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(delRes.statusCode).toBe(204);

    // Verify gone
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/reports/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════
// Tenant Isolation
// ═══════════════════════════════════════

describe('M10 Tenant Isolation', () => {
  let betaToken: string;
  let acmeReportId: string;

  beforeAll(async () => {
    // Create a report in Acme
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Acme Only Report', report_type: 'tabular', data_source: {} },
    });
    acmeReportId = createRes.json().data.id;

    // Login as Beta admin
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
    });
    expect(loginRes.statusCode).toBe(200);
    betaToken = loginRes.json().data.token.access_token;
  });

  it('Beta cannot see Acme reports', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.map((r: any) => r.id);
    expect(ids).not.toContain(acmeReportId);
  });

  it('Beta cannot access Acme report by ID', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/reports/${acmeReportId}`,
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('Beta cannot execute Acme report', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/reports/${acmeReportId}/execute`,
      headers: { authorization: `Bearer ${betaToken}` },
      payload: {},
    });
    // Should be 404 (not found due to RLS) or 500 (report not found error)
    expect([404, 500]).toContain(res.statusCode);
  });
});

// ═══════════════════════════════════════
// RBAC
// ═══════════════════════════════════════

describe('M10 RBAC', () => {
  it('viewer cannot create reports (no reports.create permission)', async () => {
    const loginRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'viewer@acme.com', password: 'Viewer123!', tenant_slug: 'acme' },
    });
    const viewerToken = loginRes.json().data.token.access_token;

    const res = await app.inject({
      method: 'POST', url: '/api/v1/reports',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: 'Unauthorized', report_type: 'tabular', data_source: {} },
    });
    expect(res.statusCode).toBe(403);
  });

  it('no auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/reports',
    });
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════
// Audit Trail
// ═══════════════════════════════════════

describe('M10 Audit Trail', () => {
  it('report creation is logged in audit', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit?limit=5',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const items = body.data.items || body.data;
    const reportActions = items.filter(
      (e: any) => e.action_id?.startsWith('rasid.mod.reports'),
    );
    expect(reportActions.length).toBeGreaterThanOrEqual(1);
  });
});

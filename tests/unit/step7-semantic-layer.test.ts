/** K8 — Semantic Data Layer tests */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import type { FastifyInstance } from 'fastify';
import { reseed } from '../helpers/reseed.js';

let app: FastifyInstance;
let adminToken: string;
let betaToken: string;
let datasetId: string;
let metricId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();

  // Login as admin@acme.com
  const acmeLogin = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  adminToken = JSON.parse(acmeLogin.body).data.token.access_token;

  // Login as admin@beta.com
  const betaLogin = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
  });
  betaToken = JSON.parse(betaLogin.body).data.token.access_token;
}, 30000);

afterAll(async () => {
  await app?.close();
});

describe('K8 — Dataset CRUD', () => {
  it('POST /datasets → 201 creates dataset with fields', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/datasets',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'sales_data',
        display_name: 'Sales Data',
        description: 'Monthly sales records',
        source_type: 'table',
        source_config: { table_name: 'raw_sales' },
        fields: [
          { name: 'region', display_name: 'Region', data_type: 'string', is_dimension: true },
          { name: 'product', display_name: 'Product', data_type: 'string', is_dimension: true },
          { name: 'amount', display_name: 'Amount', data_type: 'number', is_metric: true },
          { name: 'sale_date', display_name: 'Sale Date', data_type: 'date', is_dimension: true },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('sales_data');
    expect(body.data.status).toBe('draft');
    datasetId = body.data.id;
  });

  it('GET /datasets → lists datasets', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/datasets',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /datasets/:id → returns single dataset', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/datasets/${datasetId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(datasetId);
    expect(body.data.name).toBe('sales_data');
  });

  it('GET /datasets/:id → 404 for nonexistent', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/datasets/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /datasets/:id → updates dataset', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/datasets/${datasetId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { display_name: 'Sales Data v2', status: 'active' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.display_name).toBe('Sales Data v2');
    expect(body.data.status).toBe('active');
  });

  it('POST /datasets → 409 duplicate name', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/datasets',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'sales_data',
        display_name: 'Duplicate',
        source_type: 'table',
        fields: [{ name: 'x', display_name: 'X', data_type: 'string' }],
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /datasets → 400 missing fields', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/datasets',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'empty_ds',
        display_name: 'Empty',
        source_type: 'table',
        fields: [],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('no auth → 401', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/datasets',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('K8 — Schema', () => {
  it('GET /datasets/:id/schema → returns fields and metrics', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/datasets/${datasetId}/schema`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.dataset_id).toBe(datasetId);
    expect(body.data.fields.length).toBe(4);
    expect(body.data.fields[0].name).toBe('region');
  });
});

describe('K8 — Metrics', () => {
  it('POST /datasets/:id/metrics → 201 defines metric', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/datasets/${datasetId}/metrics`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'total_sales',
        display_name: 'Total Sales',
        expression: 'SUM(amount)',
        aggregation: 'sum',
        dimensions: ['region', 'product'],
        description: 'Sum of all sales amounts',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('total_sales');
    expect(body.data.aggregation).toBe('sum');
    metricId = body.data.id;
  });

  it('POST /datasets/:id/metrics → 409 duplicate metric', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/datasets/${datasetId}/metrics`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'total_sales',
        display_name: 'Dup',
        expression: 'SUM(amount)',
        aggregation: 'sum',
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /datasets/:id/metrics → 400 invalid dimension', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/datasets/${datasetId}/metrics`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'bad_metric',
        display_name: 'Bad',
        expression: 'SUM(x)',
        aggregation: 'sum',
        dimensions: ['nonexistent_field'],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /datasets/:id/metrics → lists metrics', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/datasets/${datasetId}/metrics`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].name).toBe('total_sales');
  });

  it('DELETE /datasets/:datasetId/metrics/:metricId → 204', async () => {
    // Create a metric to delete
    const createRes = await app.inject({
      method: 'POST', url: `/api/v1/datasets/${datasetId}/metrics`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'to_delete',
        display_name: 'To Delete',
        expression: 'COUNT(*)',
        aggregation: 'count',
      },
    });
    const toDeleteId = JSON.parse(createRes.body).data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/datasets/${datasetId}/metrics/${toDeleteId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /metrics/:id → 404 nonexistent', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/datasets/${datasetId}/metrics/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('K8 — Semantic Query', () => {
  it('POST /datasets/:id/query → validates and returns result set', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/datasets/${datasetId}/query`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        dimensions: ['region'],
        metrics: ['total_sales'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.columns).toEqual(['region', 'total_sales']);
    expect(body.data.rows).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it('POST /datasets/:id/query → 400 unknown dimension', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/datasets/${datasetId}/query`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        dimensions: ['nonexistent'],
        metrics: ['total_sales'],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /datasets/:id/query → 400 unknown metric', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/datasets/${datasetId}/query`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        dimensions: ['region'],
        metrics: ['nonexistent_metric'],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /datasets/:id/query → 400 field is not a dimension', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/datasets/${datasetId}/query`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        dimensions: ['amount'],
        metrics: ['total_sales'],
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('K8 — Tenant Isolation', () => {
  it('Beta cannot see Acme datasets', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/datasets',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const acmeDs = body.data.filter((d: { name: string }) => d.name === 'sales_data');
    expect(acmeDs.length).toBe(0);
  });

  it('Beta cannot access Acme dataset by ID', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/datasets/${datasetId}`,
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('K8 — Dataset Deletion', () => {
  it('DELETE /datasets/:id → 204 cascades fields and metrics', async () => {
    // Create a fresh dataset to delete
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/datasets',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'to_delete_ds',
        display_name: 'To Delete DS',
        source_type: 'view',
        fields: [{ name: 'col1', display_name: 'Col 1', data_type: 'string' }],
      },
    });
    const delId = JSON.parse(createRes.body).data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/datasets/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify gone
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/datasets/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /datasets/:id → 404 nonexistent', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/api/v1/datasets/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

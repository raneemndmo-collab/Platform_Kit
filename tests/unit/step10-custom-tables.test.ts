import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let accessToken: string;
let userId: string;
let tenantId: string;

// Tenant B for isolation tests
let tenantBToken: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();

  // Login as seeded admin
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(loginRes.statusCode).toBe(200);
  accessToken = loginRes.json().data.token.access_token;

  // Get userId and tenantId from users list
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/v1/users',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(meRes.statusCode).toBe(200);
  const adminUser = meRes.json().data.items.find((u: { email: string }) => u.email === 'admin@acme.com');
  userId = adminUser.id;
  tenantId = adminUser.tenant_id;

  // Create Tenant B user for isolation tests
  const regBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'user@beta.com', password: 'Beta123!', display_name: 'Beta User', tenant_slug: 'beta' },
  });
  expect(regBRes.statusCode).toBe(201);

  const loginBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'user@beta.com', password: 'Beta123!', tenant_slug: 'beta' },
  });
  expect(loginBRes.statusCode).toBe(200);
  tenantBToken = loginBRes.json().data.token.access_token;
}, 30000);

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════════
// Helper: count audit entries for a given action_id
// ═══════════════════════════════════════════════
async function countAuditEntries(actionId: string): Promise<number> {
  const rows = await adminSql`
    SELECT count(*)::int AS cnt FROM kernel.audit_log WHERE action_id = ${actionId}
  `;
  return rows[0].cnt;
}

// ═══════════════════════════════════════════════
// ─── Custom Table CRUD (via K3 pipeline) ───
// ═══════════════════════════════════════════════

describe('M13 Custom Tables — Table CRUD', () => {
  let tableId: string;

  it('POST /api/v1/custom-tables — creates table via K3', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/custom-tables',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'contacts',
        display_name: 'Contacts',
        description: 'Customer contacts table',
        columns: [
          { name: 'first_name', display_name: 'First Name', data_type: 'text', required: true },
          { name: 'last_name', display_name: 'Last Name', data_type: 'text', required: true },
          { name: 'age', display_name: 'Age', data_type: 'number', required: false },
          { name: 'active', display_name: 'Active', data_type: 'boolean', required: false },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('contacts');
    expect(body.data.display_name).toBe('Contacts');
    expect(body.data.status).toBe('draft');
    expect(body.data.columns).toHaveLength(4);
    expect(body.meta).toHaveProperty('audit_id');
    expect(body.meta).toHaveProperty('action_id');
    tableId = body.data.id;
  });

  it('GET /api/v1/custom-tables/:id — returns created table', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(tableId);
    expect(res.json().data.name).toBe('contacts');
  });

  it('GET /api/v1/custom-tables — lists tables', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/custom-tables',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/custom-tables?status=draft — filters by status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/custom-tables?status=draft',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    for (const t of res.json().data) {
      expect(t.status).toBe('draft');
    }
  });

  it('PATCH /api/v1/custom-tables/:id — updates table via K3', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/custom-tables/${tableId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { display_name: 'Updated Contacts', status: 'active' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.display_name).toBe('Updated Contacts');
    expect(res.json().data.status).toBe('active');
    expect(res.json().meta).toHaveProperty('audit_id');
  });

  it('POST /api/v1/custom-tables — rejects duplicate name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/custom-tables',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'contacts',
        display_name: 'Contacts 2',
        columns: [{ name: 'col1', display_name: 'Col 1', data_type: 'text', required: false }],
      },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });

  it('POST /api/v1/custom-tables — validates column schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/custom-tables',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'bad_table',
        display_name: 'Bad',
        columns: [{ name: 'col1', display_name: 'Col 1', data_type: 'invalid_type', required: false }],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  // Tenant isolation
  it('Tenant B cannot see Tenant A tables', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/custom-tables',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(0);
  });

  it('Tenant B cannot access Tenant A table by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    // RLS should return null (404) or empty
    expect(res.statusCode).toBe(404);
  });

  // K3 pipeline verification
  it('audit entries exist for table.create and table.update', async () => {
    const createCount = await countAuditEntries('rasid.mod.connectors.table.create');
    expect(createCount).toBeGreaterThanOrEqual(1);
    const updateCount = await countAuditEntries('rasid.mod.connectors.table.update');
    expect(updateCount).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// ─── Custom Table Row CRUD (via K3 pipeline) ───
// ═══════════════════════════════════════════════

describe('M13 Custom Tables — Row CRUD', () => {
  let tableId: string;
  let rowId: string;

  // Create a table first
  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/custom-tables',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'products',
        display_name: 'Products',
        columns: [
          { name: 'sku', display_name: 'SKU', data_type: 'text', required: true },
          { name: 'price', display_name: 'Price', data_type: 'number', required: true },
          { name: 'in_stock', display_name: 'In Stock', data_type: 'boolean', required: false },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    tableId = res.json().data.id;
  });

  it('POST /api/v1/custom-tables/:tableId/rows — creates row via K3', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/custom-tables/${tableId}/rows`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { row_data: { sku: 'PROD-001', price: 29.99, in_stock: true } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.row_data.sku).toBe('PROD-001');
    expect(body.data.row_data.price).toBe(29.99);
    expect(body.data.row_order).toBe(1);
    expect(body.meta).toHaveProperty('audit_id');
    expect(body.meta).toHaveProperty('action_id');
    rowId = body.data.id;
  });

  it('POST — creates second row with incremented row_order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/custom-tables/${tableId}/rows`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { row_data: { sku: 'PROD-002', price: 49.99, in_stock: false } },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.row_order).toBe(2);
  });

  it('GET /api/v1/custom-tables/:tableId/rows — lists rows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}/rows`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(2);
  });

  it('GET /api/v1/custom-tables/:tableId/rows/:rowId — returns single row', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}/rows/${rowId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(rowId);
    expect(res.json().data.row_data.sku).toBe('PROD-001');
  });

  it('PATCH /api/v1/custom-tables/:tableId/rows/:rowId — updates row via K3', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/custom-tables/${tableId}/rows/${rowId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { row_data: { sku: 'PROD-001-UPDATED', price: 39.99, in_stock: true } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.row_data.sku).toBe('PROD-001-UPDATED');
    expect(res.json().data.row_data.price).toBe(39.99);
    expect(res.json().meta).toHaveProperty('audit_id');
  });

  it('DELETE /api/v1/custom-tables/:tableId/rows/:rowId — deletes row via K3', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/custom-tables/${tableId}/rows/${rowId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it('GET deleted row returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}/rows/${rowId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // Tenant isolation for rows
  it('Tenant B cannot see Tenant A rows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}/rows`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(0);
  });

  // Audit entries for row operations
  it('audit entries exist for row.create and row.update', async () => {
    const createCount = await countAuditEntries('rasid.mod.connectors.table.row.create');
    expect(createCount).toBeGreaterThanOrEqual(1);
    const updateCount = await countAuditEntries('rasid.mod.connectors.table.row.update');
    expect(updateCount).toBeGreaterThanOrEqual(1);
    const deleteCount = await countAuditEntries('rasid.mod.connectors.table.row.delete');
    expect(deleteCount).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// ─── Table Delete (cascading) ───
// ═══════════════════════════════════════════════

describe('M13 Custom Tables — Cascading Delete', () => {
  let tableId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/custom-tables',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'temp_table',
        display_name: 'Temp Table',
        columns: [{ name: 'val', display_name: 'Value', data_type: 'text', required: false }],
      },
    });
    expect(res.statusCode).toBe(201);
    tableId = res.json().data.id;

    // Add rows
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: `/api/v1/custom-tables/${tableId}/rows`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { row_data: { val: `item-${i}` } },
      });
    }
  });

  it('DELETE /api/v1/custom-tables/:id — deletes table and cascades rows', async () => {
    // Verify rows exist first
    const rowsBefore = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}/rows`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(rowsBefore.json().data.length).toBe(3);

    // Delete table
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/custom-tables/${tableId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify table is gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.statusCode).toBe(404);

    // Verify rows are gone (RLS returns empty, not 404 for list)
    const rowsAfter = await app.inject({
      method: 'GET',
      url: `/api/v1/custom-tables/${tableId}/rows`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(rowsAfter.json().data.length).toBe(0);
  });

  it('audit entry exists for table.delete', async () => {
    const count = await countAuditEntries('rasid.mod.connectors.table.delete');
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// ─── K3 Pipeline — Policy Enforcement ───
// ═══════════════════════════════════════════════

describe('M13 Custom Tables — Policy Enforcement', () => {
  it('viewer (no custom_tables.create permission) gets 403', async () => {
    // Login as viewer (has only users.read, objects.read, audit.read)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'viewer@acme.com', password: 'Viewer123!', tenant_slug: 'acme' },
    });
    expect(loginRes.statusCode).toBe(200);
    const viewerToken = loginRes.json().data.token.access_token;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/custom-tables',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: {
        name: 'forbidden_table',
        display_name: 'Forbidden',
        columns: [{ name: 'x', display_name: 'X', data_type: 'text', required: false }],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('failed policy attempt is audited', async () => {
    const rows = await adminSql`
      SELECT count(*)::int AS cnt FROM kernel.audit_log
      WHERE action_id = 'rasid.mod.connectors.table.create' AND status = 'failure'
    `;
    expect(rows[0].cnt).toBeGreaterThanOrEqual(1);
  });
});

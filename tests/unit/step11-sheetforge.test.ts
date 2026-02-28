import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let accessToken: string;
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

  // Create Tenant B user for isolation tests
  const regBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'sf-user@beta.com', password: 'Beta123!', display_name: 'Beta SF User', tenant_slug: 'beta' },
  });
  expect(regBRes.statusCode).toBe(201);

  const loginBRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'sf-user@beta.com', password: 'Beta123!', tenant_slug: 'beta' },
  });
  expect(loginBRes.statusCode).toBe(200);
  tenantBToken = loginBRes.json().data.token.access_token;
}, 30000);

afterAll(async () => {
  await app.close();
});

async function countAuditEntries(actionId: string): Promise<number> {
  const rows = await adminSql`
    SELECT count(*)::int AS cnt FROM kernel.audit_log WHERE action_id = ${actionId}
  `;
  return rows[0].cnt;
}

// ═══════════════════════════════════════════════
// ─── Library CRUD ───
// ═══════════════════════════════════════════════

describe('M8 SheetForge -- Library CRUD', () => {
  let libraryId: string;

  it('POST /api/v1/sheetforge/libraries -- uploads library via K3', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/libraries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Sales Report Q1', file_type: 'xlsx' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Sales Report Q1');
    expect(body.data.status).toBe('uploaded');
    expect(body.data.file_type).toBe('xlsx');
    expect(body.meta).toHaveProperty('audit_id');
    expect(body.meta).toHaveProperty('action_id');
    libraryId = body.data.id;
  });

  it('GET /api/v1/sheetforge/libraries/:id -- returns created library', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libraryId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(libraryId);
  });

  it('GET /api/v1/sheetforge/libraries -- lists libraries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sheetforge/libraries',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/v1/sheetforge/libraries/:id -- updates library via K3', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sheetforge/libraries/${libraryId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Sales Report Q1 Updated' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Sales Report Q1 Updated');
    expect(res.json().meta).toHaveProperty('audit_id');
  });

  it('POST /api/v1/sheetforge/libraries -- rejects duplicate name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/libraries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Sales Report Q1 Updated', file_type: 'csv' },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });

  // Tenant isolation
  it('Tenant B cannot see Tenant A libraries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sheetforge/libraries',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(0);
  });

  it('Tenant B cannot access Tenant A library by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libraryId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // K3 audit verification
  it('audit entries exist for library.upload and library.update', async () => {
    const uploadCount = await countAuditEntries('rasid.mod.sheetforge.library.upload');
    expect(uploadCount).toBeGreaterThanOrEqual(1);
    const updateCount = await countAuditEntries('rasid.mod.sheetforge.library.update');
    expect(updateCount).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// ─── Library Indexing (simulated) ───
// ═══════════════════════════════════════════════

describe('M8 SheetForge -- Library Indexing', () => {
  let libraryId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/libraries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Inventory Data', file_type: 'xlsx' },
    });
    expect(res.statusCode).toBe(201);
    libraryId = res.json().data.id;
  });

  it('POST /api/v1/sheetforge/libraries/:id/index -- indexes library (simulated)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sheetforge/libraries/${libraryId}/index`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('indexed');
    expect(body.data.row_count).toBeGreaterThanOrEqual(1);
    expect(body.data.column_count).toBeGreaterThanOrEqual(1);
    expect(body.data.indexed_at).toBeTruthy();
    expect(body.meta).toHaveProperty('audit_id');
  });

  it('GET /api/v1/sheetforge/libraries/:id/sheets -- returns generated sheets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libraryId}/sheets`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const sheets = res.json().data;
    expect(sheets.length).toBeGreaterThanOrEqual(1);
    expect(sheets[0].sheet_name).toBe('Sheet1');
    expect(sheets[0].headers).toBeInstanceOf(Array);
    expect(sheets[0].headers.length).toBeGreaterThanOrEqual(1);
    expect(sheets[0].sample_data).toBeInstanceOf(Array);
  });

  it('audit entry exists for library.index', async () => {
    const count = await countAuditEntries('rasid.mod.sheetforge.library.index');
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// ─── Composition CRUD ───
// ═══════════════════════════════════════════════

describe('M8 SheetForge -- Composition CRUD', () => {
  let compositionId: string;
  let libraryId: string;
  let sheetId: string;

  beforeAll(async () => {
    // Create and index a library to get sheets
    const libRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/libraries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Comp Source Data', file_type: 'csv' },
    });
    expect(libRes.statusCode).toBe(201);
    libraryId = libRes.json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/sheetforge/libraries/${libraryId}/index`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const sheetsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libraryId}/sheets`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    sheetId = sheetsRes.json().data[0].id;
  });

  it('POST /api/v1/sheetforge/compositions -- creates composition via K3', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/compositions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Sales Analysis',
        description: 'Combine sales sheets',
        source_sheets: [
          { sheet_id: sheetId, alias: 'sales', selected_columns: ['col_a', 'col_b'] },
        ],
        join_config: { type: 'none' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Sales Analysis');
    expect(body.data.status).toBe('draft');
    expect(body.data.source_sheets).toHaveLength(1);
    expect(body.data.output_schema).toHaveLength(2);
    expect(body.meta).toHaveProperty('audit_id');
    compositionId = body.data.id;
  });

  it('GET /api/v1/sheetforge/compositions/:id -- returns composition', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/compositions/${compositionId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(compositionId);
  });

  it('GET /api/v1/sheetforge/compositions -- lists compositions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sheetforge/compositions',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/v1/sheetforge/compositions/:id -- updates composition via K3', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sheetforge/compositions/${compositionId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.description).toBe('Updated description');
    expect(res.json().meta).toHaveProperty('audit_id');
  });

  it('POST /api/v1/sheetforge/compositions -- rejects duplicate name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/compositions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Sales Analysis',
        source_sheets: [{ sheet_id: sheetId, alias: 's', selected_columns: ['col_a'] }],
        join_config: { type: 'none' },
      },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });

  // Tenant isolation
  it('Tenant B cannot see Tenant A compositions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sheetforge/compositions',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(0);
  });

  it('Tenant B cannot access Tenant A composition by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/compositions/${compositionId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('audit entries exist for compose and compose.update', async () => {
    const createCount = await countAuditEntries('rasid.mod.sheetforge.compose');
    expect(createCount).toBeGreaterThanOrEqual(1);
    const updateCount = await countAuditEntries('rasid.mod.sheetforge.compose.update');
    expect(updateCount).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// ─── Publish & Gap Analysis ───
// ═══════════════════════════════════════════════

describe('M8 SheetForge -- Publish & Gap Analysis', () => {
  let compositionId: string;

  beforeAll(async () => {
    // Create library, index, create composition
    const libRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/libraries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Gap Test Data', file_type: 'xlsx' },
    });
    const libId = libRes.json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/sheetforge/libraries/${libId}/index`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const sheetsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libId}/sheets`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const sheetId = sheetsRes.json().data[0].id;

    const compRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/compositions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Gap Test Composition',
        source_sheets: [{ sheet_id: sheetId, alias: 'data', selected_columns: ['col_a', 'col_b'] }],
        join_config: { type: 'none' },
      },
    });
    compositionId = compRes.json().data.id;
  });

  it('POST /api/v1/sheetforge/compositions/:id/publish -- publishes via K3', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sheetforge/compositions/${compositionId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('published');
    expect(body.data.published_at).toBeTruthy();
    expect(body.data.output_data).toBeInstanceOf(Array);
    expect(body.data.output_data.length).toBeGreaterThanOrEqual(1);
    expect(body.meta).toHaveProperty('audit_id');
  });

  it('POST /api/v1/sheetforge/compositions/:compositionId/gap-analysis -- runs gap analysis via K3', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sheetforge/compositions/${compositionId}/gap-analysis`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('missing_cells');
    expect(body.data).toHaveProperty('duplicate_rows');
    expect(body.data).toHaveProperty('type_mismatches');
    expect(body.data).toHaveProperty('details');
    expect(body.data.composition_id).toBe(compositionId);
    expect(body.meta).toHaveProperty('audit_id');
  });

  it('GET /api/v1/sheetforge/compositions/:compositionId/gap-analysis -- returns gap analysis', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/compositions/${compositionId}/gap-analysis`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.composition_id).toBe(compositionId);
  });

  it('audit entries exist for publish and analyze', async () => {
    const publishCount = await countAuditEntries('rasid.mod.sheetforge.publish');
    expect(publishCount).toBeGreaterThanOrEqual(1);
    const analyzeCount = await countAuditEntries('rasid.mod.sheetforge.analyze');
    expect(analyzeCount).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// ─── Cascading Delete ───
// ═══════════════════════════════════════════════

describe('M8 SheetForge -- Cascading Delete', () => {
  let libraryId: string;
  let compositionId: string;

  beforeAll(async () => {
    // Library with sheets
    const libRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/libraries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Cascade Test Lib', file_type: 'xlsx' },
    });
    libraryId = libRes.json().data.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/sheetforge/libraries/${libraryId}/index`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    // Composition with gap analysis
    const sheetsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libraryId}/sheets`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const sheetId = sheetsRes.json().data[0].id;

    const compRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sheetforge/compositions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Cascade Test Comp',
        source_sheets: [{ sheet_id: sheetId, alias: 'x', selected_columns: ['col_a'] }],
        join_config: { type: 'none' },
      },
    });
    compositionId = compRes.json().data.id;

    // Publish and run gap analysis
    await app.inject({
      method: 'POST',
      url: `/api/v1/sheetforge/compositions/${compositionId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/sheetforge/compositions/${compositionId}/gap-analysis`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
  });

  it('DELETE library cascades sheets', async () => {
    // Verify sheets exist
    const sheetsBefore = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libraryId}/sheets`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(sheetsBefore.json().data.length).toBeGreaterThanOrEqual(1);

    // Delete library
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sheetforge/libraries/${libraryId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify library gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libraryId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.statusCode).toBe(404);

    // Verify sheets gone
    const sheetsAfter = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/libraries/${libraryId}/sheets`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(sheetsAfter.json().data.length).toBe(0);
  });

  it('DELETE composition cascades gap analyses', async () => {
    // Verify gap analysis exists
    const gapBefore = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/compositions/${compositionId}/gap-analysis`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(gapBefore.statusCode).toBe(200);

    // Delete composition
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sheetforge/compositions/${compositionId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify composition gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/compositions/${compositionId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.statusCode).toBe(404);

    // Verify gap analysis gone
    const gapAfter = await app.inject({
      method: 'GET',
      url: `/api/v1/sheetforge/compositions/${compositionId}/gap-analysis`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(gapAfter.statusCode).toBe(404);
  });
});

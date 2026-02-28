/**
 * Manual route test for M13 — Custom Tables
 * Tests all endpoints against a live server on port 3000
 */
import 'dotenv/config';
import jwt from './node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken/index.js';
import { randomUUID } from 'crypto';
import postgres from 'postgres';

const BASE = 'http://127.0.0.1:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DB_URL = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;

// Create admin SQL for cleanup
const sql = postgres(DB_URL);

// Create JWT with proper fields
const tenantId = randomUUID();
const userId = randomUUID();
const sessionId = randomUUID();
const token = jwt.sign(
  { sub: userId, tid: tenantId, sid: sessionId, roles: ['admin'] },
  JWT_SECRET,
  { expiresIn: '1h' },
);

// Seed tenant, user, role, permissions
async function seed() {
  console.log('DB_URL:', DB_URL);
  console.log('tenantId:', tenantId);
  const tenantResult = await sql`INSERT INTO kernel.tenants (id, name, slug, status) VALUES (${tenantId}, 'M13Test', 'm13test-' || ${tenantId.slice(0,8)}, 'active') ON CONFLICT DO NOTHING`;
  console.log('Tenant inserted:', tenantResult);
  await sql`INSERT INTO kernel.users (id, tenant_id, email, password_hash, display_name, status) VALUES (${userId}, ${tenantId}, 'm13@test.com', 'x', 'M13 Tester', 'active') ON CONFLICT DO NOTHING`;
  const roleId = randomUUID();
  await sql`INSERT INTO kernel.roles (id, tenant_id, name, description) VALUES (${roleId}, ${tenantId}, 'admin', 'Admin') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO kernel.user_roles (user_id, role_id, tenant_id) VALUES (${userId}, ${roleId}, ${tenantId}) ON CONFLICT DO NOTHING`;

  // Link existing permissions to the role
  for (const resource of ['custom_tables', 'custom_table_rows']) {
    for (const action of ['create', 'read', 'update', 'delete']) {
      const [perm] = await sql`SELECT id FROM kernel.permissions WHERE resource = ${resource} AND action = ${action} LIMIT 1`;
      if (perm) {
        await sql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${roleId}, ${perm.id}, ${tenantId}) ON CONFLICT DO NOTHING`;
      } else {
        console.log(`  WARNING: Permission ${resource}.${action} not found`);
      }
    }
  }
}

const results = [];
let tableId, rowId;

async function test(name, method, path, body, expectedMin, expectedMax) {
  const opts = {
    method,
    headers: { authorization: `Bearer ${token}` },
  };
  if (body) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const ok = res.status >= expectedMin && res.status <= expectedMax;
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  results.push({ name, status: res.status, ok: ok ? 'PASS' : 'FAIL' });
  if (!ok) console.log(`  FAIL: ${name} — got ${res.status}, expected ${expectedMin}-${expectedMax}`);
  if (!ok) console.log(`  BODY:`, typeof json === 'object' ? JSON.stringify(json).slice(0, 200) : text.slice(0, 200));
  return json;
}

async function run() {
  await seed();

  // 1. Create table
  let r = await test('POST /custom-tables', 'POST', '/api/v1/custom-tables', {
    name: 'test_m13',
    display_name: 'M13 Test Table',
    columns: [
      { name: 'name', display_name: 'Name', data_type: 'text', required: true },
      { name: 'age', display_name: 'Age', data_type: 'number', required: false },
    ],
  }, 201, 201);
  tableId = r?.data?.id;

  // 2. Get table
  await test('GET /custom-tables/:id', 'GET', `/api/v1/custom-tables/${tableId}`, null, 200, 200);

  // 3. List tables
  await test('GET /custom-tables', 'GET', '/api/v1/custom-tables', null, 200, 200);

  // 4. Update table
  await test('PATCH /custom-tables/:id', 'PATCH', `/api/v1/custom-tables/${tableId}`, {
    display_name: 'Updated M13 Table',
  }, 200, 200);

  // 5. Duplicate name
  await test('POST /custom-tables (dup)', 'POST', '/api/v1/custom-tables', {
    name: 'test_m13',
    display_name: 'Dup',
    columns: [{ name: 'x', display_name: 'X', data_type: 'text', required: false }],
  }, 409, 409);

  // 6. Create row
  r = await test('POST /custom-tables/:id/rows', 'POST', `/api/v1/custom-tables/${tableId}/rows`, {
    row_data: { name: 'Alice', age: 30 },
  }, 201, 201);
  rowId = r?.data?.id;

  // 7. Get row
  await test('GET /rows/:rowId', 'GET', `/api/v1/custom-tables/${tableId}/rows/${rowId}`, null, 200, 200);

  // 8. List rows
  await test('GET /rows', 'GET', `/api/v1/custom-tables/${tableId}/rows`, null, 200, 200);

  // 9. Update row
  await test('PATCH /rows/:rowId', 'PATCH', `/api/v1/custom-tables/${tableId}/rows/${rowId}`, {
    row_data: { name: 'Bob', age: 25 },
  }, 200, 200);

  // 10. Delete row
  await test('DELETE /rows/:rowId', 'DELETE', `/api/v1/custom-tables/${tableId}/rows/${rowId}`, null, 204, 204);

  // 11. Verify row deleted
  await test('GET deleted row', 'GET', `/api/v1/custom-tables/${tableId}/rows/${rowId}`, null, 404, 404);

  // 12. Delete table
  await test('DELETE /custom-tables/:id', 'DELETE', `/api/v1/custom-tables/${tableId}`, null, 204, 204);

  // 13. Verify table deleted
  await test('GET deleted table', 'GET', `/api/v1/custom-tables/${tableId}`, null, 404, 404);

  // 14. Check audit entries
  const audits = await sql`SELECT action_id, status FROM kernel.audit_log WHERE tenant_id = ${tenantId} AND action_id LIKE 'rasid.mod.connectors%' ORDER BY created_at`;
  console.log(`\nAudit entries: ${audits.length}`);
  for (const a of audits) console.log(`  ${a.action_id} → ${a.status}`);

  // Cleanup
  await sql`DELETE FROM kernel.audit_log WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM kernel.user_roles WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM kernel.role_permissions WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM kernel.roles WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM kernel.permissions WHERE resource IN ('custom_tables', 'custom_table_rows')`;
  await sql`DELETE FROM kernel.users WHERE tenant_id = ${tenantId}`;
  await sql`DELETE FROM kernel.tenants WHERE id = ${tenantId}`;

  // Summary
  const passed = results.filter(r => r.ok === 'PASS').length;
  const failed = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed}/${results.length} PASS, ${failed} FAIL`);
  for (const r of results) console.log(`  [${r.ok}] ${r.name} → ${r.status}`);

  await sql.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });

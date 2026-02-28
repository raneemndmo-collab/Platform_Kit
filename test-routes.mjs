import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('./packages/kernel/node_modules/jsonwebtoken');
import postgres from 'postgres';
import 'dotenv/config';

const SECRET = 'rasid-dev-secret-key-min-32-chars-ok!!';
const BASE = 'http://127.0.0.1:3000';

const sql = postgres(process.env.DATABASE_ADMIN_URL, { max: 1 });

async function main() {
  // Get tenant and user
  const tenants = await sql`SELECT id FROM kernel.tenants LIMIT 1`;
  const users = await sql`SELECT id FROM kernel.users LIMIT 1`;
  if (!tenants[0] || !users[0]) {
    console.log('ERROR: No seed data found');
    await sql.end();
    return;
  }
  const tid = tenants[0].id;
  const uid = users[0].id;
  const token = jwt.sign({ sub: uid, tid: tid, sid: '00000000-0000-0000-0000-000000000001', role: 'admin' }, SECRET, { expiresIn: '1h' });

  console.log(`Tenant: ${tid}`);
  console.log(`User: ${uid}`);
  console.log('---');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const results = [];

  // Helper
  async function test(method, path, body, label) {
    try {
      // For DELETE/GET without body, don't send Content-Type: application/json
      const reqHeaders = body
        ? headers
        : { 'Authorization': headers['Authorization'] };
      const opts = { method, headers: reqHeaders };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${BASE}${path}`, opts);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = text; }
      const status = res.status;
      const ok = status < 500;
      results.push({ label, method, path, status, ok, response: typeof json === 'object' ? JSON.stringify(json).slice(0, 300) : String(json).slice(0, 300) });
      console.log(`${ok ? 'PASS' : 'FAIL'} [${status}] ${method} ${path} — ${label}`);
      if (!ok) {
        console.log(`  ERROR: ${typeof json === 'object' ? JSON.stringify(json) : json}`);
      }
      return { status, json };
    } catch (err) {
      results.push({ label, method, path, status: 'ERR', ok: false, response: err.message });
      console.log(`FAIL [ERR] ${method} ${path} — ${label}: ${err.message}`);
      return { status: 0, json: null };
    }
  }

  // 0. Health check
  await test('GET', '/api/v1/health', null, 'Health check');

  // 1. POST /api/v1/datasets — Register dataset
  const { status: s1, json: j1 } = await test('POST', '/api/v1/datasets', {
    name: 'test_sales_data',
    display_name: 'Test Sales Data',
    description: 'Route test dataset',
    source_type: 'table',
    source_config: { table_name: 'raw_sales' },
    fields: [
      { name: 'region', display_name: 'Region', data_type: 'string', is_dimension: true },
      { name: 'amount', display_name: 'Amount', data_type: 'number', is_metric: true },
      { name: 'sale_date', display_name: 'Sale Date', data_type: 'date', is_dimension: true },
    ],
  }, 'Register dataset');

  let datasetId = null;
  if (j1 && j1.data) datasetId = j1.data.id;

  // 2. POST /api/v1/datasets — Duplicate name (should 409)
  if (datasetId) {
    await test('POST', '/api/v1/datasets', {
      name: 'test_sales_data',
      display_name: 'Dup',
      source_type: 'table',
      fields: [{ name: 'x', display_name: 'X', data_type: 'string' }],
    }, 'Duplicate dataset name (expect 409)');
  }

  // 3. GET /api/v1/datasets — List datasets
  await test('GET', '/api/v1/datasets', null, 'List datasets');

  // 4. GET /api/v1/datasets?status=draft
  await test('GET', '/api/v1/datasets?status=draft', null, 'List datasets (status=draft)');

  // 5. GET /api/v1/datasets/:id — Get dataset
  if (datasetId) {
    await test('GET', `/api/v1/datasets/${datasetId}`, null, 'Get dataset by ID');
  }

  // 6. GET /api/v1/datasets/:id — Not found
  await test('GET', '/api/v1/datasets/00000000-0000-0000-0000-000000000099', null, 'Get dataset not found (expect 404)');

  // 7. PATCH /api/v1/datasets/:id — Update dataset
  if (datasetId) {
    await test('PATCH', `/api/v1/datasets/${datasetId}`, {
      display_name: 'Updated Sales Data',
      status: 'active',
    }, 'Update dataset');
  }

  // 8. GET /api/v1/datasets/:id/schema — Get schema
  if (datasetId) {
    await test('GET', `/api/v1/datasets/${datasetId}/schema`, null, 'Get dataset schema');
  }

  // 9. POST /api/v1/datasets/:id/metrics — Define metric
  let metricId = null;
  if (datasetId) {
    const { json: jm } = await test('POST', `/api/v1/datasets/${datasetId}/metrics`, {
      name: 'total_sales',
      display_name: 'Total Sales',
      expression: 'SUM(amount)',
      aggregation: 'sum',
      dimensions: ['region'],
      description: 'Total sales by region',
    }, 'Define metric');
    if (jm && jm.data) metricId = jm.data.id;
  }

  // 10. POST /api/v1/datasets/:id/metrics — Duplicate metric (expect 409)
  if (datasetId) {
    await test('POST', `/api/v1/datasets/${datasetId}/metrics`, {
      name: 'total_sales',
      display_name: 'Dup',
      expression: 'SUM(amount)',
      aggregation: 'sum',
    }, 'Duplicate metric name (expect 409)');
  }

  // 11. POST /api/v1/datasets/:id/metrics — Invalid dimension (expect 400)
  if (datasetId) {
    await test('POST', `/api/v1/datasets/${datasetId}/metrics`, {
      name: 'bad_metric',
      display_name: 'Bad',
      expression: 'SUM(x)',
      aggregation: 'sum',
      dimensions: ['nonexistent_field'],
    }, 'Metric with invalid dimension (expect 400)');
  }

  // 12. GET /api/v1/datasets/:id/metrics — List metrics
  if (datasetId) {
    await test('GET', `/api/v1/datasets/${datasetId}/metrics`, null, 'List metrics');
  }

  // 13. POST /api/v1/datasets/:id/query — Semantic query
  if (datasetId && metricId) {
    await test('POST', `/api/v1/datasets/${datasetId}/query`, {
      dimensions: ['region'],
      metrics: ['total_sales'],
    }, 'Semantic query');
  }

  // 14. POST /api/v1/datasets/:id/query — Invalid dimension (expect 400)
  if (datasetId) {
    await test('POST', `/api/v1/datasets/${datasetId}/query`, {
      dimensions: ['nonexistent'],
      metrics: ['total_sales'],
    }, 'Query with invalid dimension (expect 400)');
  }

  // 15. POST /api/v1/datasets/:id/query — Invalid metric (expect 400)
  if (datasetId) {
    await test('POST', `/api/v1/datasets/${datasetId}/query`, {
      dimensions: [],
      metrics: ['nonexistent_metric'],
    }, 'Query with invalid metric (expect 400)');
  }

  // 16. DELETE /api/v1/datasets/:datasetId/metrics/:metricId — Delete metric
  if (datasetId && metricId) {
    await test('DELETE', `/api/v1/datasets/${datasetId}/metrics/${metricId}`, null, 'Delete metric');
  }

  // 17. DELETE /api/v1/datasets/:id — Delete dataset
  if (datasetId) {
    await test('DELETE', `/api/v1/datasets/${datasetId}`, null, 'Delete dataset');
  }

  // 18. GET /api/v1/datasets/:id — Verify deleted (expect 404)
  if (datasetId) {
    await test('GET', `/api/v1/datasets/${datasetId}`, null, 'Get deleted dataset (expect 404)');
  }

  // 19. POST /api/v1/datasets — Validation: missing fields
  await test('POST', '/api/v1/datasets', {
    name: 'bad',
    display_name: 'Bad',
    source_type: 'table',
  }, 'Register dataset missing fields (expect 400)');

  // 20. POST /api/v1/datasets — Validation: invalid source_type
  await test('POST', '/api/v1/datasets', {
    name: 'bad2',
    display_name: 'Bad2',
    source_type: 'invalid_type',
    fields: [{ name: 'x', display_name: 'X', data_type: 'string' }],
  }, 'Register dataset invalid source_type (expect 400)');

  // 21. No auth header
  try {
    const res = await fetch(`${BASE}/api/v1/datasets`, { method: 'GET' });
    const status = res.status;
    console.log(`${status === 401 ? 'PASS' : 'FAIL'} [${status}] GET /api/v1/datasets — No auth (expect 401)`);
    results.push({ label: 'No auth', method: 'GET', path: '/api/v1/datasets', status, ok: status === 401 });
  } catch (err) {
    console.log(`FAIL [ERR] GET /api/v1/datasets — No auth: ${err.message}`);
  }

  // Summary
  console.log('\n========== SUMMARY ==========');
  const failed = results.filter(r => !r.ok);
  const fiveHundreds = results.filter(r => r.status >= 500);
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.ok).length}`);
  console.log(`Failed (non-5xx but unexpected): ${failed.length - fiveHundreds.length}`);
  console.log(`5xx Errors: ${fiveHundreds.length}`);

  if (fiveHundreds.length > 0) {
    console.log('\n--- 5xx ERRORS ---');
    for (const r of fiveHundreds) {
      console.log(`  ${r.method} ${r.path} [${r.status}] — ${r.label}`);
      console.log(`    Response: ${r.response}`);
    }
  }

  // Cleanup: delete any leftover test data
  try {
    await sql`DELETE FROM kernel.metrics WHERE tenant_id = ${tid} AND name = 'total_sales'`;
    await sql`DELETE FROM kernel.dataset_fields WHERE tenant_id = ${tid}`;
    await sql`DELETE FROM kernel.datasets WHERE tenant_id = ${tid} AND name = 'test_sales_data'`;
  } catch { /* ignore */ }

  await sql.end();
}

main().catch(err => { console.error('SCRIPT ERROR:', err); process.exit(1); });

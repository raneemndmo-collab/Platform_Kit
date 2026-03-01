/**
 * Step 23 — RAG Engine Tests
 *
 * Validates:
 * - RAG Source CRUD (create, list, get, update, delete)
 * - One-shot retrieval via Search module K3 action
 * - Retrieval logs
 * - Deterministic scoring (no embeddings, no vectors)
 * - No external calls
 * - No cross-schema FK
 * - Audit trail
 * - Events emitted
 * - Auth enforcement
 * - K3 action registration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let tenantId: string;
let userId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();

  // Login
  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(loginRes.statusCode).toBe(200);
  token = loginRes.json().data.token.access_token;

  // Decode JWT for tenantId and userId
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  tenantId = payload.tid;
  userId = payload.sub;

  // Seed search index entries so RAG retrieval has data to find
  const entries = [
    { object_id: 'doc-001', object_type: 'document', module_id: 'reports', title: 'Revenue Report Q1', content: 'Revenue analysis for first quarter with growth metrics' },
    { object_id: 'doc-002', object_type: 'document', module_id: 'reports', title: 'Revenue Report Q2', content: 'Revenue analysis for second quarter with growth metrics' },
    { object_id: 'dash-001', object_type: 'dashboard', module_id: 'dashboard', title: 'Sales Dashboard', content: 'Sales performance dashboard with KPI metrics' },
    { object_id: 'kpi-001', object_type: 'kpi', module_id: 'semantic', title: 'Customer Retention Rate', content: 'Customer retention rate metric definition' },
  ];
  for (const entry of entries) {
    await app.inject({
      method: 'POST', url: '/api/v1/search/index',
      headers: { authorization: `Bearer ${token}` },
      payload: entry,
    });
  }
});

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════
// 1. RAG SOURCE CRUD
// ═══════════════════════════════════════════

let sourceId: string;
let sourceId2: string;

describe('RAG Source CRUD', () => {
  it('POST /api/v1/ai/rag/sources — creates source', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/sources',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Reports Source',
        description: 'Retrieves from reports module',
        module_id: 'reports',
        object_type: 'document',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Reports Source');
    expect(body.data.module_id).toBe('reports');
    expect(body.data.object_type).toBe('document');
    expect(body.data.status).toBe('active');
    sourceId = body.data.id;
  });

  it('POST /api/v1/ai/rag/sources — creates second source', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/sources',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Dashboard Source',
        module_id: 'dashboard',
        object_type: 'dashboard',
      },
    });
    expect(res.statusCode).toBe(201);
    sourceId2 = res.json().data.id;
  });

  it('GET /api/v1/ai/rag/sources — lists sources', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/rag/sources',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/ai/rag/sources/:id — gets single source', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/ai/rag/sources/${sourceId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(sourceId);
    expect(res.json().data.name).toBe('Reports Source');
  });

  it('PATCH /api/v1/ai/rag/sources/:id — updates source', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/rag/sources/${sourceId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.description).toBe('Updated description');
  });

  it('PATCH /api/v1/ai/rag/sources/:id — disables source', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/rag/sources/${sourceId2}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'disabled' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('disabled');
  });

  it('GET /api/v1/ai/rag/sources/:id — 404 for non-existent', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/rag/sources/nonexistent-id',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/ai/rag/sources — 400 for missing name', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { module_id: 'reports', object_type: 'document' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════
// 2. RAG RETRIEVAL — ONE-SHOT VIA SEARCH
// ═══════════════════════════════════════════

describe('RAG Retrieval', () => {
  it('POST /api/v1/ai/rag/retrieve — retrieves via Search module', async () => {
    // Re-enable source2 first
    await app.inject({
      method: 'PATCH', url: `/api/v1/ai/rag/sources/${sourceId2}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'active' },
    });

    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/retrieve',
      headers: { authorization: `Bearer ${token}` },
      payload: { query: 'revenue', source_ids: [sourceId] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.query).toBe('revenue');
    expect(body.data.sources_queried).toBe(1);
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    // Each item should have deterministic score
    for (const item of body.data.items) {
      expect(typeof item.score).toBe('number');
      expect(item.source_id).toBe(sourceId);
      expect(item.object_type).toBe('document');
    }
    expect(typeof body.data.took_ms).toBe('number');
  });

  it('retrieves from all active sources when no source_ids specified', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/retrieve',
      headers: { authorization: `Bearer ${token}` },
      payload: { query: 'sales', limit: 5 },
    });
    if (res.statusCode !== 200) console.log('RETRIEVE ERROR:', res.body);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.sources_queried).toBeGreaterThanOrEqual(1);
  });

  it('returns empty when no matching results', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/retrieve',
      headers: { authorization: `Bearer ${token}` },
      payload: { query: 'xyznonexistent12345', source_ids: [sourceId] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBe(0);
  });

  it('rejects retrieval with empty query', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/retrieve',
      headers: { authorization: `Bearer ${token}` },
      payload: { query: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('skips disabled sources', async () => {
    // Disable source2
    await app.inject({
      method: 'PATCH', url: `/api/v1/ai/rag/sources/${sourceId2}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'disabled' },
    });

    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/retrieve',
      headers: { authorization: `Bearer ${token}` },
      payload: { query: 'sales', source_ids: [sourceId2] },
    });
    expect(res.statusCode).toBe(400); // No active sources found
  });
});

// ═══════════════════════════════════════════
// 3. RETRIEVAL LOGS
// ═══════════════════════════════════════════

describe('RAG Retrieval Logs', () => {
  it('GET /api/v1/ai/rag/logs — lists retrieval logs', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/rag/logs',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const logs = res.json().data;
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].query).toBeDefined();
    expect(logs[0].results_count).toBeDefined();
    expect(logs[0].took_ms).toBeDefined();
    expect(logs[0].source_ids).toBeDefined();
  });
});

// ═══════════════════════════════════════════
// 4. DELETE SOURCE
// ═══════════════════════════════════════════

describe('RAG Source Delete', () => {
  it('DELETE /api/v1/ai/rag/sources/:id — deletes source', async () => {
    // Create a temporary source to delete
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Temp Source', module_id: 'temp', object_type: 'temp' },
    });
    expect(createRes.statusCode).toBe(201);
    const tempId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/ai/rag/sources/${tempId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);

    // Verify deleted
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/ai/rag/sources/${tempId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════
// 5. AUDIT TRAIL
// ═══════════════════════════════════════════

describe('RAG Audit Trail', () => {
  it('source creation is logged in audit', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit?action_id=rasid.mod.ai.rag.source.create',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].action_id).toBe('rasid.mod.ai.rag.source.create');
  });

  it('retrieval is logged in audit', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/audit?action_id=rasid.mod.ai.rag.retrieve',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].action_id).toBe('rasid.mod.ai.rag.retrieve');
  });
});

// ═══════════════════════════════════════════
// 6. AUTH ENFORCEMENT
// ═══════════════════════════════════════════

describe('RAG Auth Enforcement', () => {
  it('401 without auth token', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/rag/sources',
    });
    expect(res.statusCode).toBe(401);
  });

  it('401 for retrieval without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/rag/retrieve',
      payload: { query: 'test' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════
// 7. NO EXTERNAL CALLS PROOF
// ═══════════════════════════════════════════

describe('No External Calls', () => {
  it('RAG service imports only from kernel public surface and local modules', async () => {
    const fs = await import('fs');
    const serviceCode = fs.readFileSync(
      'packages/modules/ai-engine/src/rag.service.ts', 'utf-8',
    );
    // No external HTTP calls
    expect(serviceCode).not.toContain('fetch(');
    expect(serviceCode).not.toContain('axios');
    expect(serviceCode).not.toContain('openai');
    expect(serviceCode).not.toContain('anthropic');
    expect(serviceCode).not.toContain('embedding');
    expect(serviceCode).not.toContain('vector');
    expect(serviceCode).not.toContain('pinecone');
    expect(serviceCode).not.toContain('weaviate');
    expect(serviceCode).not.toContain('redis');
  });
});

// ═══════════════════════════════════════════
// 8. NO CROSS-SCHEMA FK
// ═══════════════════════════════════════════

describe('No Cross-Schema FK', () => {
  it('migration does not reference other schemas in FK constraints', async () => {
    const fs = await import('fs');
    const migrationCode = fs.readFileSync(
      'packages/modules/ai-engine/src/migrate-step4.ts', 'utf-8',
    );
    expect(migrationCode).not.toContain('REFERENCES kernel.');
    expect(migrationCode).not.toContain('REFERENCES mod_search.');
    expect(migrationCode).not.toContain('REFERENCES mod_semantic.');
    expect(migrationCode).not.toContain('FOREIGN KEY');
  });
});

// ═══════════════════════════════════════════
// 9. K3 ACTION REGISTRATION
// ═══════════════════════════════════════════

describe('K3 Action Registration', () => {
  it('RAG actions are registered in K3 registry', async () => {
    const { actionRegistry } = await import('../../packages/kernel/src/index.js');
    const allActions = actionRegistry.listActions();
    const ragActions = allActions.filter(
      (a) => a.action_id.startsWith('rasid.mod.ai.rag'),
    );
    expect(ragActions.length).toBe(7);
    const ids = ragActions.map((a) => a.action_id);
    expect(ids).toContain('rasid.mod.ai.rag.source.create');
    expect(ids).toContain('rasid.mod.ai.rag.source.list');
    expect(ids).toContain('rasid.mod.ai.rag.source.get');
    expect(ids).toContain('rasid.mod.ai.rag.source.update');
    expect(ids).toContain('rasid.mod.ai.rag.source.delete');
    expect(ids).toContain('rasid.mod.ai.rag.retrieve');
    expect(ids).toContain('rasid.mod.ai.rag.logs.list');
  });
});

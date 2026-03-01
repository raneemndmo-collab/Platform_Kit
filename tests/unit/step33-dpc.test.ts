/**
 * STEP 33 — DPC (Document Processing Cluster) Provisioning Tests
 *
 * Tier X STEP 0: Infrastructure Isolation
 * Tests all 5 DPC entities: Node Pools, Resource Quotas, Job Priority Tiers,
 * Module Slots, Capacity Snapshots.
 * All metadata-only. No external calls. No cross-schema FK.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;

async function login(email = 'admin@acme.com', password = 'Admin123!', tenant_slug = 'acme'): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password, tenant_slug } });
  return JSON.parse(res.body).data.token.access_token;
}

function authHeaders() {
  return { authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  app = await buildServer();
  await reseed();
  token = await login();
}, 30_000);

/* ═══════════════════════════════════════════════════════════════
   NODE POOLS
   ═══════════════════════════════════════════════════════════════ */
describe('DPC Node Pools', () => {
  let poolId: string;

  it('POST /api/v1/dpc/pools → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/pools',
      headers: authHeaders(),
      payload: {
        name: 'gpu-pool-a100',
        pool_type: 'gpu',
        min_nodes: 2,
        max_nodes: 16,
        cpu_per_node: 32,
        memory_gb_per_node: 256,
        gpu_per_node: 4,
        labels: { gpu_model: 'A100', region: 'us-east' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('gpu-pool-a100');
    expect(body.data.pool_type).toBe('gpu');
    poolId = body.data.id;
  });

  it('GET /api/v1/dpc/pools → 200 (list)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dpc/pools', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/dpc/pools/:id → 200', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/pools/${poolId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(poolId);
  });

  it('PATCH /api/v1/dpc/pools/:id → 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dpc/pools/${poolId}`,
      headers: authHeaders(),
      payload: { name: 'gpu-pool-a100-v2', status: 'draining' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('gpu-pool-a100-v2');
    expect(res.json().data.status).toBe('draining');
  });

  it('DELETE /api/v1/dpc/pools/:id → 204', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/dpc/pools/${poolId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(204);
  });

  it('GET deleted pool → 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/pools/${poolId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════════════════
   RESOURCE QUOTAS
   ═══════════════════════════════════════════════════════════════ */
describe('DPC Resource Quotas', () => {
  let quotaId: string;

  it('POST /api/v1/dpc/quotas → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/quotas',
      headers: authHeaders(),
      payload: {
        scope: 'cluster',
        scope_ref: 'main-cluster',
        max_cpu: 256,
        max_memory_gb: 1024,
        max_gpu: 32,
        max_concurrent_jobs: 50,
        description: 'Main cluster quota',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.scope).toBe('cluster');
    expect(Number(body.data.max_concurrent_jobs)).toBe(50);
    quotaId = body.data.id;
  });

  it('GET /api/v1/dpc/quotas → 200 (list)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dpc/quotas', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('GET /api/v1/dpc/quotas/:id → 200', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/quotas/${quotaId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(quotaId);
  });

  it('PATCH /api/v1/dpc/quotas/:id → 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dpc/quotas/${quotaId}`,
      headers: authHeaders(),
      payload: { max_concurrent_jobs: 100 },
    });
    expect(res.statusCode).toBe(200);
    expect(Number(res.json().data.max_concurrent_jobs)).toBe(100);
  });

  it('DELETE /api/v1/dpc/quotas/:id → 204', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/dpc/quotas/${quotaId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(204);
  });

  it('GET deleted quota → 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/quotas/${quotaId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════════════════
   JOB PRIORITY TIERS
   ═══════════════════════════════════════════════════════════════ */
describe('DPC Job Priority Tiers', () => {
  let tierId: string;

  it('POST /api/v1/dpc/priorities → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/priorities',
      headers: authHeaders(),
      payload: {
        level: 'P0',
        name: 'Critical Compliance',
        max_queue_depth: 100,
        timeout_seconds: 3600,
        concurrency_limit: 20,
        backpressure_threshold: 80,
        description: 'Critical priority for compliance documents',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.level).toBe('P0');
    expect(body.data.name).toBe('Critical Compliance');
    tierId = body.data.id;
  });

  it('GET /api/v1/dpc/priorities → 200 (list)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dpc/priorities', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('GET /api/v1/dpc/priorities/:id → 200', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/priorities/${tierId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(tierId);
  });

  it('PATCH /api/v1/dpc/priorities/:id → 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dpc/priorities/${tierId}`,
      headers: authHeaders(),
      payload: { concurrency_limit: 50, timeout_seconds: 7200 },
    });
    expect(res.statusCode).toBe(200);
    expect(Number(res.json().data.concurrency_limit)).toBe(50);
    expect(Number(res.json().data.timeout_seconds)).toBe(7200);
  });

  it('DELETE /api/v1/dpc/priorities/:id → 204', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/dpc/priorities/${tierId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(204);
  });

  it('GET deleted tier → 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/priorities/${tierId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════════════════
   MODULE SLOTS
   ═══════════════════════════════════════════════════════════════ */
describe('DPC Module Slots', () => {
  let slotId: string;

  it('POST /api/v1/dpc/modules → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/modules',
      headers: authHeaders(),
      payload: {
        module_code: 'D1',
        module_name: 'CDR Engine',
        database_name: 'rasid_platform',
        schema_name: 'mod_d1_cdr',
        pool_type: 'gpu',
        event_namespace: 'tierx.d1',
        api_prefix: '/api/v1/d1',
        config: { max_file_size_mb: 200, supported_formats: ['pdf', 'docx', 'xlsx'] },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.module_code).toBe('D1');
    expect(body.data.module_name).toBe('CDR Engine');
    slotId = body.data.id;
  });

  it('POST /api/v1/dpc/modules → 201 (second slot)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/modules',
      headers: authHeaders(),
      payload: {
        module_code: 'D2',
        module_name: 'Document Schema Registry',
        database_name: 'rasid_platform',
        schema_name: 'mod_d2_dsr',
        pool_type: 'cpu',
        event_namespace: 'tierx.d2',
        api_prefix: '/api/v1/d2',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.module_code).toBe('D2');
  });

  it('GET /api/v1/dpc/modules → 200 (list shows 2)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dpc/modules', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/dpc/modules/:id → 200', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/modules/${slotId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.module_code).toBe('D1');
  });

  it('PATCH /api/v1/dpc/modules/:id → 200 (activate)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dpc/modules/${slotId}`,
      headers: authHeaders(),
      payload: { status: 'active' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('active');
  });

  it('DELETE /api/v1/dpc/modules/:id → 204', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/dpc/modules/${slotId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(204);
  });

  it('GET deleted slot → 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/modules/${slotId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════════════════
   CAPACITY SNAPSHOTS
   ═══════════════════════════════════════════════════════════════ */
describe('DPC Capacity Snapshots', () => {
  let poolId: string;
  let snapId: string;

  it('setup: create a pool for snapshots', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/pools',
      headers: authHeaders(),
      payload: {
        name: 'snap-test-pool',
        pool_type: 'cpu',
        min_nodes: 1,
        max_nodes: 8,
        cpu_per_node: 16,
        memory_gb_per_node: 64,
      },
    });
    expect(res.statusCode).toBe(201);
    poolId = res.json().data.id;
  });

  it('POST /api/v1/dpc/capacity → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/capacity',
      headers: authHeaders(),
      payload: {
        pool_id: poolId,
        total_cpu: 128,
        used_cpu: 45,
        total_memory_gb: 512,
        used_memory_gb: 200,
        total_gpu: 0,
        used_gpu: 0,
        active_jobs: 12,
        queued_jobs: 5,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(Number(body.data.total_cpu)).toBe(128);
    expect(Number(body.data.active_jobs)).toBe(12);
    snapId = body.data.id;
  });

  it('POST /api/v1/dpc/capacity → 201 (second snapshot)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/capacity',
      headers: authHeaders(),
      payload: {
        pool_id: poolId,
        total_cpu: 128,
        used_cpu: 100,
        total_memory_gb: 512,
        used_memory_gb: 400,
        active_jobs: 30,
        queued_jobs: 15,
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('GET /api/v1/dpc/capacity → 200 (list all)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dpc/capacity', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/dpc/capacity?pool_id=... → 200 (filtered)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/capacity?pool_id=${poolId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.length).toBeGreaterThanOrEqual(2);
    for (const snap of data) {
      expect(snap.pool_id).toBe(poolId);
    }
  });

  it('GET /api/v1/dpc/capacity/:id → 200', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/capacity/${snapId}`, headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(snapId);
  });
});

/* ═══════════════════════════════════════════════════════════════
   TENANT ISOLATION (RLS)
   ═══════════════════════════════════════════════════════════════ */
describe('DPC Tenant Isolation', () => {
  let betaToken: string;
  let acmePoolId: string;

  it('setup: create pool as acme', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/pools',
      headers: authHeaders(),
      payload: {
        name: 'acme-isolated-pool',
        pool_type: 'gpu',
        min_nodes: 1,
        max_nodes: 4,
        cpu_per_node: 8,
        memory_gb_per_node: 32,
        gpu_per_node: 2,
      },
    });
    expect(res.statusCode).toBe(201);
    acmePoolId = res.json().data.id;
  });

  it('setup: login as beta admin', async () => {
    betaToken = await login('admin@beta.com', 'Admin123!', 'beta');
  });

  it('beta cannot see acme pools', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dpc/pools', headers: { authorization: `Bearer ${betaToken}` } });
    expect(res.statusCode).toBe(200);
    const pools = res.json().data;
    const acmePool = pools.find((p: any) => p.id === acmePoolId);
    expect(acmePool).toBeUndefined();
  });

  it('beta cannot access acme pool by ID', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/dpc/pools/${acmePoolId}`, headers: { authorization: `Bearer ${betaToken}` } });
    expect(res.statusCode).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════════════════ */
describe('DPC Validation', () => {
  it('POST /api/v1/dpc/pools with missing required fields → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/pools',
      headers: authHeaders(),
      payload: { pool_type: 'cpu' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/dpc/quotas with invalid scope → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/quotas',
      headers: authHeaders(),
      payload: { scope: 'invalid_scope', scope_ref: 'test', max_cpu: 10, max_memory_gb: 10, max_concurrent_jobs: 5 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/dpc/priorities with missing level → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/priorities',
      headers: authHeaders(),
      payload: { name: 'test', max_queue_depth: 10, timeout_seconds: 60, concurrency_limit: 5, backpressure_threshold: 80 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/dpc/modules with missing module_code → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dpc/modules',
      headers: authHeaders(),
      payload: { module_name: 'Test', database_name: 'db', schema_name: 's', pool_type: 'cpu', event_namespace: 'ns', api_prefix: '/api' },
    });
    expect(res.statusCode).toBe(400);
  });
});

/* ═══════════════════════════════════════════════════════════════
   UNAUTHENTICATED ACCESS
   ═══════════════════════════════════════════════════════════════ */
describe('DPC Unauthenticated Access', () => {
  it('GET /api/v1/dpc/pools without token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dpc/pools' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/dpc/quotas without token → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/dpc/quotas', payload: { scope: 'cluster' } });
    expect(res.statusCode).toBe(401);
  });
});

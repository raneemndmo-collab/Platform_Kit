/**
 * Step 12 — M11 Semantic Model + KPI Hub tests
 *
 * Tests: model CRUD, dimensions, facts, relationships, KPI CRUD,
 *        KPI versioning, KPI approve/deprecate, impact preview,
 *        audit trail via K3 pipeline.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let tenantId: string;

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
  expect(loginRes.statusCode).toBe(200);
  const loginBody = loginRes.json();
  token = loginBody.data.token.access_token;
  // Decode tenant_id from JWT
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  tenantId = payload.tenant_id;
});

afterAll(async () => {
  await app.close();
});

function headers() {
  return { authorization: `Bearer ${token}` };
}

/* ═══════════════════════════════════════════
 * MODEL CRUD
 * ═══════════════════════════════════════════ */

describe('M11 — Semantic Models', () => {
  let modelId: string;

  it('should create a semantic model', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/semantic/models',
      headers: headers(),
      payload: { name: 'Sales Model', description: 'Revenue analysis model' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Sales Model');
    expect(body.data.status).toBe('draft');
    expect(body.data.version).toBe(1);
    expect(body.meta.audit_id).toBeDefined();
    modelId = body.data.id;
  });

  it('should list models', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/semantic/models',
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('should get model by id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/semantic/models/${modelId}`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(modelId);
  });

  it('should update a model', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/semantic/models/${modelId}`,
      headers: headers(),
      payload: { name: 'Sales Model v2' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Sales Model v2');
    expect(res.json().meta.audit_id).toBeDefined();
  });

  it('should publish a model', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/semantic/models/${modelId}/publish`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('published');
    expect(res.json().data.version).toBe(2);
  });

  it('should return 404 for non-existent model', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/semantic/models/01961234-5678-7000-8000-000000000000',
      headers: headers(),
    });
    expect(res.statusCode).toBe(404);
  });

  /* ═══════════════════════════════════════════
   * DIMENSIONS
   * ═══════════════════════════════════════════ */

  describe('Dimensions', () => {
    let dimId: string;

    it('should define a dimension', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/semantic/models/${modelId}/dimensions`,
        headers: headers(),
        payload: { name: 'Region', dim_type: 'geographic', source_column: 'region_code' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.name).toBe('Region');
      expect(res.json().data.dim_type).toBe('geographic');
      dimId = res.json().data.id;
    });

    it('should define a time dimension', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/semantic/models/${modelId}/dimensions`,
        headers: headers(),
        payload: { name: 'Date', dim_type: 'time', source_column: 'order_date' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.dim_type).toBe('time');
    });

    it('should list dimensions for model', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/semantic/models/${modelId}/dimensions`,
        headers: headers(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBe(2);
    });

    it('should delete a dimension', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/semantic/dimensions/${dimId}`,
        headers: headers(),
      });
      expect(res.statusCode).toBe(204);
    });
  });

  /* ═══════════════════════════════════════════
   * FACTS
   * ═══════════════════════════════════════════ */

  describe('Facts', () => {
    let factId: string;

    it('should define a fact', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/semantic/models/${modelId}/facts`,
        headers: headers(),
        payload: { name: 'Total Revenue', expression: 'SUM(order_amount)', aggregation: 'sum', format: 'currency' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.name).toBe('Total Revenue');
      expect(res.json().data.aggregation).toBe('sum');
      factId = res.json().data.id;
    });

    it('should define a count fact', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/semantic/models/${modelId}/facts`,
        headers: headers(),
        payload: { name: 'Order Count', expression: 'COUNT(order_id)', aggregation: 'count' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('should list facts for model', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/semantic/models/${modelId}/facts`,
        headers: headers(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBe(2);
    });

    it('should delete a fact', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/semantic/facts/${factId}`,
        headers: headers(),
      });
      expect(res.statusCode).toBe(204);
    });
  });

  /* ═══════════════════════════════════════════
   * RELATIONSHIPS
   * ═══════════════════════════════════════════ */

  describe('Relationships', () => {
    let relId: string;
    let dimA: string;
    let dimB: string;

    beforeAll(async () => {
      // Create two dimensions for relationship
      const resA = await app.inject({
        method: 'POST',
        url: `/api/v1/semantic/models/${modelId}/dimensions`,
        headers: headers(),
        payload: { name: 'Product', dim_type: 'standard' },
      });
      dimA = resA.json().data.id;

      const resB = await app.inject({
        method: 'POST',
        url: `/api/v1/semantic/models/${modelId}/dimensions`,
        headers: headers(),
        payload: { name: 'Category', dim_type: 'hierarchy' },
      });
      dimB = resB.json().data.id;
    });

    it('should create a relationship', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/semantic/models/${modelId}/relationships`,
        headers: headers(),
        payload: { source_dimension_id: dimA, target_dimension_id: dimB, rel_type: 'many_to_many' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.rel_type).toBe('many_to_many');
      relId = res.json().data.id;
    });

    it('should list relationships for model', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/semantic/models/${modelId}/relationships`,
        headers: headers(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBe(1);
    });

    it('should delete a relationship', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/semantic/relationships/${relId}`,
        headers: headers(),
      });
      expect(res.statusCode).toBe(204);
    });
  });

  /* ═══════════════════════════════════════════
   * DELETE MODEL
   * ═══════════════════════════════════════════ */

  it('should delete a model', async () => {
    // Create a fresh model to delete
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/semantic/models',
      headers: headers(),
      payload: { name: 'Temp Model' },
    });
    const tmpId = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/semantic/models/${tmpId}`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(204);
  });
});

/* ═══════════════════════════════════════════
 * KPI CRUD + VERSIONING + LIFECYCLE
 * ═══════════════════════════════════════════ */

describe('M11 — KPI Hub', () => {
  let kpiId: string;

  it('should create a KPI', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/semantic/kpis',
      headers: headers(),
      payload: {
        name: 'Revenue Growth',
        formula: '(current_revenue - prev_revenue) / prev_revenue * 100',
        dimensions: ['region', 'time'],
        target_value: 15,
        threshold_warning: 10,
        threshold_critical: 5,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Revenue Growth');
    expect(body.data.status).toBe('draft');
    expect(body.data.version).toBe(1);
    expect(body.data.formula).toContain('current_revenue');
    expect(body.meta.audit_id).toBeDefined();
    kpiId = body.data.id;
  });

  it('should list KPIs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/semantic/kpis',
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('should get KPI by id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/semantic/kpis/${kpiId}`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(kpiId);
  });

  it('should update KPI and create version', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/semantic/kpis/${kpiId}`,
      headers: headers(),
      payload: {
        formula: '(current_revenue - prev_revenue) / prev_revenue * 100 + adjustment',
        target_value: 20,
        change_reason: 'Added adjustment factor',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.version).toBe(2);
    expect(body.data.target_value).toBe(20);
    expect(body.data.status).toBe('draft');
  });

  it('should have 2 versions after update', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/semantic/kpis/${kpiId}/versions`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const versions = res.json().data;
    expect(versions.length).toBe(2);
    expect(versions[0].version).toBe(2);
    expect(versions[1].version).toBe(1);
    expect(versions[0].change_reason).toBe('Added adjustment factor');
  });

  it('should approve a KPI', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/semantic/kpis/${kpiId}/approve`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('approved');
    expect(res.json().data.approved_by).toBeDefined();
    expect(res.json().data.approved_at).toBeDefined();
  });

  it('should deprecate a KPI', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/semantic/kpis/${kpiId}/deprecate`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('deprecated');
  });

  it('should return 404 for non-existent KPI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/semantic/kpis/01961234-5678-7000-8000-000000000000',
      headers: headers(),
    });
    expect(res.statusCode).toBe(404);
  });

  /* ═══════════════════════════════════════════
   * IMPACT PREVIEW
   * ═══════════════════════════════════════════ */

  it('should preview KPI impact', async () => {
    // Create a fresh KPI for impact
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/semantic/kpis',
      headers: headers(),
      payload: { name: 'Customer Satisfaction', formula: 'AVG(satisfaction_score)' },
    });
    const impactKpiId = createRes.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/semantic/kpis/${impactKpiId}/impact`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.kpi_id).toBe(impactKpiId);
    expect(body.data.kpi_name).toBe('Customer Satisfaction');
    expect(body.data.current_version).toBe(1);
    expect(body.data.dependent_dashboards).toBe(0);
    expect(body.data.version_history_count).toBe(1);
  });
});

/* ═══════════════════════════════════════════
 * VALIDATION
 * ═══════════════════════════════════════════ */

describe('M11 — Validation', () => {
  it('should reject model creation without name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/semantic/models',
      headers: headers(),
      payload: { description: 'no name' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should reject KPI creation without formula', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/semantic/kpis',
      headers: headers(),
      payload: { name: 'No Formula KPI' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should reject fact creation without expression', async () => {
    // Create model first
    const modelRes = await app.inject({
      method: 'POST',
      url: '/api/v1/semantic/models',
      headers: headers(),
      payload: { name: 'Validation Test Model' },
    });
    const mId = modelRes.json().data.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/semantic/models/${mId}/facts`,
      headers: headers(),
      payload: { name: 'Bad Fact' },
    });
    expect(res.statusCode).toBe(400);
  });
});

/* ═══════════════════════════════════════════
 * AUTH GUARD
 * ═══════════════════════════════════════════ */

describe('M11 — Auth Guard', () => {
  it('should reject unauthenticated model list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/semantic/models',
    });
    expect(res.statusCode).toBe(401);
  });

  it('should reject unauthenticated KPI list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/semantic/kpis',
    });
    expect(res.statusCode).toBe(401);
  });
});

/* ═══════════════════════════════════════════
 * AUDIT TRAIL
 * ═══════════════════════════════════════════ */

describe('M11 — Audit Trail', () => {
  it('should have audit records for M11 actions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=50',
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const entries = res.json().data.items;
    const semanticEntries = entries.filter((e: { action_id: string }) => e.action_id.startsWith('rasid.mod.semantic'));
    expect(semanticEntries.length).toBeGreaterThanOrEqual(5);
  });
});

/**
 * K7 — Lineage Engine Tests (Phase 1)
 *
 * Tests:
 * 1. Add edge — 201
 * 2. Duplicate edge — 201 (idempotent, no error)
 * 3. Self-loop — 400
 * 4. Cycle detection — 400
 * 5. Get upstream — returns source nodes
 * 6. Get downstream — returns target nodes
 * 7. Get impact — returns downstream count + depth
 * 8. Remove edge — 204
 * 9. Remove non-existent edge — 404
 * 10. Depth limit — respects max depth
 * 11. No auth — 401
 * 12. Tenant isolation — Tenant B cannot see Tenant A edges
 * 13. Multi-hop traversal — A→B→C→D
 * 14. Validation — missing fields — 400
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { adminSql, appSql } from '../../packages/kernel/src/db/connection.js';
import { reseed } from '../helpers/reseed.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let acmeAdminToken: string;
let betaAdminToken: string;
// Tenant IDs are dynamic (from reseed), not needed directly in tests

beforeAll(async () => {
  // Reseed all data (step2 destroys seed data)
  await reseed();

  app = await buildServer();

  // Clean lineage_edges
  await adminSql`DELETE FROM kernel.lineage_edges`;

  // Login as admin@acme.com
  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  expect(acmeLogin.statusCode).toBe(200);
  acmeAdminToken = JSON.parse(acmeLogin.body).data.token.access_token;

  // Login as admin@beta.com
  const betaLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
  });
  expect(betaLogin.statusCode).toBe(200);
  betaAdminToken = JSON.parse(betaLogin.body).data.token.access_token;
});

afterAll(async () => {
  await adminSql`DELETE FROM kernel.lineage_edges`;
  await app.close();
});

describe('K7 Lineage Engine', () => {
  describe('Edge Management', () => {
    it('should add an edge — 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'dataset-1',
          source_type: 'dataset',
          target_id: 'metric-1',
          target_type: 'metric',
          relationship: 'derived_from',
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it('should handle duplicate edge idempotently — 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'dataset-1',
          source_type: 'dataset',
          target_id: 'metric-1',
          target_type: 'metric',
          relationship: 'derived_from',
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it('should reject self-loop — 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'dataset-1',
          source_type: 'dataset',
          target_id: 'dataset-1',
          target_type: 'dataset',
          relationship: 'depends_on',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('Self-loop');
    });

    it('should reject validation errors — 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: { source_id: 'dataset-1' }, // missing required fields
      });
      expect(res.statusCode).toBe(400);
    });

    it('should remove an edge — 204', async () => {
      // First add a unique edge to remove
      await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'temp-source',
          source_type: 'dataset',
          target_id: 'temp-target',
          target_type: 'metric',
          relationship: 'feeds_into',
        },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'temp-source',
          target_id: 'temp-target',
          relationship: 'feeds_into',
        },
      });
      expect(res.statusCode).toBe(204);
    });

    it('should return 404 for non-existent edge removal', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'nonexistent-source',
          target_id: 'nonexistent-target',
          relationship: 'nonexistent',
        },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Cycle Detection', () => {
    it('should detect and reject cycles — 400', async () => {
      // Create chain: A → B → C
      await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'node-A',
          source_type: 'dataset',
          target_id: 'node-B',
          target_type: 'dataset',
          relationship: 'feeds_into',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'node-B',
          source_type: 'dataset',
          target_id: 'node-C',
          target_type: 'dataset',
          relationship: 'feeds_into',
        },
      });

      // Try to create C → A (would create cycle)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'node-C',
          source_type: 'dataset',
          target_id: 'node-A',
          target_type: 'dataset',
          relationship: 'feeds_into',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('cycle');
    });
  });

  describe('Graph Traversal', () => {
    beforeAll(async () => {
      // Build a SELF-CONTAINED chain: dataset-1 → metric-1 → report-1 → dashboard-1
      // Each edge is created explicitly — no dependency on earlier tests.
      // The POST endpoint is idempotent (duplicate = 201), so re-creating is safe.
      await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'dataset-1',
          source_type: 'dataset',
          target_id: 'metric-1',
          target_type: 'metric',
          relationship: 'derived_from',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'metric-1',
          source_type: 'metric',
          target_id: 'report-1',
          target_type: 'report',
          relationship: 'feeds_into',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
        payload: {
          source_id: 'report-1',
          source_type: 'report',
          target_id: 'dashboard-1',
          target_type: 'dashboard',
          relationship: 'feeds_into',
        },
      });
    });

    it('should get upstream nodes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/dashboard-1/upstream?depth=10',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.items.length).toBeGreaterThanOrEqual(3);
      expect(body.data.direction).toBe('upstream');
      // Should include report-1, metric-1, dataset-1
      const ids = body.data.items.map((n: { id: string }) => n.id);
      expect(ids).toContain('report-1');
      expect(ids).toContain('metric-1');
      expect(ids).toContain('dataset-1');
    });

    it('should get downstream nodes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/dataset-1/downstream?depth=10',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.items.length).toBeGreaterThanOrEqual(3);
      expect(body.data.direction).toBe('downstream');
      const ids = body.data.items.map((n: { id: string }) => n.id);
      expect(ids).toContain('metric-1');
      expect(ids).toContain('report-1');
      expect(ids).toContain('dashboard-1');
    });

    it('should respect depth limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/dataset-1/downstream?depth=1',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Depth 1 should only return metric-1 (direct downstream)
      expect(body.data.items.length).toBe(1);
      expect(body.data.items[0].id).toBe('metric-1');
    });

    it('should get impact report', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/dataset-1/impact',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.node_id).toBe('dataset-1');
      expect(body.data.node_type).toBe('dataset');
      expect(body.data.downstream_count).toBeGreaterThanOrEqual(3);
      expect(body.data.depth_reached).toBeGreaterThanOrEqual(3);
    });

    it('should return empty for node with no edges', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/nonexistent-node/upstream',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.items).toHaveLength(0);
    });
  });

  describe('Auth & Tenant Isolation', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/dataset-1/upstream',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should isolate lineage by tenant — Beta cannot see Acme edges', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/dataset-1/downstream?depth=10',
        headers: { authorization: `Bearer ${betaAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.items).toHaveLength(0);
    });

    it('should allow Beta to add its own edges independently', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: '/api/v1/lineage/edges',
        headers: { authorization: `Bearer ${betaAdminToken}` },
        payload: {
          source_id: 'beta-dataset-1',
          source_type: 'dataset',
          target_id: 'beta-metric-1',
          target_type: 'metric',
          relationship: 'derived_from',
        },
      });
      expect(addRes.statusCode).toBe(201);

      // Beta can see its own edge
      const downRes = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/beta-dataset-1/downstream',
        headers: { authorization: `Bearer ${betaAdminToken}` },
      });
      expect(downRes.statusCode).toBe(200);
      const body = JSON.parse(downRes.body);
      expect(body.data.items.length).toBe(1);
      expect(body.data.items[0].id).toBe('beta-metric-1');

      // Acme cannot see Beta's edge
      const acmeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/lineage/beta-dataset-1/downstream',
        headers: { authorization: `Bearer ${acmeAdminToken}` },
      });
      expect(acmeRes.statusCode).toBe(200);
      expect(JSON.parse(acmeRes.body).data.items).toHaveLength(0);
    });
  });
});

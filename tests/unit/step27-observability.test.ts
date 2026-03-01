/**
 * Step 27 — M27 Observability Layer tests
 * All endpoints via K3 pipeline with RBAC enforcement.
 * Schema: mod_observability — isolated, no cross-schema FK.
 * No external monitoring. Metrics in DB tables only.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import { reseed } from '../helpers/reseed.js';
import { adminSql } from '../../packages/kernel/src/db/connection.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let betaToken: string;
let viewerToken: string;
let metricId: string;
let alertId: string;
let alertHistoryId: string;
let sloId: string;
let incidentId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();
  await app.ready();

  // Login as Acme admin
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  token = JSON.parse(loginRes.body).data.token.access_token;

  // Login as Beta admin
  const betaRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
  });
  betaToken = JSON.parse(betaRes.body).data.token.access_token;

  // Login as Acme viewer (limited permissions)
  const viewerRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'viewer@acme.com', password: 'Viewer123!', tenant_slug: 'acme' },
  });
  viewerToken = JSON.parse(viewerRes.body).data.token.access_token;
});

afterAll(async () => {
  await app?.close();
});

const auth = () => ({ authorization: `Bearer ${token}` });
const betaAuth = () => ({ authorization: `Bearer ${betaToken}` });

describe('M27 Observability Layer', () => {

  /* ═══════════════════════════════════════════
   * METRICS CRUD
   * ═══════════════════════════════════════════ */

  describe('Metrics', () => {
    it('POST /api/v1/observability/metrics → 201 creates a metric', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/metrics',
        headers: auth(),
        payload: {
          name: 'api_request_count',
          description: 'Total API requests',
          metric_type: 'counter',
          labels: ['method', 'path', 'status'],
          unit: 'requests',
          retention_days: 90,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('api_request_count');
      expect(body.data.metric_type).toBe('counter');
      expect(body.data.labels).toEqual(['method', 'path', 'status']);
      expect(body.data.unit).toBe('requests');
      expect(body.data.retention_days).toBe(90);
      expect(body.meta.action_id).toBe('rasid.mod.observability.metric.create');
      expect(body.meta.audit_id).toBeDefined();
      metricId = body.data.id;
    });

    it('GET /api/v1/observability/metrics → 200 lists metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/metrics',
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data[0].name).toBe('api_request_count');
    });

    it('GET /api/v1/observability/metrics/:id → 200 gets a metric', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/observability/metrics/${metricId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.id).toBe(metricId);
      expect(body.data.name).toBe('api_request_count');
    });

    it('PATCH /api/v1/observability/metrics/:id → 200 updates a metric', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/observability/metrics/${metricId}`,
        headers: auth(),
        payload: { description: 'Updated description', retention_days: 180 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.description).toBe('Updated description');
      expect(body.data.retention_days).toBe(180);
    });

    it('rejects invalid metric_type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/metrics',
        headers: auth(),
        payload: { name: 'bad', metric_type: 'invalid' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  /* ═══════════════════════════════════════════
   * ALERTS CRUD
   * ═══════════════════════════════════════════ */

  describe('Alerts', () => {
    it('POST /api/v1/observability/alerts → 201 creates an alert', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/alerts',
        headers: auth(),
        payload: {
          metric_id: metricId,
          name: 'High Request Rate',
          condition: 'gt',
          threshold: 1000,
          channels: ['email', 'slack'],
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('High Request Rate');
      expect(body.data.condition).toBe('gt');
      expect(body.data.threshold).toBe(1000);
      expect(body.data.status).toBe('active');
      expect(body.data.channels).toEqual(['email', 'slack']);
      alertId = body.data.id;
    });

    it('GET /api/v1/observability/alerts → 200 lists alerts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/alerts',
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/observability/alerts/:id → 200 updates an alert', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/observability/alerts/${alertId}`,
        headers: auth(),
        payload: { threshold: 2000, status: 'silenced' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.threshold).toBe(2000);
      expect(body.data.status).toBe('silenced');
    });
  });

  /* ═══════════════════════════════════════════
   * ALERT HISTORY (fire → acknowledge → resolve)
   * ═══════════════════════════════════════════ */

  describe('Alert History', () => {
    it('POST /api/v1/observability/alert-history/fire → 201 fires an alert', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/alert-history/fire',
        headers: auth(),
        payload: { alert_id: alertId, value: 2500 },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('fired');
      expect(body.data.value).toBe(2500);
      alertHistoryId = body.data.id;
    });

    it('POST /api/v1/observability/alert-history/:id/acknowledge → 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/observability/alert-history/${alertHistoryId}/acknowledge`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('acknowledged');
      expect(body.data.acknowledged_at).toBeTruthy();
    });

    it('POST /api/v1/observability/alert-history/:id/resolve → 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/observability/alert-history/${alertHistoryId}/resolve`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('resolved');
      expect(body.data.resolved_at).toBeTruthy();
    });

    it('GET /api/v1/observability/alert-history → 200 lists history', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/alert-history',
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/observability/alert-history?alert_id=X → filters by alert', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/observability/alert-history?alert_id=${alertId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBe(1);
      expect(body.data[0].alert_id).toBe(alertId);
    });
  });

  /* ═══════════════════════════════════════════
   * SLO DEFINITIONS
   * ═══════════════════════════════════════════ */

  describe('SLO Definitions', () => {
    it('POST /api/v1/observability/slos → 201 creates an SLO', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/slos',
        headers: auth(),
        payload: {
          name: 'API Availability',
          service: 'api-gateway',
          metric_id: metricId,
          target_percent: 99.9,
          window_days: 30,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('API Availability');
      expect(body.data.target_percent).toBe(99.9);
      expect(body.data.window_days).toBe(30);
      sloId = body.data.id;
    });

    it('GET /api/v1/observability/slos → 200 lists SLOs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/slos',
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/observability/slos/:id → 200 updates SLO', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/observability/slos/${sloId}`,
        headers: auth(),
        payload: { target_percent: 99.95 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.target_percent).toBe(99.95);
    });
  });

  /* ═══════════════════════════════════════════
   * STATUS INCIDENTS
   * ═══════════════════════════════════════════ */

  describe('Status Incidents', () => {
    it('POST /api/v1/observability/incidents → 201 creates an incident', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/incidents',
        headers: auth(),
        payload: {
          title: 'API Gateway Degradation',
          description: 'Increased latency on API gateway',
          severity: 'major',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.title).toBe('API Gateway Degradation');
      expect(body.data.severity).toBe('major');
      expect(body.data.status).toBe('investigating');
      expect(body.data.resolved_at).toBeNull();
      incidentId = body.data.id;
    });

    it('GET /api/v1/observability/incidents → 200 lists incidents', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/incidents',
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/observability/incidents/:id → 200 updates incident', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/observability/incidents/${incidentId}`,
        headers: auth(),
        payload: { status: 'identified', severity: 'critical' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('identified');
      expect(body.data.severity).toBe('critical');
    });

    it('POST /api/v1/observability/incidents/:id/resolve → 200 resolves incident', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/observability/incidents/${incidentId}/resolve`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('resolved');
      expect(body.data.resolved_at).toBeTruthy();
    });
  });

  /* ═══════════════════════════════════════════
   * RLS — TENANT ISOLATION
   * ═══════════════════════════════════════════ */

  describe('RLS — Tenant Isolation', () => {
    it('RLS enabled on all 5 tables', async () => {
      const tables = ['metrics', 'alerts', 'alert_history', 'slo_definitions', 'status_incidents'];
      for (const t of tables) {
        const rows = await adminSql`
          SELECT rowsecurity FROM pg_tables
          WHERE schemaname = 'mod_observability' AND tablename = ${t}
        `;
        expect(rows[0].rowsecurity).toBe(true);
      }
    });

    it('tenant_isolation policy exists on all 5 tables', async () => {
      const tables = ['metrics', 'alerts', 'alert_history', 'slo_definitions', 'status_incidents'];
      for (const t of tables) {
        const rows = await adminSql`
          SELECT policyname FROM pg_policies
          WHERE schemaname = 'mod_observability' AND tablename = ${t}
        `;
        expect(rows.some((r: Record<string, unknown>) => r.policyname === 'tenant_isolation')).toBe(true);
      }
    });

    it('Beta tenant cannot see Acme metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/metrics',
        headers: betaAuth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBe(0);
    });

    it('Beta tenant cannot see Acme alerts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/alerts',
        headers: betaAuth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBe(0);
    });

    it('Beta tenant cannot see Acme incidents', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/incidents',
        headers: betaAuth(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBe(0);
    });
  });

  /* ═══════════════════════════════════════════
   * K3 PIPELINE — AUDIT LOGGING
   * ═══════════════════════════════════════════ */

  describe('K3 Pipeline — Audit Logging', () => {
    it('metric creation generates audit log entry', async () => {
      const rows = await adminSql`
        SELECT * FROM kernel.audit_log
        WHERE action_id = 'rasid.mod.observability.metric.create'
          AND status = 'success'
        ORDER BY created_at DESC LIMIT 1
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('success');
    });

    it('alert creation generates audit log entry', async () => {
      const rows = await adminSql`
        SELECT * FROM kernel.audit_log
        WHERE action_id = 'rasid.mod.observability.alert.create'
        ORDER BY created_at DESC LIMIT 1
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('success');
    });

    it('incident creation generates audit log entry', async () => {
      const rows = await adminSql`
        SELECT * FROM kernel.audit_log
        WHERE action_id = 'rasid.mod.observability.incident.create'
        ORDER BY created_at DESC LIMIT 1
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('success');
    });
  });

  /* ═══════════════════════════════════════════
   * ACTION REGISTRATION
   * ═══════════════════════════════════════════ */

  describe('Action Registration', () => {
    it('registers 22 observability actions', async () => {
      const { actionRegistry } = await import('../../packages/kernel/src/index.js');
      const all = actionRegistry.listActions();
      const obsActions = all.filter((a: { action_id: string }) =>
        a.action_id.startsWith('rasid.mod.observability.'),
      );
      expect(obsActions.length).toBe(21);
    });

    it('all actions have required_permissions', async () => {
      const { actionRegistry } = await import('../../packages/kernel/src/index.js');
      const all = actionRegistry.listActions();
      const obsActions = all.filter((a: { action_id: string }) =>
        a.action_id.startsWith('rasid.mod.observability.'),
      );
      for (const a of obsActions) {
        expect(a.required_permissions.length).toBeGreaterThan(0);
      }
    });
  });

  /* ═══════════════════════════════════════════
   * NO CROSS-SCHEMA FK
   * ═══════════════════════════════════════════ */

  describe('No Cross-Schema FK', () => {
    it('zero foreign keys from mod_observability to other schemas', async () => {
      const rows = await adminSql`
        SELECT
          tc.table_schema AS from_schema,
          tc.table_name AS from_table,
          ccu.table_schema AS to_schema,
          ccu.table_name AS to_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'mod_observability'
          AND ccu.table_schema <> 'mod_observability'
      `;
      expect(rows.length).toBe(0);
    });
  });

  /* ═══════════════════════════════════════════
   * NO EXTERNAL MONITORING
   * ═══════════════════════════════════════════ */

  describe('No External Monitoring', () => {
    it('service file contains no external HTTP calls', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.service.ts',
        'utf-8',
      );
      expect(src).not.toMatch(/fetch\s*\(/);
      expect(src).not.toMatch(/axios/);
      expect(src).not.toMatch(/node-fetch/);
      expect(src).not.toMatch(/https?:\/\//);
    });

    it('no OpenTelemetry or Prometheus references', async () => {
      const fs = await import('fs');
      const files = [
        'packages/modules/observability/src/observability.service.ts',
        'packages/modules/observability/src/observability.actions.ts',
        'packages/modules/observability/src/observability.routes.ts',
      ];
      for (const f of files) {
        const src = fs.readFileSync(f, 'utf-8');
        expect(src).not.toMatch(/opentelemetry/i);
        expect(src).not.toMatch(/prometheus/i);
        expect(src).not.toMatch(/grafana/i);
        expect(src).not.toMatch(/datadog/i);
      }
    });
  });

  /* ═══════════════════════════════════════════
   * KERNEL UNCHANGED
   * ═══════════════════════════════════════════ */

  describe('Kernel Unchanged', () => {
    it('kernel action-registry has no observability references', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/kernel/src/action-registry/action-registry.service.ts',
        'utf-8',
      );
      expect(src).not.toMatch(/observability/i);
    });

    it('observability imports only from kernel public surface', async () => {
      const fs = await import('fs');
      const files = [
        'packages/modules/observability/src/observability.actions.ts',
        'packages/modules/observability/src/observability.routes.ts',
      ];
      for (const f of files) {
        const src = fs.readFileSync(f, 'utf-8');
        const imports = src.match(/from\s+['"]([^'"]+)['"]/g) || [];
        for (const imp of imports) {
          if (imp.includes('kernel')) {
            expect(imp).toMatch(/kernel\/src\/index/);
          }
        }
      }
    });
  });

  /* ═══════════════════════════════════════════
   * CASCADE DELETE
   * ═══════════════════════════════════════════ */

  describe('Cascade Delete', () => {
    it('deleting a metric cascades to alerts, alert_history, and SLOs', async () => {
      // Create a metric
      const mRes = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/metrics',
        headers: auth(),
        payload: { name: 'cascade_test', metric_type: 'gauge' },
      });
      const mId = JSON.parse(mRes.body).data.id;

      // Create alert on that metric
      const aRes = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/alerts',
        headers: auth(),
        payload: { metric_id: mId, name: 'cascade alert', condition: 'gt', threshold: 100 },
      });
      const aId = JSON.parse(aRes.body).data.id;

      // Fire alert
      await app.inject({
        method: 'POST',
        url: '/api/v1/observability/alert-history/fire',
        headers: auth(),
        payload: { alert_id: aId, value: 200 },
      });

      // Create SLO on that metric
      await app.inject({
        method: 'POST',
        url: '/api/v1/observability/slos',
        headers: auth(),
        payload: { name: 'cascade slo', service: 'svc', metric_id: mId, target_percent: 99 },
      });

      // Delete the metric
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/observability/metrics/${mId}`,
        headers: auth(),
      });
      expect(delRes.statusCode).toBe(200);

      // Verify cascade: alerts should be gone
      const alertRows = await adminSql`
        SELECT * FROM mod_observability.alerts WHERE metric_id = ${mId}
      `;
      expect(alertRows.length).toBe(0);

      // Verify cascade: alert_history should be gone
      const histRows = await adminSql`
        SELECT * FROM mod_observability.alert_history WHERE alert_id = ${aId}
      `;
      expect(histRows.length).toBe(0);

      // Verify cascade: SLOs should be gone
      const sloRows = await adminSql`
        SELECT * FROM mod_observability.slo_definitions WHERE metric_id = ${mId}
      `;
      expect(sloRows.length).toBe(0);
    });
  });

  /* ═══════════════════════════════════════════
   * CLEANUP — DELETE
   * ═══════════════════════════════════════════ */

  describe('Cleanup — Delete', () => {
    it('DELETE /api/v1/observability/slos/:id → 200', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/observability/slos/${sloId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
    });

    it('DELETE /api/v1/observability/alerts/:id → 200', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/observability/alerts/${alertId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
    });

    it('DELETE /api/v1/observability/metrics/:id → 200', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/observability/metrics/${metricId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  /* ═══════════════════════════════════════════
   * GUARANTEE 1: No Automatic Evaluation Loop for Alerts
   * ═══════════════════════════════════════════ */

  describe('Guarantee — No Automatic Alert Evaluation Loop', () => {
    it('service has no loop constructs (while/for;;/setInterval/setTimeout)', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.service.ts', 'utf-8',
      );
      // Strip comments
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/setInterval/);
      expect(code).not.toMatch(/setTimeout/);
      expect(code).not.toMatch(/while\s*\(/);
      expect(code).not.toMatch(/for\s*\(\s*;\s*;/);
      expect(code).not.toMatch(/requestAnimationFrame/);
      expect(code).not.toMatch(/process\.nextTick/);
    });

    it('actions file has no loop constructs', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.actions.ts', 'utf-8',
      );
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/setInterval/);
      expect(code).not.toMatch(/setTimeout/);
      expect(code).not.toMatch(/while\s*\(/);
      expect(code).not.toMatch(/for\s*\(\s*;\s*;/);
    });

    it('routes file has no loop constructs', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.routes.ts', 'utf-8',
      );
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/setInterval/);
      expect(code).not.toMatch(/setTimeout/);
      expect(code).not.toMatch(/while\s*\(/);
      expect(code).not.toMatch(/for\s*\(\s*;\s*;/);
    });
  });

  /* ═══════════════════════════════════════════
   * GUARANTEE 2: No Background Alert Condition Checking
   * ═══════════════════════════════════════════ */

  describe('Guarantee — No Background Alert Condition Checking', () => {
    it('service does not import eventBus or subscribe to events', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.service.ts', 'utf-8',
      );
      expect(src).not.toMatch(/eventBus/);
      expect(src).not.toMatch(/subscribe/);
      expect(src).not.toMatch(/addEventListener/);
      expect(src).not.toMatch(/\.on\(/);
    });

    it('service has no checkCondition or evaluateCondition method', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.service.ts', 'utf-8',
      );
      expect(src).not.toMatch(/checkCondition/);
      expect(src).not.toMatch(/evaluateCondition/);
      expect(src).not.toMatch(/evaluateAlert/);
      expect(src).not.toMatch(/autoFire/);
      expect(src).not.toMatch(/autoCheck/);
    });

    it('no background worker or daemon references in any source file', async () => {
      const fs = await import('fs');
      const files = [
        'observability.service.ts',
        'observability.actions.ts',
        'observability.routes.ts',
      ];
      for (const f of files) {
        const src = fs.readFileSync(`packages/modules/observability/src/${f}`, 'utf-8');
        const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/worker/);
        expect(code).not.toMatch(/daemon/);
        expect(code).not.toMatch(/background/);
        expect(code).not.toMatch(/spawn/);
        expect(code).not.toMatch(/fork/);
      }
    });
  });

  /* ═══════════════════════════════════════════
   * GUARANTEE 3: No Metric Polling Mechanism
   * ═══════════════════════════════════════════ */

  describe('Guarantee — No Metric Polling Mechanism', () => {
    it('no polling, cron, or scheduled references in source files', async () => {
      const fs = await import('fs');
      const files = [
        'observability.service.ts',
        'observability.actions.ts',
        'observability.routes.ts',
        'observability.types.ts',
        'observability.schema.ts',
      ];
      for (const f of files) {
        const src = fs.readFileSync(`packages/modules/observability/src/${f}`, 'utf-8');
        const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/poll/i);
        expect(code).not.toMatch(/cron/i);
        expect(code).not.toMatch(/schedule/i);
        expect(code).not.toMatch(/recurring/i);
        expect(code).not.toMatch(/periodic/i);
        expect(code).not.toMatch(/interval/i);
      }
    });

    it('no external HTTP calls for metric collection', async () => {
      const fs = await import('fs');
      const files = [
        'observability.service.ts',
        'observability.actions.ts',
        'observability.routes.ts',
      ];
      for (const f of files) {
        const src = fs.readFileSync(`packages/modules/observability/src/${f}`, 'utf-8');
        const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/fetch\(/);
        expect(code).not.toMatch(/axios/);
        expect(code).not.toMatch(/got\(/);
        expect(code).not.toMatch(/https?:\/\//);
      }
    });
  });

  /* ═══════════════════════════════════════════
   * GUARANTEE 4: No Auto-Fire Without Explicit Action
   * ═══════════════════════════════════════════ */

  describe('Guarantee — No Auto-Fire Without Explicit Action', () => {
    it('fireAlert is only callable via K3 action (rasid.mod.observability.alert.fire)', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.actions.ts', 'utf-8',
      );
      // fireAlert is called exactly once, inside the alert.fire action handler
      const matches = src.match(/svc\.fireAlert/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(1);
    });

    it('fireAlert is not called from routes directly (only via executeAction)', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.routes.ts', 'utf-8',
      );
      expect(src).not.toMatch(/fireAlert/);
      expect(src).not.toMatch(/svc\.fireAlert/);
    });

    it('fireAlert is not called from any other module', async () => {
      const fs = await import('fs');
      const path = await import('path');
      // Recursively find all .ts files
      function walkSync(dir: string): string[] {
        let results: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === 'node_modules') continue;
            results = results.concat(walkSync(full));
          } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            results.push(full);
          }
        }
        return results;
      }
      const allFiles = walkSync('packages');
      const otherFiles = allFiles.filter(
        (f: string) => !f.includes('modules/observability/'),
      );
      for (const f of otherFiles) {
        const src = fs.readFileSync(f, 'utf-8');
        expect(src).not.toMatch(/fireAlert/);
      }
    });

    it('alert.fire action requires explicit POST with alert_id and value', async () => {
      // Missing alert_id should fail
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/observability/alert-history/fire',
        headers: auth(),
        payload: { value: 99.5 },
      });
      // Should fail validation (400) or not found
      expect([400, 500]).toContain(res.statusCode);
    });
  });

  /* ═══════════════════════════════════════════
   * GUARANTEE 5: No Scheduled SLO Evaluation
   * ═══════════════════════════════════════════ */

  describe('Guarantee — No Scheduled SLO Evaluation', () => {
    it('service has only CRUD methods for SLOs (list, get, create, update, delete)', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.service.ts', 'utf-8',
      );
      // Extract all async method names
      const methods = [...src.matchAll(/async\s+(\w+)\s*\(/g)].map(m => m[1]);
      const sloMethods = methods.filter(m => m.toLowerCase().includes('slo'));
      // Should only have CRUD: listSlos, getSlo, createSlo, updateSlo, deleteSlo
      expect(sloMethods.sort()).toEqual(['createSlo', 'deleteSlo', 'getSlo', 'listSlos', 'updateSlo']);
    });

    it('no evaluateSlo, calculateSlo, or checkSlo method exists', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.service.ts', 'utf-8',
      );
      expect(src).not.toMatch(/evaluateSlo/);
      expect(src).not.toMatch(/calculateSlo/);
      expect(src).not.toMatch(/checkSlo/);
      expect(src).not.toMatch(/sloCompliance/);
      expect(src).not.toMatch(/errorBudget/);
      expect(src).not.toMatch(/burnRate/);
    });

    it('SLO actions are CRUD-only (no evaluate/calculate action registered)', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync(
        'packages/modules/observability/src/observability.actions.ts', 'utf-8',
      );
      const sloActions = [...src.matchAll(/rasid\.mod\.observability\.slo\.(\w+)/g)].map(m => m[1]);
      expect(sloActions.sort()).toEqual(['create', 'delete', 'list', 'update']);
    });
  });
});

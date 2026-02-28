import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import { buildServer } from '../../packages/kernel/src/server.js';

describe('STEP 1 — Repository Setup Verification', () => {
  it('health endpoint returns ok', async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('database connection works (admin)', async () => {
    const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
    const result = await sql`SELECT current_database() as db`;
    expect(result[0]?.db).toBe('rasid_platform');
    await sql.end();
  });

  it('database connection works (app)', async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const result = await sql`SELECT current_database() as db`;
    expect(result[0]?.db).toBe('rasid_platform');
    await sql.end();
  });

  it('kernel schema exists', async () => {
    const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
    const result = await sql`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name = 'kernel'
    `;
    expect(result.length).toBe(1);
    await sql.end();
  });

  it('all 14 tables exist after migration', async () => {
    const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
    const result = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'kernel'
      ORDER BY table_name
    `;
    const tableNames = result.map((r) => r.table_name);
    expect(tableNames).toContain('tenants');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('roles');
    expect(tableNames).toContain('permissions');
    expect(tableNames).toContain('role_permissions');
    expect(tableNames).toContain('user_roles');
    expect(tableNames).toContain('object_types');
    expect(tableNames).toContain('objects');
    expect(tableNames).toContain('action_manifests');
    expect(tableNames).toContain('audit_log');
    expect(tableNames).toContain('lineage_edges');
    expect(tableNames).toContain('datasets');
    expect(tableNames).toContain('dataset_fields');
    expect(tableNames).toContain('metrics');
    expect(tableNames).toContain('design_tokens');
    expect(tableNames).toContain('design_themes');
    expect(tableNames).toContain('design_components');
    expect(tableNames.length).toBe(17);
    await sql.end();
  });

  it('RLS enabled on 13 tenant-scoped tables', async () => {
    const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
    const result = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'kernel' AND rowsecurity = true
      ORDER BY tablename
    `;
    const rlsTables = result.map((r) => r.tablename);
    expect(rlsTables).toContain('users');
    expect(rlsTables).toContain('roles');
    expect(rlsTables).toContain('role_permissions');
    expect(rlsTables).toContain('user_roles');
    expect(rlsTables).toContain('objects');
    expect(rlsTables).toContain('audit_log');
    expect(rlsTables).toContain('lineage_edges');
    expect(rlsTables).toContain('datasets');
    expect(rlsTables).toContain('dataset_fields');
    expect(rlsTables).toContain('metrics');
    expect(rlsTables).toContain('design_tokens');
    expect(rlsTables).toContain('design_themes');
    expect(rlsTables).toContain('design_components');
    expect(rlsTables.length).toBe(13);
    await sql.end();
  });

  it('rasid_app has NO UPDATE/DELETE on audit_log', async () => {
    const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
    const result = await sql`
      SELECT privilege_type FROM information_schema.table_privileges
      WHERE grantee = 'rasid_app'
        AND table_schema = 'kernel'
        AND table_name = 'audit_log'
      ORDER BY privilege_type
    `;
    const privileges = result.map((r) => r.privilege_type);
    expect(privileges).not.toContain('UPDATE');
    expect(privileges).not.toContain('DELETE');
    expect(privileges).toContain('SELECT');
    expect(privileges).toContain('INSERT');
    await sql.end();
  });

  it('CHECK constraints on state/status columns', async () => {
    const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
    const result = await sql`
      SELECT conname, conrelid::regclass as table_name
      FROM pg_constraint
      WHERE contype = 'c'
        AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'kernel')
    `;
    expect(result.length).toBeGreaterThan(0);
    await sql.end();
  });

  it('rasid_app user has NOBYPASSRLS', async () => {
    const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
    const result = await sql`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = 'rasid_app'
    `;
    expect(result[0]?.rolbypassrls).toBe(false);
    await sql.end();
  });

  it('rasid_admin user has BYPASSRLS', async () => {
    const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
    const result = await sql`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = 'rasid_admin'
    `;
    expect(result[0]?.rolbypassrls).toBe(true);
    await sql.end();
  });
});

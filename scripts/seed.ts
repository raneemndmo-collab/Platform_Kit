/**
 * Seed script — P0.12 Seed Data
 * Creates: 2 tenants, 15 permissions, 4 roles/tenant, 5 users, 1 object type
 * Run: pnpm db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';
import { adminSql } from '../packages/kernel/src/db/connection.js';

const SALT_ROUNDS = 10;

async function seed(): Promise<void> {
  console.log('[seed] Starting...');

  // ── Clean existing data (reverse FK order) ──
  await adminSql`DELETE FROM kernel.user_roles`;
  await adminSql`DELETE FROM kernel.role_permissions`;
  await adminSql`DELETE FROM kernel.audit_log`;
  await adminSql`DELETE FROM kernel.objects`;
  await adminSql`DELETE FROM kernel.object_types`;
  await adminSql`DELETE FROM kernel.users`;
  await adminSql`DELETE FROM kernel.roles`;
  await adminSql`DELETE FROM kernel.permissions`;
  await adminSql`DELETE FROM kernel.action_manifests`;
  await adminSql`DELETE FROM kernel.tenants`;
  console.log('[seed] Cleaned existing data.');

  // ── Tenants (exactly 2 — MT-9) ──
  const acmeId = uuidv7();
  const betaId = uuidv7();
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${acmeId}, 'Acme Corporation', 'acme')`;
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${betaId}, 'Beta Industries', 'beta')`;
  console.log('[seed] Tenants created: acme, beta');

  // ── Permissions (exactly 15 — S12) ──
  const permDefs: Array<[string, string]> = [
    ['users', 'create'], ['users', 'read'], ['users', 'update'], ['users', 'delete'],
    ['roles', 'create'], ['roles', 'read'], ['roles', 'update'], ['roles', 'delete'], ['roles', 'assign'],
    ['permissions', 'assign'],
    ['objects', 'create'], ['objects', 'read'], ['objects', 'update'], ['objects', 'delete'],
    ['audit', 'read'],
  ];
  const permIds: Record<string, string> = {};
  for (const [resource, action] of permDefs) {
    const id = uuidv7();
    permIds[`${resource}.${action}`] = id;
    await adminSql`INSERT INTO kernel.permissions (id, resource, action) VALUES (${id}, ${resource}, ${action})`;
  }
  console.log(`[seed] Permissions created: ${permDefs.length}`);

  // ── Roles (4 per tenant) ──
  const roleDefs: Array<{ name: string; perms: string[] }> = [
    { name: 'super_admin', perms: Object.keys(permIds) },
    { name: 'admin', perms: Object.keys(permIds).filter((p) => p !== 'permissions.assign') },
    { name: 'editor', perms: ['users.read', 'objects.create', 'objects.read', 'objects.update', 'objects.delete', 'audit.read'] },
    { name: 'viewer', perms: ['users.read', 'objects.read', 'audit.read'] },
  ];

  const roleMap: Record<string, Record<string, string>> = {};
  for (const tenantId of [acmeId, betaId]) {
    roleMap[tenantId] = {};
    for (const role of roleDefs) {
      const roleId = uuidv7();
      roleMap[tenantId][role.name] = roleId;
      await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${roleId}, ${tenantId}, ${role.name}, true)`;
      for (const perm of role.perms) {
        const permId = permIds[perm];
        if (permId) {
          await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${roleId}, ${permId}, ${tenantId})`;
        }
      }
    }
  }
  console.log('[seed] Roles created: 4 per tenant');

  // ── Users (P0.12) ──
  const userDefs: Array<{ email: string; password: string; name: string; tenant: string; roles: string[] }> = [
    { email: 'admin@acme.com', password: 'Admin123!', name: 'Acme Admin', tenant: acmeId, roles: ['super_admin'] },
    { email: 'editor@acme.com', password: 'Editor123!', name: 'Acme Editor', tenant: acmeId, roles: ['editor'] },
    { email: 'viewer@acme.com', password: 'Viewer123!', name: 'Acme Viewer', tenant: acmeId, roles: ['viewer'] },
    { email: 'admin@beta.com', password: 'Admin123!', name: 'Beta Admin', tenant: betaId, roles: ['super_admin'] },
    { email: 'viewer@beta.com', password: 'Viewer123!', name: 'Beta Viewer', tenant: betaId, roles: ['viewer'] },
  ];

  for (const u of userDefs) {
    const userId = uuidv7();
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    await adminSql`
      INSERT INTO kernel.users (id, tenant_id, email, password_hash, display_name)
      VALUES (${userId}, ${u.tenant}, ${u.email}, ${hash}, ${u.name})
    `;
    for (const roleName of u.roles) {
      const roleId = roleMap[u.tenant][roleName];
      await adminSql`
        INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by)
        VALUES (${userId}, ${roleId}, ${u.tenant}, ${userId})
      `;
    }
    console.log(`[seed] User: ${u.email} [${u.roles.join(', ')}]`);
  }

  // ── Object Type: rasid.core.test ──
  await adminSql`
    INSERT INTO kernel.object_types (name, display_name, module_id, json_schema)
    VALUES ('rasid.core.test', 'Test Object', 'kernel', ${JSON.stringify({
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' }, value: { type: 'number' } },
    })})
  `;
  console.log('[seed] Object type: rasid.core.test');

  console.log('[seed] Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});

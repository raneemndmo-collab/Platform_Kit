/**
 * Phase 6 Step 2 — Non-breaking index migration.
 *
 * Adds 6 indexes to eliminate critical sequential scans identified
 * in the Performance & Load Audit (Phase 6, Step 1).
 *
 * No schema redesign. No data modification. No table alteration.
 * No removal of existing constraints. RLS remains intact.
 */
import { adminSql } from '../packages/kernel/src/db/connection.js';

async function main() {
  console.log('Phase 6 Step 2 — Adding non-breaking indexes...\n');

  const indexes = [
    {
      name: 'idx_user_roles_user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON kernel.user_roles(user_id);',
    },
    {
      name: 'idx_user_roles_role_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON kernel.user_roles(role_id);',
    },
    {
      name: 'idx_role_permissions_role_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON kernel.role_permissions(role_id);',
    },
    {
      name: 'idx_role_permissions_permission_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON kernel.role_permissions(permission_id);',
    },
    {
      name: 'idx_audit_log_action_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_audit_log_action_id ON kernel.audit_log(action_id);',
    },
    {
      name: 'idx_audit_log_actor_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON kernel.audit_log(actor_id);',
    },
  ];

  for (const idx of indexes) {
    try {
      await adminSql.unsafe(idx.sql);
      console.log(`  ✓ ${idx.name}`);
    } catch (err: any) {
      console.error(`  ✗ ${idx.name}: ${err.message}`);
    }
  }

  console.log('\nDone.');
  await adminSql.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

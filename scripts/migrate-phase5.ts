/**
 * Phase 5 module migrations
 */
import 'dotenv/config';
import { adminSql } from '../packages/kernel/src/db/connection.js';
import { migrateBackup } from '../packages/modules/backup/src/migrate.js';
import { migrateGateway } from '../packages/modules/api-gateway/src/migrate.js';
import { migrateBilling } from '../packages/modules/billing/src/migrate.js';
import { migrateLocalization } from '../packages/modules/localization/src/migrate.js';
import { migrateDevPortal } from '../packages/modules/dev-portal/src/migrate.js';

async function run() {
  console.log('Running Phase 5 migrations...');
  await migrateBackup(adminSql);
  console.log('  ✓ mod_backup');
  await migrateGateway(adminSql);
  console.log('  ✓ mod_gateway');
  await migrateBilling(adminSql);
  console.log('  ✓ mod_billing');
  await migrateLocalization(adminSql);
  console.log('  ✓ mod_localization');
  await migrateDevPortal(adminSql);
  console.log('  ✓ mod_dev_portal');
  console.log('All Phase 5 migrations complete.');
  await adminSql.end();
}
run().catch(e => { console.error(e); process.exit(1); });

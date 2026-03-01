import { migrateModDpc } from '../packages/modules/dpc/src/migrate.js';
import { adminSql } from '../packages/kernel/src/index.js';

async function main() {
  await migrateModDpc();
  await adminSql.end();
  console.log('DPC migration complete.');
}

main().catch(e => { console.error(e); process.exit(1); });

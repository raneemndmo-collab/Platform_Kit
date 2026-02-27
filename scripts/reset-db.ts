import 'dotenv/config';
import postgres from 'postgres';

const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!adminUrl) {
  throw new Error('DATABASE_ADMIN_URL is not set');
}

const sql = postgres(adminUrl, { max: 1 });

async function resetDb(): Promise<void> {
  console.log('Dropping kernel schema...');
  await sql`DROP SCHEMA IF EXISTS kernel CASCADE`;
  console.log('Schema dropped. Run db:migrate to recreate.');
  await sql.end();
}

resetDb().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});

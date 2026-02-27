import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';

const appUrl = process.env.DATABASE_URL;
const adminUrl = process.env.DATABASE_ADMIN_URL;

if (!appUrl) {
  throw new Error('DATABASE_URL is not set');
}

if (!adminUrl) {
  throw new Error('DATABASE_ADMIN_URL is not set');
}

/** Application connection — NO BYPASSRLS */
export const appSql = postgres(appUrl, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

/** Admin connection — BYPASSRLS (migrations and seeds ONLY) */
export const adminSql = postgres(adminUrl, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

/** Drizzle instance for application queries */
export const db = drizzle(appSql);

/** Drizzle instance for admin operations (migrations, seeds) */
export const adminDb = drizzle(adminSql);

/** Graceful shutdown */
export async function closeConnections(): Promise<void> {
  await appSql.end();
  await adminSql.end();
}

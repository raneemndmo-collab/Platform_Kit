import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './packages/kernel/src/db/schema.ts',
  out: './packages/kernel/src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_ADMIN_URL!,
  },
  schemaFilter: ['kernel'],
});

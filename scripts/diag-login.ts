import { buildServer } from '../packages/kernel/src/server.js';
import { reseed } from '../tests/helpers/reseed.js';

async function main() {
  const app = await buildServer();
  await reseed();
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@acme.com', password: 'Admin123!' } });
  console.log('STATUS:', res.statusCode);
  console.log('BODY:', JSON.stringify(res.json(), null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

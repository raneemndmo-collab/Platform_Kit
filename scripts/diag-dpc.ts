import { buildServer } from '../packages/kernel/src/server.js';
import { reseed } from '../tests/helpers/reseed.js';

async function main() {
  const app = await buildServer();
  await reseed();

  // Login
  const loginRes = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' } });
  const token = JSON.parse(loginRes.body).data.token.access_token;
  console.log('TOKEN:', token ? 'OK' : 'MISSING');

  // Try POST pool
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/dpc/pools',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'test-pool',
      pool_type: 'cpu',
      min_nodes: 1,
      max_nodes: 4,
      cpu_per_node: 8,
      memory_gb_per_node: 32,
    },
  });
  console.log('STATUS:', res.statusCode);
  console.log('BODY:', res.body);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

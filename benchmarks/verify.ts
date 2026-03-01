import { buildServer } from '../packages/kernel/src/server.js';

async function main() {
  const app = await buildServer({ logger: false });
  const login = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  const token = JSON.parse(login.body).data.token.access_token;
  const H = { authorization: `Bearer ${token}` };

  const endpoints = [
    ['GET', '/api/v1/backup/policies'],
    ['GET', '/api/v1/semantic/models'],
    ['GET', '/api/v1/search?q=test&limit=5'],
    ['GET', '/api/v1/ai/memory/sessions'],
  ];

  for (const [method, url] of endpoints) {
    const r = await app.inject({ method: method as any, url, headers: H });
    console.log(`${method} ${url} => ${r.statusCode}`);
  }

  await app.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

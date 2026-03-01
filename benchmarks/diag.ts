process.env.NODE_ENV = 'test';
import { buildServer } from '../packages/kernel/src/server.js';

async function main() {
  const app = await buildServer();
  
  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  const token = JSON.parse(loginRes.body).data.token.access_token;
  const H = { authorization: `Bearer ${token}` };

  // Test backup read
  const r1 = await app.inject({ method: 'GET', url: '/api/v1/backup/policies', headers: H });
  console.log('Backup policies:', r1.statusCode, r1.body.substring(0, 200));

  // Test billing create
  const r2 = await app.inject({ method: 'POST', url: '/api/v1/billing/plans', headers: H,
    payload: { name: 'test-plan', tier: 'basic', price_cents: 999, billing_cycle: 'monthly', is_active: true, features: {} } });
  console.log('Billing create:', r2.statusCode, r2.body.substring(0, 200));

  // Test semantic read
  const r3 = await app.inject({ method: 'GET', url: '/api/v1/semantic/models', headers: H });
  console.log('Semantic models:', r3.statusCode, r3.body.substring(0, 200));

  // Test search
  const r4 = await app.inject({ method: 'GET', url: '/api/v1/search?q=test&limit=10', headers: H });
  console.log('Search:', r4.statusCode, r4.body.substring(0, 200));

  // Test RAG retrieve
  const r5 = await app.inject({ method: 'POST', url: '/api/v1/ai/rag/retrieve', headers: H,
    payload: { query: 'test', top_k: 5 } });
  console.log('RAG retrieve:', r5.statusCode, r5.body.substring(0, 200));

  // Test memory session create
  const r6 = await app.inject({ method: 'POST', url: '/api/v1/ai/memory/sessions', headers: H,
    payload: { label: 'diag-session', session_type: 'conversation', config: {} } });
  console.log('Memory session:', r6.statusCode, r6.body.substring(0, 200));

  await app.close();
  process.exit(0);
}
main().catch(console.error);

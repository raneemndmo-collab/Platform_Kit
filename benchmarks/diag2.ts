process.env.NODE_ENV = 'test';
import { buildServer } from '../packages/kernel/src/server.js';

async function main() {
  const app = await buildServer();
  const login = await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email:'admin@acme.com',password:'Admin123!',tenant_slug:'acme'}});
  const token = JSON.parse(login.body).data.token.access_token;
  const H = {authorization:'Bearer '+token};
  
  // Test search
  const r1 = await app.inject({method:'GET',url:'/api/v1/search?q=test&limit=10',headers:H});
  console.log('Search:', r1.statusCode, r1.body.substring(0, 300));
  
  // Test memory entry insert
  const r2 = await app.inject({method:'POST',url:'/api/v1/ai/memory/sessions',headers:H,payload:{label:'test-diag',session_type:'conversation',config:{}}});
  const sid = JSON.parse(r2.body).data?.id;
  console.log('Session:', r2.statusCode, sid);
  if(sid){
    const r3 = await app.inject({method:'POST',url:`/api/v1/ai/memory/sessions/${sid}/entries`,headers:H,payload:{role:'user',content:'hello world',metadata:{}}});
    console.log('Entry:', r3.statusCode, r3.body.substring(0, 300));
  }
  
  await app.close();
  process.exit(0);
}
main().catch(console.error);

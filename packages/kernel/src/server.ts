import Fastify from 'fastify';
import 'dotenv/config';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

export function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
    genReqId: () => crypto.randomUUID(),
  });

  // Health check — no auth
  app.get('/api/v1/health', async () => {
    return { status: 'ok' };
  });

  return app;
}

// Start server if run directly
const isDirectRun = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirectRun) {
  const app = buildServer();
  app.listen({ port: PORT, host: HOST }).then((address) => {
    console.log(`Rasid Platform listening on ${address}`);
  }).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

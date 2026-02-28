// Module Loader -- Dynamic Module Discovery and Registration
//
// Scans packages/modules/*/src/index for RasidModule exports.
// Eliminates hardcoded module wiring in server.ts.
// Contract: each module MUST export rasidModule conforming to RasidModule.

import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { FastifyInstance } from 'fastify';
import type { RasidModule } from '@rasid/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MODULES_DIR = join(__dirname, '../../modules');

// Discover all RasidModule packages under packages/modules/
// and register their actions + routes with the Fastify app.
export async function loadModules(app: FastifyInstance): Promise<RasidModule[]> {
  const loaded: RasidModule[] = [];

  if (!existsSync(MODULES_DIR)) {
    app.log.info('No modules directory found, skipping module loading');
    return loaded;
  }

  const dirs = readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    const entryPath = join(MODULES_DIR, dir, 'src', 'index.js');
    const entryPathTs = join(MODULES_DIR, dir, 'src', 'index.ts');

    // Resolve the entry: tsx handles .ts, compiled uses .js
    const resolvedEntry = existsSync(entryPathTs) ? entryPathTs : entryPath;

    if (!existsSync(resolvedEntry)) {
      app.log.warn(`Module "${dir}" has no src/index entry, skipping`);
      continue;
    }

    try {
      const mod = await import(resolvedEntry);
      const rasidModule: RasidModule | undefined = mod.rasidModule ?? mod.default?.rasidModule;

      if (!rasidModule || !rasidModule.id || !rasidModule.routes || !rasidModule.registerActions) {
        app.log.warn(`Module "${dir}" does not export a valid RasidModule, skipping`);
        continue;
      }

      // 1. Run migrations if provided
      if (rasidModule.migrate) {
        await rasidModule.migrate();
        app.log.info(`Module "${rasidModule.id}" migrations complete`);
      }

      // 2. Register K3 action handlers
      rasidModule.registerActions();
      app.log.info(`Module "${rasidModule.id}" actions registered`);

      // 3. Register Fastify routes
      await app.register(rasidModule.routes as Parameters<typeof app.register>[0]);
      app.log.info(`Module "${rasidModule.id}" routes registered`);

      loaded.push(rasidModule);
    } catch (err) {
      app.log.error(`Failed to load module "${dir}": ${(err as Error).message}`);
      throw err; // fail-fast: broken module should prevent server start
    }
  }

  app.log.info(`Loaded ${loaded.length} module(s): ${loaded.map((m) => m.id).join(', ')}`);
  return loaded;
}

/**
 * M21 AI Engine — Proactive Engine Routes (Step 7)
 *
 * REST endpoints for proactive rules and suggestions.
 * All writes go through K3 (executeAction).
 * NO automatic execution. NO background listeners.
 */
import type { FastifyInstance } from 'fastify';
import {
  actionRegistry,
  authMiddleware,
  tenantMiddleware,
  tenantCleanup,
  buildRequestContext,
} from '../../../kernel/src/index.js';

export async function proactiveRoutes(app: FastifyInstance): Promise<void> {
  app.register(async (scoped) => {
    scoped.addHook('onRequest', authMiddleware);
    scoped.addHook('preHandler', tenantMiddleware);
    scoped.addHook('onResponse', tenantCleanup);

    // ── Rule CRUD ──

    scoped.post('/api/v1/ai/proactive/rules', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.rule.create', request.body, ctx, sql,
      );
      return reply.status(201).send(result);
    });

    scoped.get('/api/v1/ai/proactive/rules', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.rule.list', request.query, ctx, sql,
      );
      return reply.send(result);
    });

    scoped.get('/api/v1/ai/proactive/rules/:rule_id', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { rule_id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.rule.get', { rule_id }, ctx, sql,
      );
      return reply.send(result);
    });

    scoped.patch('/api/v1/ai/proactive/rules/:rule_id', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { rule_id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.rule.update',
        { ...(request.body as any), rule_id },
        ctx, sql,
      );
      return reply.send(result);
    });

    scoped.delete('/api/v1/ai/proactive/rules/:rule_id', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { rule_id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.rule.delete', { rule_id }, ctx, sql,
      );
      return reply.send(result);
    });

    // ── Event Evaluation (explicit opt-in) ──

    scoped.post('/api/v1/ai/proactive/evaluate', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.evaluate', request.body, ctx, sql,
      );
      return reply.send(result);
    });

    // ── Suggestion Management ──

    scoped.get('/api/v1/ai/proactive/suggestions', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.suggestion.list', request.query, ctx, sql,
      );
      return reply.send(result);
    });

    scoped.get('/api/v1/ai/proactive/suggestions/:suggestion_id', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { suggestion_id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.suggestion.get', { suggestion_id }, ctx, sql,
      );
      return reply.send(result);
    });

    scoped.post('/api/v1/ai/proactive/suggestions/:suggestion_id/dismiss', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { suggestion_id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.suggestion.dismiss', { suggestion_id }, ctx, sql,
      );
      return reply.send(result);
    });

    scoped.post('/api/v1/ai/proactive/suggestions/:suggestion_id/accept', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { suggestion_id } = request.params as any;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.proactive.suggestion.accept', { suggestion_id }, ctx, sql,
      );
      return reply.send(result);
    });
  });
}

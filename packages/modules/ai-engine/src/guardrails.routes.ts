/**
 * M21 AI Engine — Guardrails Routes (Step 6)
 *
 * REST endpoints for guardrail rule management and evaluation.
 * All writes go through K3 pipeline. No silent override.
 * No hidden filtering. All enforcement is transparent.
 */
import type { FastifyInstance } from 'fastify';
import {
  actionRegistry,
  authMiddleware,
  tenantMiddleware,
  tenantCleanup,
  buildRequestContext,
} from '../../../kernel/src/index.js';

export async function guardrailsRoutes(app: FastifyInstance): Promise<void> {
  app.register(async (scoped) => {
    scoped.addHook('onRequest', authMiddleware);
    scoped.addHook('preHandler', tenantMiddleware);
    scoped.addHook('onResponse', tenantCleanup);

    // ── RULE CRUD ──

    scoped.post('/api/v1/ai/guardrails/rules', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.guardrails.rule.create', request.body, ctx, sql,
      );
      return reply.status(201).send(result);
    });

    scoped.get('/api/v1/ai/guardrails/rules', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const query = request.query as Record<string, string>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.guardrails.rule.list',
        {
          limit: query.limit ? Number(query.limit) : undefined,
          offset: query.offset ? Number(query.offset) : undefined,
        },
        ctx, sql,
      );
      return reply.send(result);
    });

    scoped.get('/api/v1/ai/guardrails/rules/:ruleId', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { ruleId } = request.params as { ruleId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.guardrails.rule.get', { rule_id: ruleId }, ctx, sql,
      );
      return reply.send(result);
    });

    scoped.patch('/api/v1/ai/guardrails/rules/:ruleId', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { ruleId } = request.params as { ruleId: string };
      const body = request.body as Record<string, unknown>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.guardrails.rule.update', { ...body, rule_id: ruleId }, ctx, sql,
      );
      return reply.send(result);
    });

    scoped.delete('/api/v1/ai/guardrails/rules/:ruleId', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const { ruleId } = request.params as { ruleId: string };
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.guardrails.rule.delete', { rule_id: ruleId }, ctx, sql,
      );
      return reply.send(result);
    });

    // ── EVALUATION ──

    scoped.post('/api/v1/ai/guardrails/evaluate', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.guardrails.evaluate', request.body, ctx, sql,
      );
      return reply.send(result);
    });

    scoped.get('/api/v1/ai/guardrails/evaluations', async (request, reply) => {
      const ctx = buildRequestContext(request);
      const sql = (request as any).sql;
      const query = request.query as Record<string, string>;
      const result = await actionRegistry.executeAction(
        'rasid.mod.ai.guardrails.evaluations.list',
        {
          action_id: query.action_id,
          rule_id: query.rule_id,
          verdict: query.verdict,
          limit: query.limit ? Number(query.limit) : undefined,
          offset: query.offset ? Number(query.offset) : undefined,
        },
        ctx, sql,
      );
      return reply.send(result);
    });
  });
}

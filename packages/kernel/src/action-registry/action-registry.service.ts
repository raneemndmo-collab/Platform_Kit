import { v7 as uuidv7 } from 'uuid';
import type { IActionRegistry } from './action-registry.interface.js';
import type {
  ActionManifest,
  ActionHandler,
  ActionResult,
} from './action-registry.types.js';
import type { RequestContext } from '@rasid/shared';
import { NotFoundError, PermissionDeniedError, ValidationError } from '@rasid/shared';
import { policyService } from '../policy/policy.service.js';
import { auditService } from '../audit/audit.service.js';
import { eventBus } from '../event-bus/event-bus.service.js';
import { adminSql } from '../db/connection.js';
import type postgres from 'postgres';

/**
 * K3 Action Registry — 6-step pipeline (P0.6.1).
 *
 * Every mutation passes through:
 * 1. VALIDATE INPUT
 * 2. ENFORCE POLICY (RBAC)
 * 3. EXECUTE (mutation)          ─┐ Same DB transaction
 * 4. RECORD AUDIT (success)      ─┘
 * 5. EMIT EVENT (post-commit, best-effort)
 * 6. RETURN RESULT
 *
 * OPT-12: All mutations MUST go through executeAction().
 */
export class ActionRegistryService implements IActionRegistry {
  private manifests = new Map<string, ActionManifest>();
  private handlers = new Map<string, ActionHandler>();

  /** Register an action with its manifest and handler */
  registerAction(manifest: ActionManifest, handler: ActionHandler): void {
    this.manifests.set(manifest.action_id, manifest);
    this.handlers.set(manifest.action_id, handler);
  }

  /** Get a manifest by action_id */
  getManifest(actionId: string): ActionManifest | undefined {
    return this.manifests.get(actionId);
  }

  /** List actions with optional filters */
  listActions(filter?: { module?: string; verb?: string }): ActionManifest[] {
    let actions = Array.from(this.manifests.values());
    if (filter?.module) {
      actions = actions.filter((a) => a.module_id === filter.module);
    }
    if (filter?.verb) {
      actions = actions.filter((a) => a.verb === filter.verb);
    }
    return actions;
  }

  /**
   * Execute an action through the 6-step pipeline.
   *
   * @param actionId - The action to execute
   * @param input - The raw input (will be validated)
   * @param ctx - Request context (from JWT)
   * @param sql - Request-scoped SQL connection (tenant transaction)
   */
  async executeAction(
    actionId: string,
    input: unknown,
    ctx: RequestContext,
    sql: postgres.ReservedSql,
  ): Promise<ActionResult> {
    // ── Step 1: VALIDATE INPUT ──
    const manifest = this.manifests.get(actionId);
    if (!manifest) {
      throw new NotFoundError(`Action '${actionId}' not registered`);
    }

    const handler = this.handlers.get(actionId);
    if (!handler) {
      throw new NotFoundError(`Handler for '${actionId}' not registered`);
    }

    this.validateInput(input, manifest.input_schema);

    // ── Step 2: ENFORCE POLICY (RBAC) ──
    if (manifest.required_permissions.length > 0) {
      const decision = await policyService.evaluate(
        {
          actor_id: ctx.userId,
          tenant_id: ctx.tenantId,
          required_permissions: manifest.required_permissions,
        },
        sql,
      );

      if (!decision.allowed) {
        // Record audit with status 'failure' in SEPARATE transaction
        await auditService.record(
          {
            tenant_id: ctx.tenantId,
            actor_id: ctx.userId,
            actor_type: 'user',
            action_id: actionId,
            object_id: null,
            object_type: null,
            status: 'failure',
            payload_before: null,
            payload_after: null,
            error_message: `Permission denied: missing ${decision.missing_permissions.join(', ')}`,
            ip_address: ctx.ipAddress,
            session_id: ctx.sessionId,
            correlation_id: ctx.correlationId,
          },
          adminSql, // separate transaction
        );

        // Emit policy.denied event
        eventBus.publish({
          event_id: uuidv7(),
          event_type: 'rasid.core.policy.denied',
          timestamp: new Date().toISOString(),
          tenant_id: ctx.tenantId,
          actor_id: ctx.userId,
          actor_type: 'user',
          object_id: null,
          object_type: null,
          action_id: actionId,
          payload: { before: null, after: null },
          metadata: {
            ip_address: ctx.ipAddress,
            session_id: ctx.sessionId,
            correlation_id: ctx.correlationId,
            request_id: ctx.correlationId,
          },
        });

        throw new PermissionDeniedError(
          `Missing permissions: ${decision.missing_permissions.join(', ')}`,
          { missing_permissions: decision.missing_permissions },
        );
      }
    }

    // ── Step 3: EXECUTE (mutation) ──
    let result;
    try {
      result = await handler(input, ctx, sql);
    } catch (err) {
      // Record audit with status 'failure' in SEPARATE transaction
      await auditService.record(
        {
          tenant_id: ctx.tenantId,
          actor_id: ctx.userId,
          actor_type: 'user',
          action_id: actionId,
          object_id: null,
          object_type: null,
          status: 'failure',
          payload_before: null,
          payload_after: null,
          error_message: err instanceof Error ? err.message : String(err),
          ip_address: ctx.ipAddress,
          session_id: ctx.sessionId,
          correlation_id: ctx.correlationId,
        },
        adminSql,
      );
      throw err;
    }

    // ── Step 4: RECORD AUDIT (success — same transaction) ──
    const auditRecord = await auditService.record(
      {
        tenant_id: ctx.tenantId,
        actor_id: ctx.userId,
        actor_type: 'user',
        action_id: actionId,
        object_id: result.object_id ?? null,
        object_type: result.object_type ?? null,
        status: 'success',
        payload_before: result.before ?? null,
        payload_after: result.after ?? null,
        error_message: null,
        ip_address: ctx.ipAddress,
        session_id: ctx.sessionId,
        correlation_id: ctx.correlationId,
      },
      sql, // same transaction as the mutation
    );

    // ── Step 5: EMIT EVENT (post-commit, best-effort) ──
    if (result.event_type) {
      try {
        eventBus.publish({
          event_id: uuidv7(),
          event_type: result.event_type,
          timestamp: new Date().toISOString(),
          tenant_id: ctx.tenantId,
          actor_id: ctx.userId,
          actor_type: 'user',
          object_id: result.object_id ?? null,
          object_type: result.object_type ?? null,
          action_id: actionId,
          payload: {
            before: result.before ?? null,
            after: result.after ?? null,
          },
          metadata: {
            ip_address: ctx.ipAddress,
            session_id: ctx.sessionId,
            correlation_id: ctx.correlationId,
            request_id: ctx.correlationId,
          },
        });
      } catch (err) {
        // P0.8.3: If emission fails, LOG the error. Do NOT rollback.
        console.error('[ActionRegistry] Event emission failed:', err);
      }
    }

    // ── Step 6: RETURN RESULT ──
    return {
      data: result.data,
      audit_id: auditRecord.id,
      action_id: actionId,
    };
  }

  /** Basic input validation against JSON schema (required fields) */
  private validateInput(
    input: unknown,
    schema: Record<string, unknown>,
  ): void {
    if (!schema || Object.keys(schema).length === 0) return;

    const required = schema.required as string[] | undefined;
    const props = schema.properties as Record<string, unknown> | undefined;
    if (!required || !props) return;

    if (typeof input !== 'object' || input === null) {
      throw new ValidationError('Input must be an object');
    }

    const data = input as Record<string, unknown>;
    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }
  }
}

/** Singleton */
export const actionRegistry = new ActionRegistryService();

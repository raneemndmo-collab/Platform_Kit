import type { IPolicyEngine } from './policy.interface.js';
import type { PolicyRequest, PolicyDecision } from './policy.types.js';
import type postgres from 'postgres';

/**
 * K4 Policy Engine — RBAC evaluation.
 *
 * P0.7.4 Algorithm:
 * 1. Get roles for user (via RLS-scoped query or explicit tenant filter)
 * 2. Get permissions for those roles
 * 3. Check ALL required_permissions exist in user's permission set
 * 4. Deny by default. No hierarchy. Additive only. Cached per request.
 */
export class PolicyService implements IPolicyEngine {
  /**
   * Evaluate policy.
   * @param request - The policy request
   * @param sql - SQL connection (request-scoped for RLS, or adminSql)
   */
  async evaluate(
    request: PolicyRequest,
    sql?: postgres.ReservedSql,
  ): Promise<PolicyDecision> {
    if (!sql) {
      throw new Error('SQL connection required for policy evaluation');
    }

    // If no permissions required, allow
    if (request.required_permissions.length === 0) {
      return { allowed: true, missing_permissions: [] };
    }

    // Step 1: Get role IDs for user within tenant
    const roleRows = await sql`
      SELECT role_id FROM kernel.user_roles
      WHERE user_id = ${request.actor_id}
    `;
    // RLS ensures tenant_id filtering

    if (roleRows.length === 0) {
      return {
        allowed: false,
        missing_permissions: [...request.required_permissions],
      };
    }

    const roleIds = roleRows.map((r) => r.role_id as string);

    // Step 2: Get distinct permissions for those roles
    const permRows = await sql`
      SELECT DISTINCT p.resource || '.' || p.action AS perm
      FROM kernel.role_permissions rp
      JOIN kernel.permissions p ON p.id = rp.permission_id
      WHERE rp.role_id IN ${sql(roleIds)}
    `;

    const userPerms = new Set(permRows.map((r) => r.perm as string));

    // Step 3: Check ALL required permissions
    const missing: string[] = [];
    for (const required of request.required_permissions) {
      if (!userPerms.has(required)) {
        missing.push(required);
      }
    }

    return {
      allowed: missing.length === 0,
      missing_permissions: missing,
    };
  }
}

/** Singleton */
export const policyService = new PolicyService();

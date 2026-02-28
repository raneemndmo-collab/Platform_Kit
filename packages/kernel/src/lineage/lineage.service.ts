/** K7 — Lineage Engine Service (Phase 1)
 *
 * DAG storage for data lineage. Tracks upstream/downstream relationships.
 * Basic impact analysis (what depends on X).
 * Uses recursive CTE for graph traversal.
 *
 * All methods receive a `sql` parameter — the reserved connection
 * from tenant middleware that has app.current_tenant_id set.
 */

import { v7 as uuidv7 } from 'uuid';
import type { RequestContext } from '@rasid/shared';
import type {
  ILineageEngine,
} from './lineage.interface.js';
import type {
  LineageNode,
  ImpactReport,
  AddEdgeInput,
  RemoveEdgeInput,
} from './lineage.types.js';
import type postgres from 'postgres';

type Sql = postgres.Sql | postgres.ReservedSql;

export class LineageService implements ILineageEngine {
  /**
   * Add an edge to the lineage DAG.
   * Self-loops are rejected. Duplicate edges are silently ignored (upsert).
   */
  async addEdge(input: AddEdgeInput, ctx: RequestContext, sql: Sql): Promise<void> {
    if (input.source_id === input.target_id) {
      throw Object.assign(new Error('Self-loop not allowed'), { statusCode: 400 });
    }

    // Cycle detection: check if target_id is already upstream of source_id
    const cycle = await sql`
      WITH RECURSIVE upstream AS (
        SELECT source_id, target_id, 1 AS depth
        FROM kernel.lineage_edges
        WHERE target_id = ${input.source_id}
          AND tenant_id = current_setting('app.current_tenant_id')::uuid
        UNION ALL
        SELECT e.source_id, e.target_id, u.depth + 1
        FROM kernel.lineage_edges e
        JOIN upstream u ON e.target_id = u.source_id
        WHERE e.tenant_id = current_setting('app.current_tenant_id')::uuid
          AND u.depth < 20
      )
      SELECT 1 FROM upstream WHERE source_id = ${input.target_id} LIMIT 1
    `;

    if (cycle.length > 0) {
      throw Object.assign(new Error('Adding this edge would create a cycle'), { statusCode: 400 });
    }

    const id = uuidv7();
    await sql`
      INSERT INTO kernel.lineage_edges (id, tenant_id, source_id, source_type, target_id, target_type, relationship, metadata, created_by)
      VALUES (
        ${id},
        current_setting('app.current_tenant_id')::uuid,
        ${input.source_id},
        ${input.source_type},
        ${input.target_id},
        ${input.target_type},
        ${input.relationship},
        ${JSON.stringify(input.metadata ?? {})}::jsonb,
        ${ctx.userId}
      )
      ON CONFLICT (tenant_id, source_id, target_id, relationship) DO NOTHING
    `;
  }

  /**
   * Remove an edge from the lineage DAG.
   */
  async removeEdge(input: RemoveEdgeInput, _ctx: RequestContext, sql: Sql): Promise<void> {
    const result = await sql`
      DELETE FROM kernel.lineage_edges
      WHERE source_id = ${input.source_id}
        AND target_id = ${input.target_id}
        AND relationship = ${input.relationship}
        AND tenant_id = current_setting('app.current_tenant_id')::uuid
    `;

    if (result.count === 0) {
      throw Object.assign(new Error('Edge not found'), { statusCode: 404 });
    }
  }

  /**
   * Get upstream nodes (what does this node depend on).
   * Traverses source_id ← target_id direction.
   */
  async getUpstream(nodeId: string, depth: number, _ctx: RequestContext, sql: Sql): Promise<LineageNode[]> {
    const maxDepth = Math.min(depth, 20);
    const rows = await sql`
      WITH RECURSIVE traverse AS (
        SELECT
          e.source_id AS id,
          e.source_type AS type,
          e.relationship,
          e.metadata,
          e.created_at,
          1 AS depth
        FROM kernel.lineage_edges e
        WHERE e.target_id = ${nodeId}
          AND e.tenant_id = current_setting('app.current_tenant_id')::uuid
        UNION ALL
        SELECT
          e.source_id,
          e.source_type,
          e.relationship,
          e.metadata,
          e.created_at,
          t.depth + 1
        FROM kernel.lineage_edges e
        JOIN traverse t ON e.target_id = t.id
        WHERE e.tenant_id = current_setting('app.current_tenant_id')::uuid
          AND t.depth < ${maxDepth}
      )
      SELECT DISTINCT id, type, relationship, metadata, created_at, depth
      FROM traverse
      ORDER BY depth ASC
    `;

    return rows.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      depth: Number(r.depth),
      relationship: String(r.relationship),
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      created_at: String(r.created_at),
    }));
  }

  /**
   * Get downstream nodes (what depends on this node).
   * Traverses source_id → target_id direction.
   */
  async getDownstream(nodeId: string, depth: number, _ctx: RequestContext, sql: Sql): Promise<LineageNode[]> {
    const maxDepth = Math.min(depth, 20);
    const rows = await sql`
      WITH RECURSIVE traverse AS (
        SELECT
          e.target_id AS id,
          e.target_type AS type,
          e.relationship,
          e.metadata,
          e.created_at,
          1 AS depth
        FROM kernel.lineage_edges e
        WHERE e.source_id = ${nodeId}
          AND e.tenant_id = current_setting('app.current_tenant_id')::uuid
        UNION ALL
        SELECT
          e.target_id,
          e.target_type,
          e.relationship,
          e.metadata,
          e.created_at,
          t.depth + 1
        FROM kernel.lineage_edges e
        JOIN traverse t ON e.source_id = t.id
        WHERE e.tenant_id = current_setting('app.current_tenant_id')::uuid
          AND t.depth < ${maxDepth}
      )
      SELECT DISTINCT id, type, relationship, metadata, created_at, depth
      FROM traverse
      ORDER BY depth ASC
    `;

    return rows.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      depth: Number(r.depth),
      relationship: String(r.relationship),
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      created_at: String(r.created_at),
    }));
  }

  /**
   * Get impact report: all downstream dependencies of a node.
   */
  async getImpact(nodeId: string, ctx: RequestContext, sql: Sql): Promise<ImpactReport> {
    // Get node type from edges (source or target)
    const nodeInfo = await sql`
      SELECT source_type AS type FROM kernel.lineage_edges
      WHERE source_id = ${nodeId}
        AND tenant_id = current_setting('app.current_tenant_id')::uuid
      LIMIT 1
    `;

    const firstRow = nodeInfo[0];
    const nodeType = firstRow ? String(firstRow.type) : null;

    const downstream = await this.getDownstream(nodeId, 20, ctx, sql);
    const maxDepth = downstream.reduce((max, n) => Math.max(max, n.depth), 0);

    return {
      node_id: nodeId,
      node_type: nodeType,
      downstream_count: downstream.length,
      downstream,
      depth_reached: maxDepth,
    };
  }
}

/** Singleton instance */
export const lineageService = new LineageService();

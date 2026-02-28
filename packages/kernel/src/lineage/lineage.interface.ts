/** K7 — Lineage Engine Interface (Phase 1) */

import type { LineageNode, ImpactReport, AddEdgeInput, RemoveEdgeInput } from './lineage.types.js';
import type { RequestContext } from '@rasid/shared';
import type postgres from 'postgres';

type Sql = postgres.Sql | postgres.ReservedSql;

export interface ILineageEngine {
  addEdge(input: AddEdgeInput, ctx: RequestContext, sql: Sql): Promise<void>;
  removeEdge(input: RemoveEdgeInput, ctx: RequestContext, sql: Sql): Promise<void>;
  getUpstream(nodeId: string, depth: number, ctx: RequestContext, sql: Sql): Promise<LineageNode[]>;
  getDownstream(nodeId: string, depth: number, ctx: RequestContext, sql: Sql): Promise<LineageNode[]>;
  getImpact(nodeId: string, ctx: RequestContext, sql: Sql): Promise<ImpactReport>;
}

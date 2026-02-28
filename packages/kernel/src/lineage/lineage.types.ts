/** K7 — Lineage Engine Types (Phase 1) */

/** Represents a node in the lineage DAG */
export interface LineageNode {
  id: string;
  type: string;
  depth: number;
  relationship: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Represents an edge in the lineage DAG */
export interface LineageEdge {
  id: string;
  tenant_id: string;
  source_id: string;
  source_type: string;
  target_id: string;
  target_type: string;
  relationship: string;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

/** Input for adding an edge */
export interface AddEdgeInput {
  source_id: string;
  source_type: string;
  target_id: string;
  target_type: string;
  relationship: string;
  metadata?: Record<string, unknown>;
}

/** Input for removing an edge */
export interface RemoveEdgeInput {
  source_id: string;
  target_id: string;
  relationship: string;
}

/** Impact report for a given node */
export interface ImpactReport {
  node_id: string;
  node_type: string | null;
  downstream_count: number;
  downstream: LineageNode[];
  depth_reached: number;
}

/** Query options for traversal */
export interface TraversalOptions {
  depth?: number;
}

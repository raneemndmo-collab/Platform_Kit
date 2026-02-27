import type { ActionVerb, ActionSensitivity, RequestContext } from '@rasid/shared';
import type postgres from 'postgres';

/** Action manifest — registered in kernel.action_manifests */
export interface ActionManifest {
  action_id: string;          // e.g. 'rasid.core.object.create'
  display_name: string;
  module_id: string;
  verb: ActionVerb;
  resource: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  required_permissions: string[];
  sensitivity: ActionSensitivity;
}

/** Action handler function — receives validated input and request-scoped SQL */
export type ActionHandler = (
  input: unknown,
  ctx: RequestContext,
  sql: postgres.ReservedSql,
) => Promise<ActionHandlerResult>;

/** Result from an action handler */
export interface ActionHandlerResult {
  data: unknown;
  object_id?: string | null;
  object_type?: string | null;
  before?: unknown | null;
  after?: unknown | null;
  event_type?: string;
}

/** Result from executeAction — includes audit_id */
export interface ActionResult {
  data: unknown;
  audit_id: string;
  action_id: string;
}

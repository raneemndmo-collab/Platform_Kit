import type {
  ActionManifest,
  ActionResult,
  ActionHandler,
} from './action-registry.types.js';
import type { RequestContext } from '@rasid/shared';
import type postgres from 'postgres';

/** K3 Action Registry — public contract */
export interface IActionRegistry {
  registerAction(manifest: ActionManifest, handler: ActionHandler): void;
  executeAction(
    actionId: string,
    input: unknown,
    ctx: RequestContext,
    sql: postgres.ReservedSql,
  ): Promise<ActionResult>;
  getManifest(actionId: string): ActionManifest | undefined;
  listActions(filter?: { module?: string; verb?: string }): ActionManifest[];
}

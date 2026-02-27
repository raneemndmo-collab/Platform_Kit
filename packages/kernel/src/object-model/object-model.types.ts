import type { ObjectState, RequestContext, PaginatedResult } from '@rasid/shared';

/** Object type manifest — registered in kernel.object_types */
export interface ObjectTypeManifest {
  name: string;           // e.g. 'rasid.core.test'
  display_name: string;
  module_id: string;      // e.g. 'kernel'
  json_schema: Record<string, unknown>;
}

/** Input for creating a new object */
export interface CreateObjectInput {
  type: string;           // must match a registered object_type
  data: Record<string, unknown>;
}

/** Input for updating an existing object */
export interface UpdateObjectInput {
  data: Record<string, unknown>;
}

/** Filter for listing objects */
export interface ObjectFilter {
  type?: string;
  state?: ObjectState;
  cursor?: string;
  limit?: number;
}

/** Platform object as returned from the service */
export interface PlatformObject {
  id: string;
  tenant_id: string;
  type: string;
  state: ObjectState;
  version: number;
  data: Record<string, unknown>;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Allowed state transitions map */
export const ALLOWED_TRANSITIONS: Record<ObjectState, ObjectState[]> = {
  draft: ['active', 'deleted'],
  active: ['archived', 'deleted'],
  archived: ['active', 'deleted'],
  deleted: [],
};

export type { ObjectState, RequestContext, PaginatedResult };

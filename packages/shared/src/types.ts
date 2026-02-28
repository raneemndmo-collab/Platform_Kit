/** Request context extracted from JWT + request metadata */
export interface RequestContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  correlationId: string;
  ipAddress: string | null;
}

/** Standard paginated result */
export interface PaginatedResult<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

/** JWT payload structure */
export interface JwtPayload {
  sub: string;    // user_id
  tid: string;    // tenant_id
  roles: string[];
  sid: string;    // session_id
  iat: number;
  exp: number;
}

/** Object lifecycle states — exactly 4 */
export type ObjectState = 'draft' | 'active' | 'archived' | 'deleted';

/** CRUD verbs only */
export type ActionVerb = 'create' | 'read' | 'update' | 'delete';

/** Action sensitivity levels */
export type ActionSensitivity = 'low' | 'medium' | 'high';

/** Audit record status */
export type AuditStatus = 'success' | 'failure';

/** Actor type — Phase 0: always 'user' */
export type ActorType = 'user';

/** Standard API success response */
export interface ApiResponse<T> {
  data: T;
  meta: {
    request_id: string;
    timestamp: string;
    action_id?: string;
    audit_id?: string;
  };
}

/** Standard API error response */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
}

/** Error codes */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'INTERNAL_ERROR';

/**
 * Module Contract Standard — RasidModule
 *
 * Every business module (Phase 2+) MUST export a default object
 * conforming to this interface. The kernel module-loader discovers
 * and registers modules automatically — no hardcoded wiring in server.ts.
 */
export interface RasidModule {
  /** Unique module identifier, e.g. 'mod_connectors' */
  id: string;
  /** Human-readable display name, e.g. 'Custom Tables (Data Studio)' */
  name: string;
  /** Fastify plugin that registers all HTTP routes for this module */
  routes: (app: unknown) => Promise<void>;
  /** Registers all K3 action handlers for this module */
  registerActions: () => void;
  /** Optional: run module-specific DB migrations at boot */
  migrate?: () => Promise<void>;
}

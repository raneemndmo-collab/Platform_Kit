/**
 * Kernel public interface exports ONLY.
 * No implementations exported.
 */

// Re-export shared types
export type {
  RequestContext,
  PaginatedResult,
  JwtPayload,
  ObjectState,
  ActionVerb,
  ActionSensitivity,
  AuditStatus,
  ActorType,
  ApiResponse,
  ApiErrorResponse,
  ErrorCode,
} from '@rasid/shared';

// Re-export shared errors
export {
  PlatformError,
  ValidationError,
  UnauthorizedError,
  PermissionDeniedError,
  NotFoundError,
  ConflictError,
  InvalidStateTransitionError,
} from '@rasid/shared';

// K1 — IAM interfaces
export type { IIamService } from './iam/iam.interface.js';
export type {
  RegisterInput,
  LoginInput,
  TokenPair,
  User,
  Role,
  Permission,
  UpdateUserInput,
  CreateRoleInput,
  UpdateRoleInput,
  RoleAssignInput,
} from './iam/iam.types.js';

// K2 — Object Model interfaces
export type { IObjectModelService } from './object-model/object-model.interface.js';
export type {
  ObjectTypeManifest,
  CreateObjectInput,
  UpdateObjectInput,
  ObjectFilter,
  PlatformObject,
} from './object-model/object-model.types.js';
export { ALLOWED_TRANSITIONS } from './object-model/object-model.types.js';

// K3 — Action Registry interfaces
export type { IActionRegistry } from './action-registry/action-registry.interface.js';
export type {
  ActionManifest,
  ActionHandler,
  ActionHandlerResult,
  ActionResult,
} from './action-registry/action-registry.types.js';

// K4 — Policy Engine interfaces
export type { IPolicyEngine } from './policy/policy.interface.js';
export type { PolicyRequest, PolicyDecision } from './policy/policy.types.js';

// K5 — Event Bus interfaces
export type { IEventBus } from './event-bus/event-bus.interface.js';
export type { PlatformEvent, EventHandler } from './event-bus/event-bus.types.js';

// K6 — Audit Engine interfaces
export type { IAuditEngine } from './audit/audit.interface.js';
export type { AuditEntry, AuditRecord, AuditQuery } from './audit/audit.types.js';

// K7 — Lineage Engine interfaces
export type { ILineageEngine } from './lineage/lineage.interface.js';
export type {
  LineageNode,
  LineageEdge,
  AddEdgeInput,
  RemoveEdgeInput,
  ImpactReport,
  TraversalOptions,
} from './lineage/lineage.types.js';

// K8 — Semantic Data Layer interfaces
export type { ISemanticLayer } from './semantic-layer/semantic-layer.interface.js';
export type {
  Dataset,
  DatasetField,
  Metric,
  RegisterDatasetInput,
  UpdateDatasetInput,
  DefineMetricInput,
  SemanticQueryInput,
  QueryFilter,
  DatasetSchema,
  ResultSet,
  SourceType,
  DatasetStatus,
  FieldDataType,
  AggregationType,
} from './semantic-layer/semantic-layer.types.js';

// K9 — Design System interfaces
export type { IDesignSystem } from './design-system/design-system.interface.js';
export type {
  DesignToken,
  Theme,
  ComponentDef,
  CreateTokenInput,
  UpdateTokenInput,
  CreateThemeInput,
  UpdateThemeInput,
  CreateComponentInput,
  UpdateComponentInput,
  ResolvedTheme,
  TokenCategory,
  ThemeStatus,
  ComponentStatus,
} from './design-system/design-system.types.js';

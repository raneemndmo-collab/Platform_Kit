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

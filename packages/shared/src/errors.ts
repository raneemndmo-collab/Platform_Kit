import type { ErrorCode } from './types.js';

export class PlatformError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

export class ValidationError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends PlatformError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class PermissionDeniedError extends PlatformError {
  constructor(message = 'Permission denied', details?: Record<string, unknown>) {
    super('PERMISSION_DENIED', message, 403, details);
    this.name = 'PermissionDeniedError';
  }
}

export class NotFoundError extends PlatformError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details);
    this.name = 'ConflictError';
  }
}

export class InvalidStateTransitionError extends PlatformError {
  constructor(from: string, to: string) {
    super('INVALID_STATE_TRANSITION', `Invalid state transition from '${from}' to '${to}'`, 400, { from, to });
    this.name = 'InvalidStateTransitionError';
  }
}

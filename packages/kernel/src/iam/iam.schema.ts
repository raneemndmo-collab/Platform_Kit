/** Fastify JSON Schema definitions for IAM route validation */

export const registerSchema = {
  body: {
    type: 'object' as const,
    required: ['email', 'password', 'display_name', 'tenant_slug'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      tenant_slug: { type: 'string', minLength: 1, maxLength: 100 },
    },
    additionalProperties: false,
  },
};

export const loginSchema = {
  body: {
    type: 'object' as const,
    required: ['email', 'password', 'tenant_slug'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
      tenant_slug: { type: 'string', minLength: 1, maxLength: 100 },
    },
    additionalProperties: false,
  },
};

export const updateUserSchema = {
  body: {
    type: 'object' as const,
    properties: {
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      status: { type: 'string', enum: ['active', 'inactive'] },
    },
    additionalProperties: false,
    minProperties: 1,
  },
};

export const createRoleSchema = {
  body: {
    type: 'object' as const,
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
  },
};

export const updateRoleSchema = {
  body: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
    minProperties: 1,
  },
};

export const roleAssignSchema = {
  body: {
    type: 'object' as const,
    required: ['user_id'],
    properties: {
      user_id: { type: 'string', format: 'uuid' },
    },
    additionalProperties: false,
  },
};

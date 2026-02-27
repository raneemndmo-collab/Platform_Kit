/** JSON Schema for POST /api/v1/objects */
export const createObjectSchema = {
  body: {
    type: 'object' as const,
    required: ['type', 'data'],
    properties: {
      type: { type: 'string' as const, minLength: 1 },
      data: { type: 'object' as const },
    },
    additionalProperties: false,
  },
};

/** JSON Schema for PATCH /api/v1/objects/:id */
export const updateObjectSchema = {
  body: {
    type: 'object' as const,
    required: ['data'],
    properties: {
      data: { type: 'object' as const },
    },
    additionalProperties: false,
  },
};

/** JSON Schema for POST /api/v1/objects/:id/transition */
export const transitionObjectSchema = {
  body: {
    type: 'object' as const,
    required: ['state'],
    properties: {
      state: {
        type: 'string' as const,
        enum: ['draft', 'active', 'archived', 'deleted'],
      },
    },
    additionalProperties: false,
  },
};

/** Query params for GET /api/v1/objects */
export const listObjectsSchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      type: { type: 'string' as const },
      state: {
        type: 'string' as const,
        enum: ['draft', 'active', 'archived', 'deleted'],
      },
      cursor: { type: 'string' as const },
      limit: { type: 'integer' as const, minimum: 1, maximum: 100 },
    },
    additionalProperties: false,
  },
};

/** K9 — JSON Schema validation for Design System inputs */

export const createTokenSchema = {
  body: {
    type: 'object',
    required: ['name', 'category', 'value'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      category: { type: 'string', enum: ['color', 'typography', 'spacing', 'sizing', 'border', 'shadow', 'opacity'] },
      value: { type: 'string', minLength: 1, maxLength: 1000 },
      description: { type: 'string', maxLength: 1000 },
    },
    additionalProperties: false,
  },
} as const;

export const updateTokenSchema = {
  body: {
    type: 'object',
    properties: {
      value: { type: 'string', minLength: 1, maxLength: 1000 },
      description: { type: 'string', maxLength: 1000 },
    },
    additionalProperties: false,
  },
} as const;

export const createThemeSchema = {
  body: {
    type: 'object',
    required: ['name', 'display_name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      is_default: { type: 'boolean' },
      token_overrides: { type: 'object' },
    },
    additionalProperties: false,
  },
} as const;

export const updateThemeSchema = {
  body: {
    type: 'object',
    properties: {
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      status: { type: 'string', enum: ['draft', 'active', 'archived'] },
      is_default: { type: 'boolean' },
      token_overrides: { type: 'object' },
    },
    additionalProperties: false,
  },
} as const;

export const createComponentSchema = {
  body: {
    type: 'object',
    required: ['name', 'display_name', 'category'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      category: { type: 'string', minLength: 1, maxLength: 100 },
      variants: { type: 'object' },
      default_props: { type: 'object' },
    },
    additionalProperties: false,
  },
} as const;

export const updateComponentSchema = {
  body: {
    type: 'object',
    properties: {
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      category: { type: 'string', minLength: 1, maxLength: 100 },
      status: { type: 'string', enum: ['draft', 'active', 'deprecated'] },
      variants: { type: 'object' },
      default_props: { type: 'object' },
    },
    additionalProperties: false,
  },
} as const;

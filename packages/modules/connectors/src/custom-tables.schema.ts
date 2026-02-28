/**
 * M13 — Custom Tables — Fastify JSON Schema definitions
 */

const columnDefSchema = {
  type: 'object',
  required: ['name', 'display_name', 'data_type', 'required'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 64 },
    display_name: { type: 'string', minLength: 1, maxLength: 128 },
    data_type: { type: 'string', enum: ['text', 'number', 'boolean', 'date', 'datetime', 'select'] },
    required: { type: 'boolean' },
    options: { type: 'array', items: { type: 'string' } },
    default_value: {},
  },
  additionalProperties: false,
};

/* ── Table schemas ── */

export const createTableSchema = {
  body: {
    type: 'object',
    required: ['name', 'display_name', 'columns'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z][a-z0-9_]*$' },
      display_name: { type: 'string', minLength: 1, maxLength: 128 },
      description: { type: 'string', maxLength: 512 },
      columns: { type: 'array', minItems: 1, maxItems: 100, items: columnDefSchema },
    },
    additionalProperties: false,
  },
};

export const updateTableSchema = {
  body: {
    type: 'object',
    properties: {
      display_name: { type: 'string', minLength: 1, maxLength: 128 },
      description: { type: 'string', maxLength: 512 },
      columns: { type: 'array', minItems: 1, maxItems: 100, items: columnDefSchema },
      status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    },
    additionalProperties: false,
  },
};

/* ── Row schemas ── */

export const createRowSchema = {
  body: {
    type: 'object',
    required: ['row_data'],
    properties: {
      row_data: { type: 'object' },
    },
    additionalProperties: false,
  },
};

export const updateRowSchema = {
  body: {
    type: 'object',
    required: ['row_data'],
    properties: {
      row_data: { type: 'object' },
    },
    additionalProperties: false,
  },
};

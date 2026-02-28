/** K8 — JSON Schema validation for Semantic Data Layer inputs */

const fieldSchema = {
  type: 'object',
  required: ['name', 'display_name', 'data_type'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    display_name: { type: 'string', minLength: 1, maxLength: 255 },
    data_type: { type: 'string', enum: ['string', 'number', 'boolean', 'date', 'timestamp'] },
    is_dimension: { type: 'boolean' },
    is_metric: { type: 'boolean' },
    expression: { type: 'string', maxLength: 1000 },
    description: { type: 'string', maxLength: 1000 },
    ordinal: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const;

export const registerDatasetSchema = {
  body: {
    type: 'object',
    required: ['name', 'display_name', 'source_type', 'fields'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      source_type: { type: 'string', enum: ['table', 'view', 'query'] },
      source_config: { type: 'object' },
      fields: { type: 'array', minItems: 1, items: fieldSchema },
    },
    additionalProperties: false,
  },
} as const;

export const updateDatasetSchema = {
  body: {
    type: 'object',
    properties: {
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      source_config: { type: 'object' },
      status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    },
    additionalProperties: false,
  },
} as const;

export const defineMetricSchema = {
  body: {
    type: 'object',
    required: ['name', 'display_name', 'expression', 'aggregation'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      display_name: { type: 'string', minLength: 1, maxLength: 255 },
      expression: { type: 'string', minLength: 1, maxLength: 1000 },
      aggregation: { type: 'string', enum: ['sum', 'avg', 'count', 'min', 'max', 'count_distinct'] },
      dimensions: { type: 'array', items: { type: 'string' } },
      description: { type: 'string', maxLength: 1000 },
    },
    additionalProperties: false,
  },
} as const;

export const semanticQuerySchema = {
  body: {
    type: 'object',
    required: ['dimensions', 'metrics'],
    properties: {
      dimensions: { type: 'array', items: { type: 'string' }, minItems: 0 },
      metrics: { type: 'array', items: { type: 'string' }, minItems: 1 },
      filters: {
        type: 'array',
        items: {
          type: 'object',
          required: ['field', 'operator', 'value'],
          properties: {
            field: { type: 'string' },
            operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'like'] },
            value: {},
          },
          additionalProperties: false,
        },
      },
      limit: { type: 'integer', minimum: 1, maximum: 10000 },
      offset: { type: 'integer', minimum: 0 },
    },
    additionalProperties: false,
  },
} as const;

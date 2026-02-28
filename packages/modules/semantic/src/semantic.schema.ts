/** M11 Semantic Model + KPI Hub -- Fastify JSON Schema Definitions */

export const createModelSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
};

export const updateModelSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
};

export const defineDimensionSchema = {
  params: {
    type: 'object',
    required: ['modelId'],
    properties: { modelId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      source_column: { type: 'string', maxLength: 200 },
      dim_type: { type: 'string', enum: ['standard', 'time', 'geographic', 'hierarchy'] },
      hierarchy: { type: 'object' },
      description: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
};

export const defineFactSchema = {
  params: {
    type: 'object',
    required: ['modelId'],
    properties: { modelId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['name', 'expression'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      expression: { type: 'string', minLength: 1, maxLength: 2000 },
      aggregation: { type: 'string', enum: ['sum', 'avg', 'count', 'min', 'max', 'distinct_count', 'custom'] },
      format: { type: 'string', maxLength: 100 },
      description: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
};

export const createRelationshipSchema = {
  params: {
    type: 'object',
    required: ['modelId'],
    properties: { modelId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['source_dimension_id', 'target_dimension_id'],
    properties: {
      source_dimension_id: { type: 'string', format: 'uuid' },
      target_dimension_id: { type: 'string', format: 'uuid' },
      rel_type: { type: 'string', enum: ['one_to_one', 'one_to_many', 'many_to_many'] },
      join_expression: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
};

export const createKpiSchema = {
  body: {
    type: 'object',
    required: ['name', 'formula'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
      model_id: { type: 'string', format: 'uuid' },
      formula: { type: 'string', minLength: 1, maxLength: 2000 },
      dimensions: { type: 'array', items: { type: 'string' } },
      target_value: { type: 'number' },
      threshold_warning: { type: 'number' },
      threshold_critical: { type: 'number' },
    },
    additionalProperties: false,
  },
};

export const updateKpiSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
      formula: { type: 'string', minLength: 1, maxLength: 2000 },
      dimensions: { type: 'array', items: { type: 'string' } },
      target_value: { type: 'number' },
      threshold_warning: { type: 'number' },
      threshold_critical: { type: 'number' },
      change_reason: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
};

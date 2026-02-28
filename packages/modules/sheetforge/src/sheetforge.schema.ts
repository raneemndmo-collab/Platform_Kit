/** M8 SheetForge -- Fastify JSON Schema Definitions */

export const uploadLibrarySchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      file_type: { type: 'string', enum: ['xlsx', 'csv', 'xls'] },
      file_url: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const updateLibrarySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      status: { type: 'string', enum: ['uploaded', 'indexing', 'indexed', 'error'] },
    },
    additionalProperties: false,
  },
};

export const createCompositionSchema = {
  body: {
    type: 'object',
    required: ['name', 'source_sheets', 'join_config'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
      source_sheets: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['sheet_id', 'alias', 'selected_columns'],
          properties: {
            sheet_id: { type: 'string' },
            alias: { type: 'string' },
            selected_columns: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      join_config: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['inner', 'left', 'right', 'full', 'none'] },
          left_key: { type: 'string' },
          right_key: { type: 'string' },
        },
      },
    },
    additionalProperties: false,
  },
};

export const updateCompositionSchema = {
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
      source_sheets: {
        type: 'array',
        items: {
          type: 'object',
          required: ['sheet_id', 'alias', 'selected_columns'],
          properties: {
            sheet_id: { type: 'string' },
            alias: { type: 'string' },
            selected_columns: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      join_config: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['inner', 'left', 'right', 'full', 'none'] },
          left_key: { type: 'string' },
          right_key: { type: 'string' },
        },
      },
      status: { type: 'string', enum: ['draft', 'composed', 'published', 'error'] },
    },
    additionalProperties: false,
  },
};

export const runGapAnalysisSchema = {
  params: {
    type: 'object',
    required: ['compositionId'],
    properties: { compositionId: { type: 'string', format: 'uuid' } },
  },
};

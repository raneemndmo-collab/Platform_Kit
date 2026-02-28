/** K7 — Lineage Engine JSON Schemas for input validation */

export const addEdgeSchema = {
  type: 'object' as const,
  required: ['source_id', 'source_type', 'target_id', 'target_type', 'relationship'],
  properties: {
    source_id: { type: 'string' as const, minLength: 1, maxLength: 255 },
    source_type: { type: 'string' as const, minLength: 1, maxLength: 100 },
    target_id: { type: 'string' as const, minLength: 1, maxLength: 255 },
    target_type: { type: 'string' as const, minLength: 1, maxLength: 100 },
    relationship: { type: 'string' as const, minLength: 1, maxLength: 100 },
    metadata: { type: 'object' as const, default: {} },
  },
  additionalProperties: false,
};

export const removeEdgeSchema = {
  type: 'object' as const,
  required: ['source_id', 'target_id', 'relationship'],
  properties: {
    source_id: { type: 'string' as const, minLength: 1, maxLength: 255 },
    target_id: { type: 'string' as const, minLength: 1, maxLength: 255 },
    relationship: { type: 'string' as const, minLength: 1, maxLength: 100 },
  },
  additionalProperties: false,
};

export const traversalParamsSchema = {
  type: 'object' as const,
  required: ['nodeId'],
  properties: {
    nodeId: { type: 'string' as const, minLength: 1 },
  },
};

export const traversalQuerySchema = {
  type: 'object' as const,
  properties: {
    depth: { type: 'integer' as const, minimum: 1, maximum: 20, default: 5 },
  },
};

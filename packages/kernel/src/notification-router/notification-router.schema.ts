/** K10 — Notification Router JSON schemas for Fastify validation */

export const createChannelSchema = {
  body: {
    type: 'object',
    required: ['name', 'channel_type'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      channel_type: { type: 'string', enum: ['email', 'in_app'] },
      config: { type: 'object', default: {} },
      enabled: { type: 'boolean', default: true },
    },
  },
};

export const updateChannelSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      config: { type: 'object' },
      enabled: { type: 'boolean' },
    },
  },
};

export const createTemplateSchema = {
  body: {
    type: 'object',
    required: ['name', 'channel_type', 'subject', 'body'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      channel_type: { type: 'string', enum: ['email', 'in_app'] },
      subject: { type: 'string', minLength: 1, maxLength: 500 },
      body: { type: 'string', minLength: 1 },
      variables: { type: 'array', items: { type: 'string' }, default: [] },
    },
  },
};

export const updateTemplateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      subject: { type: 'string', minLength: 1, maxLength: 500 },
      body: { type: 'string', minLength: 1 },
      variables: { type: 'array', items: { type: 'string' } },
      status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    },
  },
};

export const sendNotificationSchema = {
  body: {
    type: 'object',
    required: ['channel_type', 'recipient_id', 'subject', 'body'],
    additionalProperties: false,
    properties: {
      channel_type: { type: 'string', enum: ['email', 'in_app'] },
      template_id: { type: 'string', format: 'uuid' },
      recipient_id: { type: 'string', format: 'uuid' },
      subject: { type: 'string', minLength: 1, maxLength: 500 },
      body: { type: 'string', minLength: 1 },
      metadata: { type: 'object', default: {} },
    },
  },
};

export const markNotificationSchema = {
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['delivered', 'failed'] },
    },
  },
};

export const upsertPreferenceSchema = {
  body: {
    type: 'object',
    required: ['channel_type', 'enabled'],
    additionalProperties: false,
    properties: {
      channel_type: { type: 'string', enum: ['email', 'in_app'] },
      enabled: { type: 'boolean' },
    },
  },
};

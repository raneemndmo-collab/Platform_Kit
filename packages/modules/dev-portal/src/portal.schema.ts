/**
 * M32 Developer Portal — Zod Validation Schemas
 */
import { z } from 'zod';

export const MAX_PORTAL_KEYS_PER_TENANT = 50;
export const MAX_DOC_PAGES_PER_TENANT = 500;
export const MAX_WEBHOOKS_PER_TENANT = 20;

const envEnum = z.enum(['sandbox', 'production']);
const keyStatusEnum = z.enum(['active', 'revoked', 'expired']);

/* ── API Keys ── */
export const createPortalKeySchema = z.object({
  name: z.string().min(1).max(255),
  environment: envEnum.optional().default('sandbox'),
  scopes: z.array(z.string().max(100)).min(1).max(50),
  rate_limit: z.number().int().min(1).max(100000).optional().default(1000),
  expires_at: z.string().datetime().nullable().optional(),
});

export const updatePortalKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scopes: z.array(z.string().max(100)).min(1).max(50).optional(),
  status: keyStatusEnum.optional(),
  rate_limit: z.number().int().min(1).max(100000).optional(),
});

/* ── Usage Logs ── */
export const createUsageLogSchema = z.object({
  api_key_id: z.string().uuid(),
  endpoint: z.string().min(1).max(500),
  method: z.string().min(1).max(10),
  status_code: z.number().int().min(100).max(599),
  response_time_ms: z.number().int().min(0),
  ip_address: z.string().max(45).nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

/* ── Doc Pages ── */
export const createDocPageSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-/]+$/),
  title: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  content_ref: z.string().max(500).nullable().optional(),
  version: z.string().min(1).max(20).optional().default('1.0'),
  is_published: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).max(10000).optional().default(0),
});

export const updateDocPageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  content_ref: z.string().max(500).nullable().optional(),
  version: z.string().min(1).max(20).optional(),
  is_published: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(10000).optional(),
});

/* ── Webhooks ── */
export const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url().max(1000),
  events: z.array(z.string().max(100)).min(1).max(50),
  is_active: z.boolean().optional().default(true),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().max(1000).optional(),
  events: z.array(z.string().max(100)).min(1).max(50).optional(),
  is_active: z.boolean().optional(),
});

/* ── List ── */
export const listSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const listUsageLogsSchema = z.object({
  api_key_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

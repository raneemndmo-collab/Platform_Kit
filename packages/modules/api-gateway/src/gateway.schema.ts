/**
 * M29 API Gateway Hardening — Zod Validation Schemas
 */
import { z } from 'zod';

export const MAX_API_KEYS_PER_TENANT = 100;
export const MAX_IP_ENTRIES_PER_TENANT = 200;
export const MAX_RATE_LIMITS_PER_TENANT = 50;

const apiKeyStatusEnum = z.enum(['active', 'revoked', 'expired']);

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string().max(100)).max(50).default([]),
  expires_at: z.string().datetime().nullable().optional(),
});

export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scopes: z.array(z.string().max(100)).max(50).optional(),
  status: apiKeyStatusEnum.optional(),
});

export const createIpAllowlistSchema = z.object({
  cidr: z.string().min(1).max(45),
  label: z.string().min(1).max(255),
  is_active: z.boolean().optional().default(true),
});

export const updateIpAllowlistSchema = z.object({
  cidr: z.string().min(1).max(45).optional(),
  label: z.string().min(1).max(255).optional(),
  is_active: z.boolean().optional(),
});

export const createRateLimitSchema = z.object({
  name: z.string().min(1).max(255),
  endpoint_pattern: z.string().min(1).max(500),
  max_requests: z.number().int().min(1).max(1_000_000),
  window_seconds: z.number().int().min(1).max(86400),
  is_active: z.boolean().optional().default(true),
});

export const updateRateLimitSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  endpoint_pattern: z.string().min(1).max(500).optional(),
  max_requests: z.number().int().min(1).max(1_000_000).optional(),
  window_seconds: z.number().int().min(1).max(86400).optional(),
  is_active: z.boolean().optional(),
});

export const listSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

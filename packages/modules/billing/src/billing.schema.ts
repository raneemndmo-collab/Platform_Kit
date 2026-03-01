/**
 * M30 Billing / Licensing — Zod Validation Schemas
 */
import { z } from 'zod';

export const MAX_PLANS_PER_TENANT = 20;
export const MAX_FLAGS_PER_TENANT = 200;
export const MAX_QUOTAS_PER_TENANT = 100;

const tierEnum = z.enum(['free', 'starter', 'professional', 'enterprise']);
const enforcementEnum = z.enum(['soft', 'hard']);
const subscriptionStatusEnum = z.enum(['active', 'suspended', 'cancelled', 'trial']);

/* ── Plans ── */
export const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).nullable().optional(),
  tier: tierEnum,
  max_users: z.number().int().min(1).max(100000),
  max_storage_mb: z.number().int().min(1).max(10000000),
  max_api_calls_per_month: z.number().int().min(0).max(100000000),
  features: z.record(z.boolean()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  tier: tierEnum.optional(),
  max_users: z.number().int().min(1).max(100000).optional(),
  max_storage_mb: z.number().int().min(1).max(10000000).optional(),
  max_api_calls_per_month: z.number().int().min(0).max(100000000).optional(),
  features: z.record(z.boolean()).optional(),
  is_active: z.boolean().optional(),
});

/* ── Feature Flags ── */
export const createFeatureFlagSchema = z.object({
  plan_id: z.string().uuid().nullable().optional(),
  key: z.string().min(1).max(100).regex(/^[a-z0-9_.]+$/),
  label: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  is_enabled: z.boolean().optional().default(true),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateFeatureFlagSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  is_enabled: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/* ── Usage Records ── */
export const createUsageRecordSchema = z.object({
  resource_type: z.string().min(1).max(100),
  resource_id: z.string().max(255).nullable().optional(),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(50),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
});

/* ── Quota Configs ── */
export const createQuotaSchema = z.object({
  plan_id: z.string().uuid().nullable().optional(),
  resource_type: z.string().min(1).max(100),
  max_quantity: z.number().int().min(0).max(100000000),
  unit: z.string().min(1).max(50),
  enforcement_mode: enforcementEnum.optional().default('soft'),
  is_active: z.boolean().optional().default(true),
});

export const updateQuotaSchema = z.object({
  max_quantity: z.number().int().min(0).max(100000000).optional(),
  enforcement_mode: enforcementEnum.optional(),
  is_active: z.boolean().optional(),
});

/* ── Subscriptions ── */
export const createSubscriptionSchema = z.object({
  plan_id: z.string().uuid(),
  status: subscriptionStatusEnum.optional().default('active'),
  expires_at: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateSubscriptionSchema = z.object({
  plan_id: z.string().uuid().optional(),
  status: subscriptionStatusEnum.optional(),
  expires_at: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/* ── List ── */
export const listSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

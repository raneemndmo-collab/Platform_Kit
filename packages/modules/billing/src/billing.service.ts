/**
 * M30 Billing / Licensing — Service Layer (Metadata Only)
 *
 * Plan definitions, feature flags, usage tracking, quota enforcement.
 * No payment gateway. No invoice engine. No Stripe/PayPal.
 * Schema: mod_billing — no cross-schema queries.
 */
import type postgres from 'postgres';
import {
  createPlanSchema, updatePlanSchema,
  createFeatureFlagSchema, updateFeatureFlagSchema,
  createUsageRecordSchema,
  createQuotaSchema, updateQuotaSchema,
  createSubscriptionSchema, updateSubscriptionSchema,
  listSchema,
  MAX_PLANS_PER_TENANT, MAX_FLAGS_PER_TENANT, MAX_QUOTAS_PER_TENANT,
} from './billing.schema.js';
import { ValidationError, NotFoundError } from '@rasid/shared';

export class BillingService {
  /* ══════════════════════════════════════════
   *  Plans
   * ══════════════════════════════════════════ */
  async listPlans(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_billing.plans WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getPlan(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT * FROM mod_billing.plans WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Plan not found');
    return rows[0];
  }

  async createPlan(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createPlanSchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_billing.plans WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_PLANS_PER_TENANT) throw new ValidationError(`Maximum ${MAX_PLANS_PER_TENANT} plans per tenant`);
    const rows = await sql`
      INSERT INTO mod_billing.plans (tenant_id, name, slug, description, tier, max_users, max_storage_mb, max_api_calls_per_month, features, is_active)
      VALUES (${tenantId}, ${data.name}, ${data.slug}, ${data.description ?? null}, ${data.tier},
              ${data.max_users}, ${data.max_storage_mb}, ${data.max_api_calls_per_month},
              ${JSON.stringify(data.features)}, ${data.is_active})
      RETURNING *`;
    return rows[0];
  }

  async updatePlan(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updatePlanSchema.parse(input);
    await this.getPlan(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_billing.plans
      SET name = COALESCE(${data.name ?? null}, name),
          description = COALESCE(${data.description ?? null}, description),
          tier = COALESCE(${data.tier ?? null}, tier),
          max_users = COALESCE(${data.max_users ?? null}, max_users),
          max_storage_mb = COALESCE(${data.max_storage_mb ?? null}, max_storage_mb),
          max_api_calls_per_month = COALESCE(${data.max_api_calls_per_month ?? null}, max_api_calls_per_month),
          features = COALESCE(${data.features ? JSON.stringify(data.features) : null}, features),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deletePlan(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getPlan(sql, tenantId, id);
    await sql`DELETE FROM mod_billing.plans WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Feature Flags
   * ══════════════════════════════════════════ */
  async listFlags(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_billing.feature_flags WHERE tenant_id = ${tenantId} ORDER BY key ASC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getFlag(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT * FROM mod_billing.feature_flags WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Feature flag not found');
    return rows[0];
  }

  async createFlag(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createFeatureFlagSchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_billing.feature_flags WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_FLAGS_PER_TENANT) throw new ValidationError(`Maximum ${MAX_FLAGS_PER_TENANT} feature flags per tenant`);
    const rows = await sql`
      INSERT INTO mod_billing.feature_flags (tenant_id, plan_id, key, label, description, is_enabled, metadata)
      VALUES (${tenantId}, ${data.plan_id ?? null}, ${data.key}, ${data.label}, ${data.description ?? null},
              ${data.is_enabled}, ${JSON.stringify(data.metadata)})
      RETURNING *`;
    return rows[0];
  }

  async updateFlag(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateFeatureFlagSchema.parse(input);
    await this.getFlag(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_billing.feature_flags
      SET label = COALESCE(${data.label ?? null}, label),
          description = COALESCE(${data.description ?? null}, description),
          is_enabled = COALESCE(${data.is_enabled ?? null}, is_enabled),
          metadata = COALESCE(${data.metadata ? JSON.stringify(data.metadata) : null}, metadata),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteFlag(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getFlag(sql, tenantId, id);
    await sql`DELETE FROM mod_billing.feature_flags WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Usage Records
   * ══════════════════════════════════════════ */
  async listUsage(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_billing.usage_records WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async createUsage(sql: postgres.Sql, tenantId: string, userId: string, input: unknown) {
    const data = createUsageRecordSchema.parse(input);
    const rows = await sql`
      INSERT INTO mod_billing.usage_records (tenant_id, resource_type, resource_id, quantity, unit, period_start, period_end, recorded_by)
      VALUES (${tenantId}, ${data.resource_type}, ${data.resource_id ?? null}, ${data.quantity},
              ${data.unit}, ${data.period_start}, ${data.period_end}, ${userId})
      RETURNING *`;
    return rows[0];
  }

  /* ══════════════════════════════════════════
   *  Quota Configs
   * ══════════════════════════════════════════ */
  async listQuotas(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_billing.quota_configs WHERE tenant_id = ${tenantId} ORDER BY resource_type ASC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getQuota(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT * FROM mod_billing.quota_configs WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Quota config not found');
    return rows[0];
  }

  async createQuota(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createQuotaSchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_billing.quota_configs WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_QUOTAS_PER_TENANT) throw new ValidationError(`Maximum ${MAX_QUOTAS_PER_TENANT} quotas per tenant`);
    const rows = await sql`
      INSERT INTO mod_billing.quota_configs (tenant_id, plan_id, resource_type, max_quantity, unit, enforcement_mode, is_active)
      VALUES (${tenantId}, ${data.plan_id ?? null}, ${data.resource_type}, ${data.max_quantity},
              ${data.unit}, ${data.enforcement_mode}, ${data.is_active})
      RETURNING *`;
    return rows[0];
  }

  async updateQuota(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateQuotaSchema.parse(input);
    await this.getQuota(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_billing.quota_configs
      SET max_quantity = COALESCE(${data.max_quantity ?? null}, max_quantity),
          enforcement_mode = COALESCE(${data.enforcement_mode ?? null}, enforcement_mode),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteQuota(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getQuota(sql, tenantId, id);
    await sql`DELETE FROM mod_billing.quota_configs WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Subscriptions
   * ══════════════════════════════════════════ */
  async listSubscriptions(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_billing.subscriptions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getSubscription(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT * FROM mod_billing.subscriptions WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Subscription not found');
    return rows[0];
  }

  async createSubscription(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createSubscriptionSchema.parse(input);
    const rows = await sql`
      INSERT INTO mod_billing.subscriptions (tenant_id, plan_id, status, expires_at, metadata)
      VALUES (${tenantId}, ${data.plan_id}, ${data.status}, ${data.expires_at ?? null},
              ${JSON.stringify(data.metadata)})
      RETURNING *`;
    return rows[0];
  }

  async updateSubscription(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateSubscriptionSchema.parse(input);
    await this.getSubscription(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_billing.subscriptions
      SET plan_id = COALESCE(${data.plan_id ?? null}, plan_id),
          status = COALESCE(${data.status ?? null}, status),
          expires_at = COALESCE(${data.expires_at ?? null}, expires_at),
          metadata = COALESCE(${data.metadata ? JSON.stringify(data.metadata) : null}, metadata),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }
}

/**
 * M30 Billing / Licensing — K3 Action Registration (Metadata Only)
 * Schema: mod_billing — no cross-schema queries.
 * No payment gateway. No invoice engine. No Stripe/PayPal.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { BillingService } from './billing.service.js';

const svc = new BillingService();
const MOD = 'rasid.mod.billing';
const MID = 'mod_billing';
const S = { type: 'object', properties: {} } as Record<string, unknown>;

export function registerBillingActions(): void {
  /* ── Plans ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.plan.list`, display_name: 'List Billing Plans', module_id: MID, resource: 'billing_plans', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_plans.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listPlans(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.plan.get`, display_name: 'Get Billing Plan', module_id: MID, resource: 'billing_plans', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_plans.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getPlan(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'billing_plan' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.plan.create`, display_name: 'Create Billing Plan', module_id: MID, resource: 'billing_plans', verb: 'create', sensitivity: 'standard', required_permissions: ['billing_plans.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createPlan(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'billing_plan', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.plan.update`, display_name: 'Update Billing Plan', module_id: MID, resource: 'billing_plans', verb: 'update', sensitivity: 'standard', required_permissions: ['billing_plans.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updatePlan(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'billing_plan', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.plan.delete`, display_name: 'Delete Billing Plan', module_id: MID, resource: 'billing_plans', verb: 'delete', sensitivity: 'critical', required_permissions: ['billing_plans.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deletePlan(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'billing_plan' }; },
  );

  /* ── Feature Flags ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.flag.list`, display_name: 'List Feature Flags', module_id: MID, resource: 'billing_flags', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_flags.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listFlags(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.flag.get`, display_name: 'Get Feature Flag', module_id: MID, resource: 'billing_flags', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_flags.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getFlag(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'billing_flag' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.flag.create`, display_name: 'Create Feature Flag', module_id: MID, resource: 'billing_flags', verb: 'create', sensitivity: 'standard', required_permissions: ['billing_flags.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createFlag(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'billing_flag', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.flag.update`, display_name: 'Update Feature Flag', module_id: MID, resource: 'billing_flags', verb: 'update', sensitivity: 'standard', required_permissions: ['billing_flags.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateFlag(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'billing_flag', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.flag.delete`, display_name: 'Delete Feature Flag', module_id: MID, resource: 'billing_flags', verb: 'delete', sensitivity: 'standard', required_permissions: ['billing_flags.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteFlag(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'billing_flag' }; },
  );

  /* ── Usage Records ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.usage.list`, display_name: 'List Usage Records', module_id: MID, resource: 'billing_usage', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_usage.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listUsage(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.usage.create`, display_name: 'Create Usage Record', module_id: MID, resource: 'billing_usage', verb: 'create', sensitivity: 'standard', required_permissions: ['billing_usage.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createUsage(sql, ctx.tenantId, ctx.userId, input); return { data, object_id: data.id, object_type: 'billing_usage', after: data }; },
  );

  /* ── Quota Configs ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.list`, display_name: 'List Quota Configs', module_id: MID, resource: 'billing_quotas', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_quotas.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listQuotas(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.get`, display_name: 'Get Quota Config', module_id: MID, resource: 'billing_quotas', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_quotas.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getQuota(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'billing_quota' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.create`, display_name: 'Create Quota Config', module_id: MID, resource: 'billing_quotas', verb: 'create', sensitivity: 'standard', required_permissions: ['billing_quotas.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createQuota(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'billing_quota', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.update`, display_name: 'Update Quota Config', module_id: MID, resource: 'billing_quotas', verb: 'update', sensitivity: 'standard', required_permissions: ['billing_quotas.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateQuota(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'billing_quota', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.quota.delete`, display_name: 'Delete Quota Config', module_id: MID, resource: 'billing_quotas', verb: 'delete', sensitivity: 'standard', required_permissions: ['billing_quotas.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteQuota(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'billing_quota' }; },
  );

  /* ── Subscriptions ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.subscription.list`, display_name: 'List Subscriptions', module_id: MID, resource: 'billing_subscriptions', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_subscriptions.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listSubscriptions(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.subscription.get`, display_name: 'Get Subscription', module_id: MID, resource: 'billing_subscriptions', verb: 'read', sensitivity: 'standard', required_permissions: ['billing_subscriptions.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getSubscription(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'billing_subscription' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.subscription.create`, display_name: 'Create Subscription', module_id: MID, resource: 'billing_subscriptions', verb: 'create', sensitivity: 'critical', required_permissions: ['billing_subscriptions.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createSubscription(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'billing_subscription', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.subscription.update`, display_name: 'Update Subscription', module_id: MID, resource: 'billing_subscriptions', verb: 'update', sensitivity: 'standard', required_permissions: ['billing_subscriptions.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateSubscription(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'billing_subscription', after: data }; },
  );
}

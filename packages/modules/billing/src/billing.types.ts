/**
 * M30 Billing / Licensing — Type Definitions (Metadata Only)
 *
 * Plan definitions, feature flags, usage tracking metadata, quota enforcement.
 * No payment gateway. No invoice engine. No Stripe/PayPal.
 */

export interface BillingPlan {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  max_users: number;
  max_storage_mb: number;
  max_api_calls_per_month: number;
  features: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlag {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  key: string;
  label: string;
  description: string | null;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: string;
  tenant_id: string;
  resource_type: string;
  resource_id: string | null;
  quantity: number;
  unit: string;
  period_start: string;
  period_end: string;
  recorded_by: string;
  created_at: string;
}

export interface QuotaConfig {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  resource_type: string;
  max_quantity: number;
  unit: string;
  enforcement_mode: 'soft' | 'hard';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  started_at: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

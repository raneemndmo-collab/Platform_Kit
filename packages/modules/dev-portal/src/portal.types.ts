/**
 * M32 Developer Portal — Type Definitions (Metadata Only)
 * API key management, usage logs view, documentation metadata.
 * No external SDK publishing. No OpenAPI runtime generator. No Swagger UI.
 */

export interface PortalApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  environment: 'sandbox' | 'production';
  scopes: string[];
  status: 'active' | 'revoked' | 'expired';
  rate_limit: number;
  expires_at: string | null;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PortalUsageLog {
  id: string;
  tenant_id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PortalDocPage {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  category: string;
  content_ref: string | null;
  version: string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PortalWebhook {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  events: string[];
  secret_hash: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

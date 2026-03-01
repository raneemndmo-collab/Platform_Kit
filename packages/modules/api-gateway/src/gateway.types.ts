/**
 * M29 API Gateway Hardening — Type Definitions (Metadata Only)
 *
 * Stores API key metadata, IP allowlist configuration, and rate limit definitions.
 * No actual network-level enforcement. No reverse proxy. No NGINX.
 * Schema: mod_gateway — no cross-schema queries.
 */

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  status: ApiKeyStatus;
  expires_at: Date | null;
  last_used_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface IpAllowlistEntry {
  id: string;
  tenant_id: string;
  cidr: string;
  label: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RateLimitConfig {
  id: string;
  tenant_id: string;
  name: string;
  endpoint_pattern: string;
  max_requests: number;
  window_seconds: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

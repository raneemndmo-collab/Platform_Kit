/**
 * M29 API Gateway Hardening — Service Layer (Metadata Only)
 *
 * Stores API key metadata, IP allowlist config, rate limit definitions.
 * No actual network enforcement. No reverse proxy. No NGINX.
 * Schema: mod_gateway — no cross-schema queries.
 */
import type postgres from 'postgres';
import { createApiKeySchema, updateApiKeySchema, createIpAllowlistSchema, updateIpAllowlistSchema, createRateLimitSchema, updateRateLimitSchema, listSchema, MAX_API_KEYS_PER_TENANT, MAX_IP_ENTRIES_PER_TENANT, MAX_RATE_LIMITS_PER_TENANT } from './gateway.schema.js';
import { ValidationError, NotFoundError } from '@rasid/shared';
import { randomBytes, createHash } from 'crypto';

export class GatewayService {
  /* ── API Keys ── */
  async listApiKeys(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT id, tenant_id, name, key_prefix, scopes, status, expires_at, last_used_at, created_by, created_at, updated_at FROM mod_gateway.api_keys WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getApiKey(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT id, tenant_id, name, key_prefix, scopes, status, expires_at, last_used_at, created_by, created_at, updated_at FROM mod_gateway.api_keys WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('API key not found');
    return rows[0];
  }

  async createApiKey(sql: postgres.Sql, tenantId: string, userId: string, input: unknown) {
    const data = createApiKeySchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_gateway.api_keys WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_API_KEYS_PER_TENANT) throw new ValidationError(`Maximum ${MAX_API_KEYS_PER_TENANT} API keys per tenant`);
    const rawKey = randomBytes(32).toString('hex');
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const rows = await sql`
      INSERT INTO mod_gateway.api_keys (tenant_id, name, key_prefix, key_hash, scopes, status, expires_at, created_by)
      VALUES (${tenantId}, ${data.name}, ${keyPrefix}, ${keyHash}, ${sql.array(data.scopes)}, 'active', ${data.expires_at ?? null}, ${userId})
      RETURNING id, tenant_id, name, key_prefix, scopes, status, expires_at, created_by, created_at, updated_at`;
    return { ...rows[0], raw_key: rawKey };
  }

  async updateApiKey(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateApiKeySchema.parse(input);
    await this.getApiKey(sql, tenantId, id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.name !== undefined) { sets.push('name'); vals.push(data.name); }
    if (data.scopes !== undefined) { sets.push('scopes'); vals.push(data.scopes); }
    if (data.status !== undefined) { sets.push('status'); vals.push(data.status); }
    const rows = await sql`
      UPDATE mod_gateway.api_keys
      SET name = COALESCE(${data.name ?? null}, name),
          scopes = COALESCE(${data.scopes ? sql.array(data.scopes) : null}, scopes),
          status = COALESCE(${data.status ?? null}, status),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id, tenant_id, name, key_prefix, scopes, status, expires_at, last_used_at, created_by, created_at, updated_at`;
    return rows[0];
  }

  async deleteApiKey(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getApiKey(sql, tenantId, id);
    await sql`DELETE FROM mod_gateway.api_keys WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ── IP Allowlist ── */
  async listIpAllowlist(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_gateway.ip_allowlist WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async createIpEntry(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createIpAllowlistSchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_gateway.ip_allowlist WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_IP_ENTRIES_PER_TENANT) throw new ValidationError(`Maximum ${MAX_IP_ENTRIES_PER_TENANT} IP entries per tenant`);
    const rows = await sql`INSERT INTO mod_gateway.ip_allowlist (tenant_id, cidr, label, is_active) VALUES (${tenantId}, ${data.cidr}, ${data.label}, ${data.is_active}) RETURNING *`;
    return rows[0];
  }

  async updateIpEntry(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateIpAllowlistSchema.parse(input);
    const check = await sql`SELECT id FROM mod_gateway.ip_allowlist WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!check.length) throw new NotFoundError('IP entry not found');
    const rows = await sql`
      UPDATE mod_gateway.ip_allowlist
      SET cidr = COALESCE(${data.cidr ?? null}, cidr),
          label = COALESCE(${data.label ?? null}, label),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteIpEntry(sql: postgres.Sql, tenantId: string, id: string) {
    const check = await sql`SELECT id FROM mod_gateway.ip_allowlist WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!check.length) throw new NotFoundError('IP entry not found');
    await sql`DELETE FROM mod_gateway.ip_allowlist WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ── Rate Limits ── */
  async listRateLimits(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_gateway.rate_limit_configs WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async createRateLimit(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createRateLimitSchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_gateway.rate_limit_configs WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_RATE_LIMITS_PER_TENANT) throw new ValidationError(`Maximum ${MAX_RATE_LIMITS_PER_TENANT} rate limits per tenant`);
    const rows = await sql`INSERT INTO mod_gateway.rate_limit_configs (tenant_id, name, endpoint_pattern, max_requests, window_seconds, is_active) VALUES (${tenantId}, ${data.name}, ${data.endpoint_pattern}, ${data.max_requests}, ${data.window_seconds}, ${data.is_active}) RETURNING *`;
    return rows[0];
  }

  async updateRateLimit(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateRateLimitSchema.parse(input);
    const check = await sql`SELECT id FROM mod_gateway.rate_limit_configs WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!check.length) throw new NotFoundError('Rate limit config not found');
    const rows = await sql`
      UPDATE mod_gateway.rate_limit_configs
      SET name = COALESCE(${data.name ?? null}, name),
          endpoint_pattern = COALESCE(${data.endpoint_pattern ?? null}, endpoint_pattern),
          max_requests = COALESCE(${data.max_requests ?? null}, max_requests),
          window_seconds = COALESCE(${data.window_seconds ?? null}, window_seconds),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteRateLimit(sql: postgres.Sql, tenantId: string, id: string) {
    const check = await sql`SELECT id FROM mod_gateway.rate_limit_configs WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!check.length) throw new NotFoundError('Rate limit config not found');
    await sql`DELETE FROM mod_gateway.rate_limit_configs WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }
}

/**
 * M32 Developer Portal — Service Layer (Metadata Only)
 * No external SDK publishing. No OpenAPI runtime generator. No Swagger UI.
 * Schema: mod_dev_portal — no cross-schema queries.
 */
import type postgres from 'postgres';
import {
  createPortalKeySchema, updatePortalKeySchema,
  createUsageLogSchema, listUsageLogsSchema,
  createDocPageSchema, updateDocPageSchema,
  createWebhookSchema, updateWebhookSchema,
  listSchema,
  MAX_PORTAL_KEYS_PER_TENANT, MAX_DOC_PAGES_PER_TENANT, MAX_WEBHOOKS_PER_TENANT,
} from './portal.schema.js';
import { ValidationError, NotFoundError } from '@rasid/shared';
import { randomBytes, createHash } from 'crypto';

export class PortalService {
  /* ══════════════════════════════════════════
   *  Portal API Keys
   * ══════════════════════════════════════════ */
  async listKeys(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT id, tenant_id, name, key_prefix, environment, scopes, status, rate_limit, expires_at, last_used_at, created_by, created_at, updated_at FROM mod_dev_portal.api_keys WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getKey(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT id, tenant_id, name, key_prefix, environment, scopes, status, rate_limit, expires_at, last_used_at, created_by, created_at, updated_at FROM mod_dev_portal.api_keys WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Portal API key not found');
    return rows[0];
  }

  async createKey(sql: postgres.Sql, tenantId: string, userId: string, input: unknown) {
    const data = createPortalKeySchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_dev_portal.api_keys WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_PORTAL_KEYS_PER_TENANT) throw new ValidationError(`Maximum ${MAX_PORTAL_KEYS_PER_TENANT} portal API keys per tenant`);
    const rawKey = randomBytes(32).toString('hex');
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const rows = await sql`
      INSERT INTO mod_dev_portal.api_keys (tenant_id, name, key_prefix, key_hash, environment, scopes, status, rate_limit, expires_at, created_by)
      VALUES (${tenantId}, ${data.name}, ${keyPrefix}, ${keyHash}, ${data.environment},
              ${sql.array(data.scopes)}, 'active', ${data.rate_limit}, ${data.expires_at ?? null}, ${userId})
      RETURNING id, tenant_id, name, key_prefix, environment, scopes, status, rate_limit, expires_at, created_by, created_at, updated_at`;
    return { ...rows[0], raw_key: rawKey };
  }

  async updateKey(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updatePortalKeySchema.parse(input);
    await this.getKey(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_dev_portal.api_keys
      SET name = COALESCE(${data.name ?? null}, name),
          scopes = COALESCE(${data.scopes ? sql.array(data.scopes) : null}, scopes),
          status = COALESCE(${data.status ?? null}, status),
          rate_limit = COALESCE(${data.rate_limit ?? null}, rate_limit),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id, tenant_id, name, key_prefix, environment, scopes, status, rate_limit, expires_at, last_used_at, created_by, created_at, updated_at`;
    return rows[0];
  }

  async deleteKey(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getKey(sql, tenantId, id);
    await sql`DELETE FROM mod_dev_portal.api_keys WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Usage Logs
   * ══════════════════════════════════════════ */
  async listUsageLogs(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listUsageLogsSchema.parse(input ?? {});
    return sql`
      SELECT * FROM mod_dev_portal.usage_logs
      WHERE tenant_id = ${tenantId}
      ${f.api_key_id ? sql`AND api_key_id = ${f.api_key_id}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async createUsageLog(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createUsageLogSchema.parse(input);
    const rows = await sql`
      INSERT INTO mod_dev_portal.usage_logs (tenant_id, api_key_id, endpoint, method, status_code, response_time_ms, ip_address, metadata)
      VALUES (${tenantId}, ${data.api_key_id}, ${data.endpoint}, ${data.method}, ${data.status_code},
              ${data.response_time_ms}, ${data.ip_address ?? null}, ${JSON.stringify(data.metadata)})
      RETURNING *`;
    return rows[0];
  }

  /* ══════════════════════════════════════════
   *  Doc Pages (Metadata Only)
   * ══════════════════════════════════════════ */
  async listDocPages(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_dev_portal.doc_pages WHERE tenant_id = ${tenantId} ORDER BY category, sort_order ASC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getDocPage(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT * FROM mod_dev_portal.doc_pages WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Doc page not found');
    return rows[0];
  }

  async createDocPage(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createDocPageSchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_dev_portal.doc_pages WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_DOC_PAGES_PER_TENANT) throw new ValidationError(`Maximum ${MAX_DOC_PAGES_PER_TENANT} doc pages per tenant`);
    const rows = await sql`
      INSERT INTO mod_dev_portal.doc_pages (tenant_id, slug, title, category, content_ref, version, is_published, sort_order)
      VALUES (${tenantId}, ${data.slug}, ${data.title}, ${data.category}, ${data.content_ref ?? null},
              ${data.version}, ${data.is_published}, ${data.sort_order})
      RETURNING *`;
    return rows[0];
  }

  async updateDocPage(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateDocPageSchema.parse(input);
    await this.getDocPage(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_dev_portal.doc_pages
      SET title = COALESCE(${data.title ?? null}, title),
          category = COALESCE(${data.category ?? null}, category),
          content_ref = COALESCE(${data.content_ref ?? null}, content_ref),
          version = COALESCE(${data.version ?? null}, version),
          is_published = COALESCE(${data.is_published ?? null}, is_published),
          sort_order = COALESCE(${data.sort_order ?? null}, sort_order),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteDocPage(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getDocPage(sql, tenantId, id);
    await sql`DELETE FROM mod_dev_portal.doc_pages WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Webhooks (Metadata Only)
   * ══════════════════════════════════════════ */
  async listWebhooks(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT id, tenant_id, name, url, events, is_active, created_by, created_at, updated_at FROM mod_dev_portal.webhooks WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getWebhook(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT id, tenant_id, name, url, events, is_active, created_by, created_at, updated_at FROM mod_dev_portal.webhooks WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Webhook not found');
    return rows[0];
  }

  async createWebhook(sql: postgres.Sql, tenantId: string, userId: string, input: unknown) {
    const data = createWebhookSchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_dev_portal.webhooks WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_WEBHOOKS_PER_TENANT) throw new ValidationError(`Maximum ${MAX_WEBHOOKS_PER_TENANT} webhooks per tenant`);
    const secret = randomBytes(32).toString('hex');
    const secretHash = createHash('sha256').update(secret).digest('hex');
    const rows = await sql`
      INSERT INTO mod_dev_portal.webhooks (tenant_id, name, url, events, secret_hash, is_active, created_by)
      VALUES (${tenantId}, ${data.name}, ${data.url}, ${sql.array(data.events)}, ${secretHash}, ${data.is_active}, ${userId})
      RETURNING id, tenant_id, name, url, events, is_active, created_by, created_at, updated_at`;
    return { ...rows[0], signing_secret: secret };
  }

  async updateWebhook(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateWebhookSchema.parse(input);
    await this.getWebhook(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_dev_portal.webhooks
      SET name = COALESCE(${data.name ?? null}, name),
          url = COALESCE(${data.url ?? null}, url),
          events = COALESCE(${data.events ? sql.array(data.events) : null}, events),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id, tenant_id, name, url, events, is_active, created_by, created_at, updated_at`;
    return rows[0];
  }

  async deleteWebhook(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getWebhook(sql, tenantId, id);
    await sql`DELETE FROM mod_dev_portal.webhooks WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }
}

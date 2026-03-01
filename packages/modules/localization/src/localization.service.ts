/**
 * M31 Localization — Service Layer (Metadata Only)
 * No runtime translation engine.
 * Schema: mod_localization — no cross-schema queries.
 */
import type postgres from 'postgres';
import {
  createLanguageSchema, updateLanguageSchema,
  createTranslationKeySchema, updateTranslationKeySchema,
  createTranslationSchema, updateTranslationSchema,
  listSchema, listTranslationsSchema,
  MAX_LANGUAGES_PER_TENANT, MAX_KEYS_PER_TENANT,
} from './localization.schema.js';
import { ValidationError, NotFoundError } from '@rasid/shared';

export class LocalizationService {
  /* ══════════════════════════════════════════
   *  Languages
   * ══════════════════════════════════════════ */
  async listLanguages(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_localization.languages WHERE tenant_id = ${tenantId} ORDER BY code ASC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getLanguage(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT * FROM mod_localization.languages WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Language not found');
    return rows[0];
  }

  async createLanguage(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createLanguageSchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_localization.languages WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_LANGUAGES_PER_TENANT) throw new ValidationError(`Maximum ${MAX_LANGUAGES_PER_TENANT} languages per tenant`);
    const rows = await sql`
      INSERT INTO mod_localization.languages (tenant_id, code, name, native_name, direction, is_default, is_active)
      VALUES (${tenantId}, ${data.code}, ${data.name}, ${data.native_name}, ${data.direction}, ${data.is_default}, ${data.is_active})
      RETURNING *`;
    return rows[0];
  }

  async updateLanguage(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateLanguageSchema.parse(input);
    await this.getLanguage(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_localization.languages
      SET name = COALESCE(${data.name ?? null}, name),
          native_name = COALESCE(${data.native_name ?? null}, native_name),
          direction = COALESCE(${data.direction ?? null}, direction),
          is_default = COALESCE(${data.is_default ?? null}, is_default),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteLanguage(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getLanguage(sql, tenantId, id);
    await sql`DELETE FROM mod_localization.languages WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Translation Keys
   * ══════════════════════════════════════════ */
  async listKeys(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listSchema.parse(input ?? {});
    return sql`SELECT * FROM mod_localization.translation_keys WHERE tenant_id = ${tenantId} ORDER BY namespace, key ASC LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getKey(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT * FROM mod_localization.translation_keys WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Translation key not found');
    return rows[0];
  }

  async createKey(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createTranslationKeySchema.parse(input);
    const [count] = await sql`SELECT count(*)::int AS c FROM mod_localization.translation_keys WHERE tenant_id = ${tenantId}`;
    if (count.c >= MAX_KEYS_PER_TENANT) throw new ValidationError(`Maximum ${MAX_KEYS_PER_TENANT} translation keys per tenant`);
    const rows = await sql`
      INSERT INTO mod_localization.translation_keys (tenant_id, namespace, key, description)
      VALUES (${tenantId}, ${data.namespace}, ${data.key}, ${data.description ?? null})
      RETURNING *`;
    return rows[0];
  }

  async updateKey(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateTranslationKeySchema.parse(input);
    await this.getKey(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_localization.translation_keys
      SET description = COALESCE(${data.description ?? null}, description),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteKey(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getKey(sql, tenantId, id);
    await sql`DELETE FROM mod_localization.translation_keys WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }

  /* ══════════════════════════════════════════
   *  Translations
   * ══════════════════════════════════════════ */
  async listTranslations(sql: postgres.Sql, tenantId: string, input: unknown) {
    const f = listTranslationsSchema.parse(input ?? {});
    return sql`
      SELECT * FROM mod_localization.translations
      WHERE tenant_id = ${tenantId}
      ${f.key_id ? sql`AND key_id = ${f.key_id}` : sql``}
      ${f.language_id ? sql`AND language_id = ${f.language_id}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${f.limit} OFFSET ${f.offset}`;
  }

  async getTranslation(sql: postgres.Sql, tenantId: string, id: string) {
    const rows = await sql`SELECT * FROM mod_localization.translations WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!rows.length) throw new NotFoundError('Translation not found');
    return rows[0];
  }

  async createTranslation(sql: postgres.Sql, tenantId: string, input: unknown) {
    const data = createTranslationSchema.parse(input);
    const rows = await sql`
      INSERT INTO mod_localization.translations (tenant_id, key_id, language_id, value, is_reviewed)
      VALUES (${tenantId}, ${data.key_id}, ${data.language_id}, ${data.value}, ${data.is_reviewed})
      RETURNING *`;
    return rows[0];
  }

  async updateTranslation(sql: postgres.Sql, tenantId: string, id: string, input: unknown) {
    const data = updateTranslationSchema.parse(input);
    await this.getTranslation(sql, tenantId, id);
    const rows = await sql`
      UPDATE mod_localization.translations
      SET value = COALESCE(${data.value ?? null}, value),
          is_reviewed = COALESCE(${data.is_reviewed ?? null}, is_reviewed),
          updated_at = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows[0];
  }

  async deleteTranslation(sql: postgres.Sql, tenantId: string, id: string) {
    await this.getTranslation(sql, tenantId, id);
    await sql`DELETE FROM mod_localization.translations WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { deleted: true };
  }
}

/**
 * M12 Search Engine -- Service layer
 * Operates ONLY on mod_search schema.
 * No cross-schema queries. No background jobs. No caching.
 * Search is metadata-only via PostgreSQL full-text search.
 */

import type postgres from 'postgres';
import type {
  SearchIndexEntry,
  SearchSynonym,
  SearchAnalyticsEntry,
  SearchQuery,
  SearchResult,
  CreateIndexEntryInput,
  CreateSynonymInput,
  UpdateSynonymInput,
  ReindexInput,
} from './search.types.js';
import type { ISearchService } from './search.interface.js';
import { v7 as uuidv7 } from 'uuid';

export class SearchService implements ISearchService {

  /* ═══════════════════════════════════════════
   * SEARCH QUERY
   * Uses PostgreSQL ts_vector for full-text search on mod_search.search_index only.
   * No cross-schema queries. No external engine.
   * ═══════════════════════════════════════════ */

  async search(sql: postgres.ReservedSql, tenantId: string, query: SearchQuery): Promise<SearchResult> {
    const start = Date.now();
    const limit = Math.min(query.limit || 20, 100);
    const offset = query.offset || 0;
    const q = query.q.trim();

    if (!q) {
      return { items: [], total: 0, query: q, took_ms: 0 };
    }

    // Expand query with synonyms from mod_search.search_synonyms
    const synonymRows = await sql`
      SELECT synonyms FROM mod_search.search_synonyms
      WHERE tenant_id = ${tenantId}
        AND term = ${q.toLowerCase()}
    `;
    const allTerms = [q];
    if (synonymRows.length > 0) {
      const syns = synonymRows[0].synonyms as string[];
      allTerms.push(...syns);
    }

    // Build tsquery from all terms (OR logic for synonyms)
    const tsQuery = allTerms.map(t => t.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim()).filter(Boolean).join(' | ');

    if (!tsQuery) {
      return { items: [], total: 0, query: q, took_ms: Date.now() - start };
    }

    // Build WHERE conditions
    const conditions: string[] = [`tenant_id = '${tenantId}'`];
    if (query.module_id) {
      conditions.push(`module_id = '${query.module_id}'`);
    }
    if (query.object_type) {
      conditions.push(`object_type = '${query.object_type}'`);
    }

    // Count total matches
    const countResult = await sql`
      SELECT count(*)::int AS total
      FROM mod_search.search_index
      WHERE tenant_id = ${tenantId}
        ${query.module_id ? sql`AND module_id = ${query.module_id}` : sql``}
        ${query.object_type ? sql`AND object_type = ${query.object_type}` : sql``}
        AND to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', ${tsQuery})
    `;
    const total = countResult[0]?.total ?? 0;

    // Fetch results with ranking
    const rows = await sql`
      SELECT *,
        ts_rank(to_tsvector('english', title || ' ' || content), to_tsquery('english', ${tsQuery})) AS rank
      FROM mod_search.search_index
      WHERE tenant_id = ${tenantId}
        ${query.module_id ? sql`AND module_id = ${query.module_id}` : sql``}
        ${query.object_type ? sql`AND object_type = ${query.object_type}` : sql``}
        AND to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC, indexed_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const items = rows.map(r => ({
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      object_id: r.object_id as string,
      object_type: r.object_type as string,
      module_id: r.module_id as string,
      title: r.title as string,
      content: r.content as string,
      metadata: r.metadata as Record<string, unknown>,
      indexed_at: String(r.indexed_at),
      updated_at: String(r.updated_at),
    }));

    const took_ms = Date.now() - start;

    // Record analytics (fire-and-forget within same transaction)
    const analyticsId = uuidv7();
    await sql`
      INSERT INTO mod_search.search_analytics (id, tenant_id, query, results_count, filters)
      VALUES (${analyticsId}, ${tenantId}, ${q}, ${total}, ${JSON.stringify({
        module_id: query.module_id || null,
        object_type: query.object_type || null,
      })}::jsonb)
    `;

    return { items, total, query: q, took_ms };
  }

  /* ═══════════════════════════════════════════
   * INDEX CRUD
   * Entries are added/removed via K3 actions only.
   * No background indexing. No scheduler.
   * ═══════════════════════════════════════════ */

  async indexEntry(sql: postgres.ReservedSql, tenantId: string, _userId: string, input: CreateIndexEntryInput): Promise<SearchIndexEntry> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_search.search_index (id, tenant_id, object_id, object_type, module_id, title, content, metadata, indexed_at, updated_at)
      VALUES (${id}, ${tenantId}, ${input.object_id}, ${input.object_type}, ${input.module_id},
              ${input.title}, ${input.content || ''}, ${JSON.stringify(input.metadata || {})}::jsonb, ${now}, ${now})
      RETURNING *
    `;
    const r = rows[0];
    return {
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      object_id: r.object_id as string,
      object_type: r.object_type as string,
      module_id: r.module_id as string,
      title: r.title as string,
      content: r.content as string,
      metadata: r.metadata as Record<string, unknown>,
      indexed_at: String(r.indexed_at),
      updated_at: String(r.updated_at),
    };
  }

  async removeEntry(sql: postgres.ReservedSql, id: string): Promise<void> {
    await sql`DELETE FROM mod_search.search_index WHERE id = ${id}`;
  }

  async reindex(sql: postgres.ReservedSql, tenantId: string, input: ReindexInput): Promise<{ reindexed_count: number }> {
    // Simulated reindex: touch updated_at on matching entries.
    // No background job. No external engine. Synchronous metadata refresh.
    const result = await sql`
      UPDATE mod_search.search_index
      SET updated_at = now()
      WHERE tenant_id = ${tenantId}
        ${input.module_id ? sql`AND module_id = ${input.module_id}` : sql``}
        ${input.object_type ? sql`AND object_type = ${input.object_type}` : sql``}
      RETURNING id
    `;
    return { reindexed_count: result.length };
  }

  /* ═══════════════════════════════════════════
   * SYNONYMS
   * ═══════════════════════════════════════════ */

  async listSynonyms(sql: postgres.ReservedSql, tenantId: string): Promise<SearchSynonym[]> {
    const rows = await sql`
      SELECT * FROM mod_search.search_synonyms
      WHERE tenant_id = ${tenantId}
      ORDER BY term ASC
    `;
    return rows.map(r => ({
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      term: r.term as string,
      synonyms: r.synonyms as string[],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    }));
  }

  async getSynonym(sql: postgres.ReservedSql, id: string): Promise<SearchSynonym | null> {
    const rows = await sql`SELECT * FROM mod_search.search_synonyms WHERE id = ${id}`;
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      term: r.term as string,
      synonyms: r.synonyms as string[],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }

  async createSynonym(sql: postgres.ReservedSql, tenantId: string, input: CreateSynonymInput): Promise<SearchSynonym> {
    const id = uuidv7();
    const rows = await sql`
      INSERT INTO mod_search.search_synonyms (id, tenant_id, term, synonyms)
      VALUES (${id}, ${tenantId}, ${input.term.toLowerCase()}, ${sql.array(input.synonyms)})
      RETURNING *
    `;
    const r = rows[0];
    return {
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      term: r.term as string,
      synonyms: r.synonyms as string[],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }

  async updateSynonym(sql: postgres.ReservedSql, id: string, input: UpdateSynonymInput): Promise<SearchSynonym> {
    const rows = await sql`
      UPDATE mod_search.search_synonyms
      SET synonyms = ${sql.array(input.synonyms)}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!rows.length) throw new Error('Synonym not found');
    const r = rows[0];
    return {
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      term: r.term as string,
      synonyms: r.synonyms as string[],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }

  async deleteSynonym(sql: postgres.ReservedSql, id: string): Promise<void> {
    await sql`DELETE FROM mod_search.search_synonyms WHERE id = ${id}`;
  }

  /* ═══════════════════════════════════════════
   * ANALYTICS (read-only)
   * ═══════════════════════════════════════════ */

  async listAnalytics(sql: postgres.ReservedSql, tenantId: string, limit: number = 50): Promise<SearchAnalyticsEntry[]> {
    const rows = await sql`
      SELECT * FROM mod_search.search_analytics
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${Math.min(limit, 200)}
    `;
    return rows.map(r => ({
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      query: r.query as string,
      results_count: r.results_count as number,
      clicked_result: r.clicked_result as string | null,
      filters: r.filters as Record<string, unknown>,
      created_at: String(r.created_at),
    }));
  }
}

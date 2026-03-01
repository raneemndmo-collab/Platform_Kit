/**
 * M21 AI Engine — RAG Engine Service (Step 4)
 *
 * Metadata-only retrieval via Search module exclusively.
 * Calls SearchService.search() directly (same-transaction, no nested K3).
 * No document parsing. No chunking. No external AI models. No similarity search.
 * No background indexing. Deterministic scoring. One-shot retrieval per request.
 */
import type postgres from 'postgres';
import { v7 as uuidv7 } from 'uuid';
import { NotFoundError, ValidationError } from '@rasid/shared';
import { SearchService } from '../../../modules/search/src/index.js';
import type {
  RagSource,
  CreateRagSourceInput,
  UpdateRagSourceInput,
  RagRetrieveInput,
  RagRetrievalResult,
  RagRetrievalItem,
  RagRetrievalLog,
} from './rag.types.js';

const searchService = new SearchService();

export class RagService {
  // ═══════════════════════════════════════════
  // RAG SOURCE CRUD
  // ═══════════════════════════════════════════

  async createSource(
    sql: postgres.ReservedSql,
    tenantId: string,
    input: CreateRagSourceInput,
  ): Promise<RagSource> {
    const id = uuidv7();
    const rows = await sql`
      INSERT INTO mod_ai.rag_sources (id, tenant_id, name, description, module_id, object_type, metadata_filters)
      VALUES (
        ${id}, ${tenantId}, ${input.name}, ${input.description || ''},
        ${input.module_id}, ${input.object_type},
        ${JSON.stringify(input.metadata_filters || {})}::jsonb
      )
      RETURNING *
    `;
    return this.mapSource(rows[0]);
  }

  async listSources(sql: postgres.ReservedSql, tenantId: string): Promise<RagSource[]> {
    const rows = await sql`
      SELECT * FROM mod_ai.rag_sources
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map(r => this.mapSource(r));
  }

  async getSource(sql: postgres.ReservedSql, id: string): Promise<RagSource> {
    const rows = await sql`
      SELECT * FROM mod_ai.rag_sources WHERE id = ${id}
    `;
    if (rows.length === 0) throw new NotFoundError(`RAG source '${id}' not found`);
    return this.mapSource(rows[0]);
  }

  async updateSource(
    sql: postgres.ReservedSql,
    id: string,
    input: UpdateRagSourceInput,
  ): Promise<RagSource> {
    const existing = await this.getSource(sql, id);
    const rows = await sql`
      UPDATE mod_ai.rag_sources SET
        name = ${input.name ?? existing.name},
        description = ${input.description ?? existing.description},
        module_id = ${input.module_id ?? existing.module_id},
        object_type = ${input.object_type ?? existing.object_type},
        metadata_filters = ${JSON.stringify(input.metadata_filters ?? existing.metadata_filters)}::jsonb,
        status = ${input.status ?? existing.status},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    return this.mapSource(rows[0]);
  }

  async deleteSource(sql: postgres.ReservedSql, id: string): Promise<void> {
    const rows = await sql`
      DELETE FROM mod_ai.rag_sources WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) throw new NotFoundError(`RAG source '${id}' not found`);
  }

  // ═══════════════════════════════════════════
  // RAG RETRIEVAL — ONE-SHOT VIA SEARCH MODULE
  // ═══════════════════════════════════════════

  /**
   * Retrieve metadata from Search module.
   * One-shot: single request → single response. No loops. No chaining.
   *
   * Flow:
   * 1. Resolve source definitions (or use all active sources)
   * 2. For each source, call SearchService.search() directly (same transaction)
   * 3. Merge results, apply deterministic scoring (ts_rank from Search)
   * 4. Log retrieval
   * 5. Return merged results
   */
  async retrieve(
    sql: postgres.ReservedSql,
    tenantId: string,
    userId: string,
    input: RagRetrieveInput,
  ): Promise<RagRetrievalResult> {
    const start = Date.now();
    const limit = input.limit || 10;

    // 1. Resolve sources
    let sources: RagSource[];
    if (input.source_ids && input.source_ids.length > 0) {
      const rows = await sql`
        SELECT * FROM mod_ai.rag_sources
        WHERE id = ANY(${input.source_ids})
          AND status = 'active'
      `;
      sources = rows.map(r => this.mapSource(r));
      if (sources.length === 0) {
        throw new ValidationError('No active RAG sources found for the given IDs');
      }
    } else {
      const rows = await sql`
        SELECT * FROM mod_ai.rag_sources
        WHERE tenant_id = ${tenantId} AND status = 'active'
        ORDER BY created_at ASC
      `;
      sources = rows.map(r => this.mapSource(r));
    }

    if (sources.length === 0) {
      return {
        items: [],
        total: 0,
        query: input.query,
        sources_queried: 0,
        took_ms: Date.now() - start,
      };
    }

    // 2. Query Search module directly for each source (same transaction, no nested K3)
    const allItems: RagRetrievalItem[] = [];

    for (const source of sources) {
      try {
        // SAVEPOINT protects the outer transaction if search fails (e.g. tsquery syntax error)
        await sql`SAVEPOINT rag_search`;
        const searchResult = await searchService.searchReadOnly(sql, tenantId, {
          q: input.query,
          module_id: source.module_id,
          object_type: source.object_type,
          limit,
        });
        await sql`RELEASE SAVEPOINT rag_search`;

        if (searchResult.items && Array.isArray(searchResult.items)) {
          for (const item of searchResult.items) {
            // Apply metadata_filters if defined
            if (Object.keys(source.metadata_filters).length > 0) {
              const matches = Object.entries(source.metadata_filters).every(
                ([key, value]) => item.metadata[key] === value,
              );
              if (!matches) continue;
            }

            allItems.push({
              source_id: source.id,
              source_name: source.name,
              object_id: item.object_id,
              object_type: item.object_type,
              title: item.title,
              content: item.content,
              metadata: item.metadata,
              score: 0, // Deterministic: items already sorted by ts_rank from Search
            });
          }
        }
      } catch {
        // Rollback to savepoint to keep the transaction usable, then continue with other sources
        try { await sql`ROLLBACK TO SAVEPOINT rag_search`; } catch { /* ignore */ }
        continue;
      }
    }

    // 3. Assign deterministic scores based on position (already ranked by ts_rank)
    for (let i = 0; i < allItems.length; i++) {
      allItems[i].score = 1 - (i / Math.max(allItems.length, 1));
    }

    // 4. Trim to limit
    const trimmed = allItems.slice(0, limit);

    const took_ms = Date.now() - start;

    // 5. Log retrieval
    const logId = uuidv7();
    await sql`
      INSERT INTO mod_ai.rag_retrieval_logs (id, tenant_id, user_id, query, source_ids, results_count, took_ms)
      VALUES (
        ${logId}, ${tenantId}, ${userId}, ${input.query},
        ${JSON.stringify(sources.map(s => s.id))}::jsonb,
        ${trimmed.length}, ${took_ms}
      )
    `;

    return {
      items: trimmed,
      total: allItems.length,
      query: input.query,
      sources_queried: sources.length,
      took_ms,
    };
  }

  // ═══════════════════════════════════════════
  // RETRIEVAL LOGS
  // ═══════════════════════════════════════════

  async listRetrievalLogs(
    sql: postgres.ReservedSql,
    tenantId: string,
    limit?: number,
  ): Promise<RagRetrievalLog[]> {
    const rows = await sql`
      SELECT * FROM mod_ai.rag_retrieval_logs
      WHERE tenant_id = ${tenantId}
      ORDER BY retrieved_at DESC
      LIMIT ${limit || 50}
    `;
    return rows.map(r => ({
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      user_id: r.user_id as string,
      query: r.query as string,
      source_ids: r.source_ids as string[],
      results_count: r.results_count as number,
      took_ms: r.took_ms as number,
      retrieved_at: String(r.retrieved_at),
    }));
  }

  // ═══════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════

  private mapSource(r: Record<string, unknown>): RagSource {
    return {
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      name: r.name as string,
      description: r.description as string,
      module_id: r.module_id as string,
      object_type: r.object_type as string,
      metadata_filters: r.metadata_filters as Record<string, unknown>,
      status: r.status as 'active' | 'disabled',
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}

export const ragService = new RagService();

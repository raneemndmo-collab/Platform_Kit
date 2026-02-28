/**
 * M12 Search Engine -- Interface contract
 * All operations are metadata-only. No cross-schema FK.
 * No background jobs. No caching. No external search engine.
 */

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
import type postgres from 'postgres';

export interface ISearchService {
  // Search
  search(sql: postgres.ReservedSql, tenantId: string, query: SearchQuery): Promise<SearchResult>;

  // Index CRUD
  indexEntry(sql: postgres.ReservedSql, tenantId: string, userId: string, input: CreateIndexEntryInput): Promise<SearchIndexEntry>;
  removeEntry(sql: postgres.ReservedSql, id: string): Promise<void>;
  reindex(sql: postgres.ReservedSql, tenantId: string, input: ReindexInput): Promise<{ reindexed_count: number }>;

  // Synonyms
  listSynonyms(sql: postgres.ReservedSql, tenantId: string): Promise<SearchSynonym[]>;
  getSynonym(sql: postgres.ReservedSql, id: string): Promise<SearchSynonym | null>;
  createSynonym(sql: postgres.ReservedSql, tenantId: string, input: CreateSynonymInput): Promise<SearchSynonym>;
  updateSynonym(sql: postgres.ReservedSql, id: string, input: UpdateSynonymInput): Promise<SearchSynonym>;
  deleteSynonym(sql: postgres.ReservedSql, id: string): Promise<void>;

  // Analytics
  listAnalytics(sql: postgres.ReservedSql, tenantId: string, limit?: number): Promise<SearchAnalyticsEntry[]>;
}

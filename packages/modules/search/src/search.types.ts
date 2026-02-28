/**
 * M12 Search Engine -- Type definitions
 * Schema: mod_search
 * No cross-schema references. Metadata-only search.
 */

export interface SearchIndexEntry {
  id: string;
  tenant_id: string;
  object_id: string;
  object_type: string;
  module_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  indexed_at: string;
  updated_at: string;
}

export interface SearchSynonym {
  id: string;
  tenant_id: string;
  term: string;
  synonyms: string[];
  created_at: string;
  updated_at: string;
}

export interface SearchAnalyticsEntry {
  id: string;
  tenant_id: string;
  query: string;
  results_count: number;
  clicked_result: string | null;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface SearchQuery {
  q: string;
  module_id?: string;
  object_type?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  items: SearchIndexEntry[];
  total: number;
  query: string;
  took_ms: number;
}

export interface CreateIndexEntryInput {
  object_id: string;
  object_type: string;
  module_id: string;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSynonymInput {
  term: string;
  synonyms: string[];
}

export interface UpdateSynonymInput {
  synonyms: string[];
}

export interface ReindexInput {
  module_id?: string;
  object_type?: string;
}

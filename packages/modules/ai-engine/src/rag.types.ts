/**
 * M21 AI Engine — RAG Engine Types (Step 4)
 *
 * Metadata-only retrieval via Search module exclusively.
 * No document parsing. No chunking. No embeddings. No vector similarity.
 * No background indexing. Deterministic scoring. One-shot retrieval per request.
 * No persistent context beyond defined schema.
 */

/** A RAG retrieval source definition — links to Search module filters */
export interface RagSource {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  /** Search module filters applied when querying this source */
  module_id: string;
  object_type: string;
  /** Optional static metadata filters (AND-ed with search) */
  metadata_filters: Record<string, unknown>;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

/** Input for creating a RAG source */
export interface CreateRagSourceInput {
  name: string;
  description?: string;
  module_id: string;
  object_type: string;
  metadata_filters?: Record<string, unknown>;
}

/** Input for updating a RAG source */
export interface UpdateRagSourceInput {
  name?: string;
  description?: string;
  module_id?: string;
  object_type?: string;
  metadata_filters?: Record<string, unknown>;
  status?: 'active' | 'disabled';
}

/** A single RAG retrieval request */
export interface RagRetrieveInput {
  query: string;
  source_ids?: string[];
  limit?: number;
}

/** A single scored retrieval result */
export interface RagRetrievalItem {
  source_id: string;
  source_name: string;
  object_id: string;
  object_type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  /** Deterministic score from PostgreSQL ts_rank */
  score: number;
}

/** Full RAG retrieval response */
export interface RagRetrievalResult {
  items: RagRetrievalItem[];
  total: number;
  query: string;
  sources_queried: number;
  took_ms: number;
}

/** RAG retrieval log entry */
export interface RagRetrievalLog {
  id: string;
  tenant_id: string;
  user_id: string;
  query: string;
  source_ids: string[];
  results_count: number;
  took_ms: number;
  retrieved_at: string;
}

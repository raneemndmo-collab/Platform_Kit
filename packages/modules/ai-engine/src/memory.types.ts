/**
 * M21 AI Engine — Memory Layer Types (Step 5)
 *
 * Session-scoped memory only. No cross-session sharing.
 * No automatic injection into other modules.
 * No PII beyond allowed fields. Structured context only.
 * Schema: mod_ai
 */

/** A memory session — scoped to one user within one tenant */
export interface MemorySession {
  id: string;
  tenant_id: string;
  user_id: string;
  /** Optional label for the session */
  label: string;
  /** Structured metadata about the session (e.g. source, purpose) */
  metadata: Record<string, unknown>;
  status: 'active' | 'closed';
  created_at: string;
  updated_at: string;
}

/** A single memory entry within a session */
export interface MemoryEntry {
  id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  /** Role: 'user' | 'assistant' | 'system' | 'tool' */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** Structured content — NOT raw prompts */
  content: Record<string, unknown>;
  /** Entry sequence number within the session (1-based) */
  seq: number;
  created_at: string;
}

// ── Input types ──

export interface CreateMemorySessionInput {
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemorySessionInput {
  label?: string;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'closed';
}

export interface AddMemoryEntryInput {
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: Record<string, unknown>;
}

export interface ListMemoryEntriesInput {
  session_id: string;
  limit?: number;
  offset?: number;
}

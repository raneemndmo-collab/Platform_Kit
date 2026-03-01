/**
 * M21 AI Engine — Memory Layer Zod Schemas (Step 5)
 *
 * Validation schemas for Memory Layer inputs.
 * Structured context only. No raw prompts. No PII beyond allowed fields.
 *
 * HARD LIMITS:
 * - content JSON: max 32 KB serialized
 * - metadata JSON: max 8 KB serialized
 * - max entries per session: 500
 * - label: max 255 chars
 */
import { z } from 'zod';

// ── Size-limited JSON refinements ──

const MAX_CONTENT_BYTES = 32_768;   // 32 KB
const MAX_METADATA_BYTES = 8_192;   // 8 KB
export const MAX_ENTRIES_PER_SESSION = 500;

/**
 * Validates that a JSON-serializable object does not exceed `maxBytes` when stringified.
 */
function jsonSizeLimit(maxBytes: number, fieldName: string) {
  return z.record(z.unknown()).refine(
    (val) => {
      try {
        return JSON.stringify(val).length <= maxBytes;
      } catch {
        return false;
      }
    },
    { message: `${fieldName} exceeds maximum size of ${maxBytes} bytes` },
  );
}

// ── Schemas ──

export const createMemorySessionSchema = z.object({
  label: z.string().max(255).optional().default(''),
  metadata: jsonSizeLimit(MAX_METADATA_BYTES, 'metadata').optional().default({}),
});

export const updateMemorySessionSchema = z.object({
  session_id: z.string().min(1),
  label: z.string().max(255).optional(),
  metadata: jsonSizeLimit(MAX_METADATA_BYTES, 'metadata').optional(),
  status: z.enum(['active', 'closed']).optional(),
});

export const addMemoryEntrySchema = z.object({
  session_id: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: jsonSizeLimit(MAX_CONTENT_BYTES, 'content'),
});

export const listMemoryEntriesSchema = z.object({
  session_id: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const deleteMemorySessionSchema = z.object({
  session_id: z.string().min(1),
});

export const getMemorySessionSchema = z.object({
  session_id: z.string().min(1),
});
